import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { MovimientoFrecuente } from '../lib/database.types'

// Plantillas de un toque para movimientos que se repiten siempre igual
// (ej. "Parqueadero CC Monterrey" siempre $7.200) — se guardan al
// confirmar un movimiento normal, y aparecen como chips debajo del
// teclado numérico en MovimientoNuevo.tsx. Hook aparte (no adentro de
// useFinanzas, que ya tiene un sistema de caché mucho más elaborado)
// porque esto es una comodidad chiquita, no dato financiero central —
// no necesita esa misma sofisticación.
//
// Sin botón de "eliminar" a propósito — se ordena por el más USADO
// RECIENTEMENTE primero (no por el total histórico de usos), así que
// un frecuente que dejaste de usar se va solo hacia abajo con el
// tiempo, sin necesitar que nadie lo borre a mano. La función
// eliminar() sigue disponible por si alguna vez hace falta un botón
// explícito, pero no está conectada a ninguna pantalla todavía.
export function useMovimientosFrecuentes() {
  const { user } = useAuth()
  const [frecuentes, setFrecuentes] = useState<MovimientoFrecuente[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) { setFrecuentes([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('movimientos_frecuentes')
      .select('*')
      .eq('user_id', user.id)
      .order('ultimo_uso', { ascending: false })
      .order('usos', { ascending: false })
      .limit(12)
    setFrecuentes((data as MovimientoFrecuente[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  // Se llama al confirmar un movimiento con el toggle "Guardar como
  // frecuente" activado. Si ya existe uno con el mismo nombre, mejor
  // sumarle un uso en vez de crear un duplicado — así el orden (por
  // usos) sigue teniendo sentido incluso si alguien reusa el nombre.
  async function guardar(datos: {
    nombre: string
    tipo: 'ingreso' | 'egreso'
    monto: number
    categoriaId: string | null
    cuentaId: string | null
    descripcion: string | null
    lugar: string | null
    gastoFijoId?: string | null
    ingresoFijoId?: string | null
  }) {
    if (!user) return
    const existente = frecuentes.find((f) => f.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase() && f.tipo === datos.tipo)
    if (existente) {
      await supabase.from('movimientos_frecuentes').update({
        monto: datos.monto, categoria_id: datos.categoriaId, cuenta_id: datos.cuentaId,
        descripcion: datos.descripcion, lugar: datos.lugar,
        gasto_fijo_id: datos.gastoFijoId ?? null, ingreso_fijo_id: datos.ingresoFijoId ?? null,
        usos: existente.usos + 1, ultimo_uso: new Date().toISOString(),
      }).eq('id', existente.id)
    } else {
      await supabase.from('movimientos_frecuentes').insert({
        user_id: user.id, nombre: datos.nombre.trim(), tipo: datos.tipo, monto: datos.monto,
        categoria_id: datos.categoriaId, cuenta_id: datos.cuentaId, descripcion: datos.descripcion, lugar: datos.lugar,
        gasto_fijo_id: datos.gastoFijoId ?? null, ingreso_fijo_id: datos.ingresoFijoId ?? null,
      })
    }
    await reload()
  }

  // Al tocar un chip y usarlo de verdad (no solo al pasar por encima) —
  // bump silencioso, no bloquea la navegación si falla.
  function registrarUso(id: string) {
    const actual = frecuentes.find((f) => f.id === id)
    supabase.from('movimientos_frecuentes').update({
      usos: (actual?.usos ?? 0) + 1, ultimo_uso: new Date().toISOString(),
    }).eq('id', id).then(() => {})
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('movimientos_frecuentes').delete().eq('id', id)
    if (error) throw error
    await reload()
  }

  return { frecuentes, loading, reload, guardar, registrarUso, eliminar }
}

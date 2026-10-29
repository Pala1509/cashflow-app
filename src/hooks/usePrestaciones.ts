import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useFinanzas } from './useFinanzas'
import { detectarSalarioMensual, proximoPagoPrestacion } from '../lib/prestaciones'

// Prima y cesantías: detecta el salario entre los ingresos fijos y lee si el
// usuario ya confirmó (un toque) que es empleo formal. La respuesta vive en
// profiles.recibe_prestaciones (null = todavía no se le ha preguntado).
// Se guarda en memoria por usuario para no repetir la consulta en cada
// pantalla que use el hook (Inicio, Flujo de caja, Salud financiera…).
const cache = new Map<string, boolean | null>()
const oyentes = new Set<() => void>()

export function usePrestaciones() {
  const { user } = useAuth()
  const { ingresosFijos, categorias, transacciones } = useFinanzas()
  const uid = user?.id ?? ''
  const [recibe, setRecibe] = useState<boolean | null | undefined>(() => (cache.has(uid) ? cache.get(uid) : undefined))

  useEffect(() => {
    const avisar = () => setRecibe(cache.has(uid) ? cache.get(uid) : undefined)
    oyentes.add(avisar)
    return () => { oyentes.delete(avisar) }
  }, [uid])

  useEffect(() => {
    if (!uid || cache.has(uid)) return
    supabase.from('profiles').select('recibe_prestaciones').eq('id', uid).single().then(({ data, error }) => {
      if (error) return
      cache.set(uid, (data?.recibe_prestaciones as boolean | null) ?? null)
      oyentes.forEach((f) => f())
    })
  }, [uid])

  const salarioMensual = useMemo(() => detectarSalarioMensual(ingresosFijos, categorias), [ingresosFijos, categorias])
  const proximo = useMemo(
    () => (salarioMensual && recibe ? proximoPagoPrestacion(salarioMensual, new Date(), transacciones) : null),
    [salarioMensual, recibe, transacciones],
  )

  const responder = useCallback(async (valor: boolean) => {
    if (!uid) return
    cache.set(uid, valor)
    oyentes.forEach((f) => f())
    await supabase.from('profiles').update({ recibe_prestaciones: valor }).eq('id', uid)
  }, [uid])

  return {
    salarioMensual,
    // undefined = cargando; null = no ha respondido
    recibe,
    activo: Boolean(salarioMensual && recibe),
    proximo,
    responder,
  }
}

import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useFinanzas } from './useFinanzas'
import { useTasasCambio } from './useTasasCambio'
import { tienePermiso, programarGastosFijos, programarDeudas, revisarPresupuestos, revisarMetas, revisarGastosHormiga, programarAvisoFlujo } from '../lib/notificaciones'
import { proyectarFlujo } from '../lib/flujoCaja'
import { t as traducir } from '../lib/i18n'
import { actualizarWidget, actualizarWidgetRecientes, actualizarWidgetResumenMes } from '../lib/widget'

const fmtWidget = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Se monta una sola vez (en AppShell) y, cada vez que los datos financieros
// cambian, revisa si hay que programar o disparar notificaciones — sin
// bloquear nada de la interfaz si algo falla.
export function useNotificacionesEngine() {
  const { user } = useAuth()
  const { cuentas, gastosFijos, ingresosFijos, presupuestos, categorias, transacciones, metas, deudas, loading } = useFinanzas()
  const { convertirCOP } = useTasasCambio()
  const yaCorrioRef = useRef(false)

  // El widget de pantalla de inicio se actualiza aparte de las
  // notificaciones — no necesita permiso del sistema ni preferencias, así
  // que corre siempre que el balance cambie.
  useEffect(() => {
    if (loading) return
    const totalCash = cuentas.filter((c) => c.tipo !== 'tarjeta_credito').reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
    actualizarWidget(totalCash)
  }, [loading, cuentas, convertirCOP])

  // Widget grande y mediano — hasta 4 movimientos recientes, cada línea
  // con su tipo al frente ("egreso::Mercado · -$45.000") separado por
  // "::" para que el lado nativo (Java) pueda colorear cada uno según si
  // fue ingreso/egreso/transferencia, en vez de mostrarlos todos del
  // mismo gris. transacciones ya viene ordenada por fecha descendente
  // desde useFinanzas, así que los primeros 4 son los más nuevos sin
  // necesidad de volver a ordenar acá.
  useEffect(() => {
    if (loading) return
    const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]))
    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]))
    const lineas = transacciones.slice(0, 4).map((t) => {
      if (t.tipo === 'transferencia') {
        const origen = cuentaPorId.get(t.cuenta_id)?.nombre ?? '?'
        const destino = t.cuenta_destino_id ? cuentaPorId.get(t.cuenta_destino_id)?.nombre ?? '?' : '?'
        return `transferencia::${origen} → ${destino}`
      }
      const nombre = t.descripcion || categoriaPorId.get(t.categoria_id ?? '')?.nombre || 'Otros'
      const signo = t.tipo === 'ingreso' ? '+' : '-'
      return `${t.tipo}::${nombre} · ${signo}${fmtWidget(t.monto + t.monto_4x1000)}`
    })
    actualizarWidgetRecientes(lineas)
  }, [loading, transacciones, cuentas, categorias])

  // Ingresos y egresos del mes actual — mismo cálculo que ya se ve en
  // Inicio, para que el widget grande muestre algo más que solo la
  // lista de movimientos.
  useEffect(() => {
    if (loading) return
    const now = new Date()
    const delMes = transacciones.filter((t) => {
      const [y, m] = t.fecha.split('-').map(Number)
      return y === now.getFullYear() && m === now.getMonth() + 1
    })
    const ingresos = delMes.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
    const egresos = delMes.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + t.monto_4x1000, 0)
    actualizarWidgetResumenMes(fmtWidget(ingresos), fmtWidget(egresos))
  }, [loading, transacciones])

  useEffect(() => {
    if (loading || !user) return
    let cancelado = false

    async function run() {
      const permiso = await tienePermiso()
      if (!permiso || cancelado) return

      const { data: prefs } = await supabase
        .from('profiles')
        .select('notif_gastos_fijos, notif_presupuestos, notif_metas, notif_deudas, notif_deudas_dias_antes, idioma')
        .eq('id', user!.id)
        .single()
      if (cancelado || !prefs) return

      if (prefs.notif_gastos_fijos) await programarGastosFijos(gastosFijos)
      if (prefs.notif_deudas) await programarDeudas(deudas)
      if (prefs.notif_presupuestos) await revisarPresupuestos(presupuestos, categorias, transacciones)
      // Gastos hormiga reutiliza el mismo interruptor de "Presupuestos" —
      // ambas son alertas de "cuidado con lo que gastas", y así no toca
      // agregar una columna nueva en profiles ni un toggle más en Perfil.
      // Si más adelante quieres separarlo, es un cambio chiquito.
      if (prefs.notif_presupuestos) await revisarGastosHormiga(transacciones)
      if (prefs.notif_metas) await revisarMetas(metas)
      // Aviso de flujo de caja: comparte el interruptor de "Gastos fijos"
      // (son avisos de pagos que se vienen) para no sumar otro toggle.
      if (prefs.notif_gastos_fijos) {
        const flujo = proyectarFlujo({ cuentas, ingresosFijos, gastosFijos, deudas, transacciones, convertirCOP, dias: 30 })
        const idioma = prefs.idioma === 'en' ? 'en' : 'es'
        await programarAvisoFlujo(flujo.hueco, {
          titulo: traducir('flujo_notif_titulo', idioma),
          cuerpo: (fecha, monto) => traducir('flujo_notif_cuerpo', idioma, { fecha, monto }),
        })
      }
      yaCorrioRef.current = true
    }

    run().catch(() => {})
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, gastosFijos, ingresosFijos, cuentas, presupuestos, metas, deudas, transacciones])
}

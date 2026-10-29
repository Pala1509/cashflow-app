import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { leerAccionWidget } from '../lib/widget'

// Si tocaste "+ Ingreso" o "- Egreso" en el widget de pantalla de inicio,
// la app debe abrir directo en /movimiento/nuevo con ese tipo ya elegido —
// no en Inicio como si nada. Revisa al abrir la app Y cada vez que vuelve a
// primer plano (porque si ya estaba abierta, tocar el widget no la
// "relanza", solo la trae al frente con un intent nuevo).
export function useWidgetLaunch() {
  const navigate = useNavigate()

  // Se pone Inicio debajo antes de abrir "nuevo movimiento": si la app
  // arrancó directo desde el widget, el historial está vacío y la X / la
  // flecha de atrás (navigate(-1)) no tendrían a dónde volver — la pantalla
  // quedaba bloqueada.
  const abrirNuevo = (tipo: 'ingreso' | 'egreso') => {
    navigate('/inicio', { replace: true })
    navigate(`/movimiento/nuevo?tipo=${tipo}`)
  }

  useEffect(() => {
    async function revisar() {
      const accion = await leerAccionWidget()
      if (accion === 'ingreso' || accion === 'egreso') {
        abrirNuevo(accion)
      }
    }

    revisar()
    const listenerPromise = CapApp.addListener('resume', revisar)

    // iPhone: los botones del widget abren la app con un enlace
    // cashflow://nuevo?tipo=ingreso|egreso (ver ios/App/CashFlowWidget).
    // Con la app cerrada llega como URL de arranque; con la app abierta,
    // como evento appUrlOpen.
    const abrirDesdeUrl = (url?: string) => {
      if (!url || !url.startsWith('cashflow://')) return
      const tipo = new URL(url.replace('cashflow://', 'https://x/')).searchParams.get('tipo')
      if (tipo === 'ingreso' || tipo === 'egreso') abrirNuevo(tipo)
    }
    CapApp.getLaunchUrl().then((r) => abrirDesdeUrl(r?.url)).catch(() => {})
    const urlListener = CapApp.addListener('appUrlOpen', (e) => abrirDesdeUrl(e.url))

    return () => {
      listenerPromise.then((listener) => listener.remove())
      urlListener.then((listener) => listener.remove())
    }
  }, [navigate])
}

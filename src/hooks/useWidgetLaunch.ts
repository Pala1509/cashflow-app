import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { leerAccionWidget } from '../lib/widget'

// Si tocaste "+ Ingreso" o "- Egreso" en el widget de pantalla de inicio,
// la app debe abrir directo en /movimiento/nuevo con ese tipo ya elegido —
// no en Inicio como si nada. Revisa al abrir la app Y cada vez que vuelve a
// primer plano (porque si ya estaba abierta, tocar el widget no la
// "relanza", solo la trae al frente con un intent nuevo).

// La URL con la que se ABRIÓ la app (iPhone) se procesa una sola vez en toda
// la vida de la app. Antes se volvía a leer en cada navegación (useNavigate
// cambia en cada cambio de ruta y el efecto se repetía), así que al tocar
// la X la app volvía a abrir "nuevo movimiento" una y otra vez: se veía
// como si la pantalla estuviera bloqueada.
let urlDeArranqueProcesada = false

export function useWidgetLaunch() {
  const navigate = useNavigate()
  // Siempre la versión más nueva de navigate, sin volver a correr el efecto.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    // Inicio queda debajo de "nuevo movimiento": si la app arrancó directo
    // desde el widget, la X / atrás tienen a dónde volver.
    const abrirNuevo = (tipo: 'ingreso' | 'egreso') => {
      navigateRef.current('/inicio', { replace: true })
      navigateRef.current(`/movimiento/nuevo?tipo=${tipo}`)
    }

    async function revisar() {
      const accion = await leerAccionWidget()
      if (accion === 'ingreso' || accion === 'egreso') abrirNuevo(accion)
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
    if (!urlDeArranqueProcesada) {
      urlDeArranqueProcesada = true
      CapApp.getLaunchUrl().then((r) => abrirDesdeUrl(r?.url)).catch(() => {})
    }
    const urlListener = CapApp.addListener('appUrlOpen', (e) => abrirDesdeUrl(e.url))

    return () => {
      listenerPromise.then((listener) => listener.remove())
      urlListener.then((listener) => listener.remove())
    }
  }, [])
}

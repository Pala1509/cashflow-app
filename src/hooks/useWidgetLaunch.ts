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

  useEffect(() => {
    async function revisar() {
      const accion = await leerAccionWidget()
      if (accion === 'ingreso' || accion === 'egreso') {
        navigate(`/movimiento/nuevo?tipo=${accion}`)
      }
    }

    revisar()
    const listenerPromise = CapApp.addListener('resume', revisar)
    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [navigate])
}

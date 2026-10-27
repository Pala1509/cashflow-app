import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'

// En Android, el botón físico/gesto de "atrás" por defecto sale de la app
// apenas se queda sin historial propio del WebView. Este hook hace que,
// mientras haya a dónde volver DENTRO de CashFlow, vaya para allá — y solo
// cierra la app si ya estás en Inicio (la raíz de la navegación).
export function useAndroidBackButton() {
  const navigate = useNavigate()

  useEffect(() => {
    const listenerPromise = CapApp.addListener('backButton', () => {
      const atRoot = window.location.pathname === '/inicio' || window.location.pathname === '/'
      const hasAppHistory = window.history.state?.idx > 0

      if (!atRoot && hasAppHistory) {
        navigate(-1)
      } else if (!atRoot) {
        navigate('/inicio')
      } else {
        CapApp.exitApp()
      }
    })

    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [navigate])
}

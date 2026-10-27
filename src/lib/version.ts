import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Versión que se muestra en Perfil y en "Acerca de". En el celular se lee
// de la app instalada (versionName en Android / CFBundleShortVersionString
// en iOS), así nunca queda desactualizada a mano. En web usa este valor.
export const VERSION_WEB = '1.0.0'

export function useVersionApp(): string {
  const [version, setVersion] = useState(VERSION_WEB)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    App.getInfo().then((info) => setVersion(info.version)).catch(() => {})
  }, [])
  return version
}

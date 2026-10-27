import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appAlert, appConfirm } from '../lib/dialogs'
import { useIdioma } from '../lib/IdiomaContext'
import { anuncioSiriVisto, asegurarSiri, marcarAnuncioSiriVisto, siriActivado, siriDisponible } from '../lib/siri'
import { tourVisto } from '../lib/onboardingStatus'

// Activa "Anotar con Siri" solo (en iPhone) apenas hay sesión, y la
// primera vez muestra un aviso con la opción de ver cómo se usa. Espera a
// que termine el tour de bienvenida para no encimar los dos.
export function useSiriAuto(userId: string | null, tourActivo: boolean) {
  const navigate = useNavigate()
  const { t } = useIdioma()

  useEffect(() => {
    if (!userId || tourActivo) return
    let cancelado = false
    ;(async () => {
      try {
        await asegurarSiri(userId)
        if (cancelado || (await anuncioSiriVisto())) return
        // Si no quedó activo (no es iPhone o lo apagó a propósito), no hay
        // nada que anunciar.
        if (!(await siriActivado())) return
        // Usuario nuevo: el tour arranca primero; el aviso sale la próxima vez.
        if (!(await tourVisto(userId))) return
        await marcarAnuncioSiriVisto()
        if (cancelado) return
        if (!siriDisponible()) {
          // Android: no hay pantalla de Siri, el aviso explica el widget 🎤.
          await appAlert(t('voz_anuncio_android'))
          return
        }
        const ver = await appConfirm(t('siri_anuncio'), { confirmLabel: t('siri_anuncio_ver'), cancelLabel: t('siri_anuncio_despues') })
        if (ver && !cancelado) navigate('/perfil/siri')
      } catch {
        // Sin red o la RPC falló: se reintenta la próxima vez que abra la app.
      }
    })()
    return () => { cancelado = true }
  }, [userId, tourActivo, navigate, t])
}

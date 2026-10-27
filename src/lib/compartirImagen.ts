import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// html2canvas es pesado (~200KB) — se carga SOLO cuando alguien de verdad
// toca "Compartir", no en cada carga de la app. Así el resto de CashFlow
// no paga el costo de esta pantalla que casi nadie visita todos los días.
export async function compartirNodoComoImagen(nodo: HTMLElement, nombreArchivo: string, tituloCompartir: string) {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(nodo, { backgroundColor: '#131313', scale: 1, useCORS: true })
  const dataUrl = canvas.toDataURL('image/png')

  if (Capacitor.isNativePlatform()) {
    const base64 = dataUrl.split(',')[1]
    const resultado = await Filesystem.writeFile({
      path: nombreArchivo,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({
      title: tituloCompartir,
      url: resultado.uri,
    })
  } else {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = nombreArchivo
    a.click()
  }
}

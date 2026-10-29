import { Share } from '@capacitor/share'

// "Cobrar por WhatsApp": arma el mensaje del cobro y abre WhatsApp con el
// texto listo; el usuario solo elige el contacto y envía. No guardamos
// teléfonos de nadie (nada que configurar).
//
// whatsapp://send abre la app directo (en Android y en iOS Capacitor manda
// los esquemas que no son http a la app que los maneja). Si no hay
// WhatsApp, se cae al menú de compartir del sistema.
export function mensajeCobro(plantilla: string, vars: { monto: string; nombre: string; fecha?: string | null }, conFecha: string): string {
  const extraFecha = vars.fecha ? conFecha.replace('{fecha}', vars.fecha) : ''
  return plantilla.replace('{monto}', vars.monto).replace('{nombre}', vars.nombre).replace('{conFecha}', extraFecha)
}

export async function cobrarPorWhatsApp(texto: string): Promise<void> {
  const url = `whatsapp://send?text=${encodeURIComponent(texto)}`
  const antes = Date.now()
  window.location.href = url
  // Si a los 1,5 s seguimos aquí con la app visible, WhatsApp no abrió:
  // ofrecemos el menú de compartir normal.
  await new Promise((r) => setTimeout(r, 1500))
  if (document.visibilityState === 'visible' && Date.now() - antes < 4000) {
    try { await Share.share({ text: texto }) } catch { /* canceló */ }
  }
}

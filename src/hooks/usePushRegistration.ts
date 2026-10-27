import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// Se monta una sola vez (en AppShell) cuando ya hay un usuario logueado.
// Le pide permiso al sistema y, si acepta, registra este dispositivo con
// Firebase — el token que llega en el evento 'registration' es el
// "teléfono digital" que el servidor usa después para mandar un push
// aunque la app esté cerrada.
export function usePushRegistration(userId: string | null) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return
    let cancelado = false

    async function setup() {
      const permiso = await PushNotifications.checkPermissions()
      let estado = permiso.receive
      if (estado === 'prompt') {
        const pedido = await PushNotifications.requestPermissions()
        estado = pedido.receive
      }
      if (estado !== 'granted' || cancelado) return

      await PushNotifications.register()
    }

    const listeners = [
      PushNotifications.addListener('registration', async (token) => {
        // Antes esto guardaba platform: 'android' fijo sin importar el
        // sistema real — así que un token de iOS también quedaba
        // etiquetado como Android en la base. Capacitor.getPlatform()
        // devuelve 'ios' o 'android' según corresponda.
        // Upsert por si este mismo dispositivo ya se había registrado
        // antes (no crea duplicados, solo refresca el token).
        await supabase.from('push_tokens').upsert(
          { user_id: userId, token: token.value, platform: Capacitor.getPlatform() },
          { onConflict: 'user_id,token' }
        )
      }),
      PushNotifications.addListener('registrationError', (err) => {
        console.warn('Error registrando push:', err)
      }),
      // Con la app abierta, la notificación local ya cubre el aviso — este
      // listener es sobre todo para cuando TOCAS un push que llegó con la
      // app cerrada, y hay que llevarte a la pantalla correcta.
      PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
        const ruta = accion.notification.data?.ruta as string | undefined
        if (ruta) navigate(ruta)
      }),
    ]

    setup()

    return () => {
      cancelado = true
      listeners.forEach((l) => l.then((listener) => listener.remove()))
    }
  }, [userId, navigate])
}

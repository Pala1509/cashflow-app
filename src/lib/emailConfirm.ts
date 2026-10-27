import type { User } from '@supabase/supabase-js'

export const DIAS_GRACIA_CONFIRMACION = 5

export function emailConfirmado(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at)
}

// Cuántos días completos han pasado desde que se creó la cuenta — se
// basa en created_at (la fecha del registro), no en cuándo se mandó el
// último correo, para que reenviar el correo no le regale más tiempo a
// alguien que simplemente no lo ha confirmado.
function diasTranscurridos(user: User): number {
  const creado = new Date(user.created_at).getTime()
  const ahora = Date.now()
  return Math.floor((ahora - creado) / (1000 * 60 * 60 * 24))
}

// Días que quedan antes de que se bloquee la cuenta — nunca negativo.
// 0 significa "hoy es el último día", el bloqueo entra cuando esto pasa
// de 0 (ver emailVencido).
export function diasRestantesConfirmacion(user: User): number {
  return Math.max(DIAS_GRACIA_CONFIRMACION - diasTranscurridos(user), 0)
}

export function emailVencido(user: User | null): boolean {
  if (!user || emailConfirmado(user)) return false
  return diasTranscurridos(user) >= DIAS_GRACIA_CONFIRMACION
}

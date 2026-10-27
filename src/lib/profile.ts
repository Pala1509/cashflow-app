import type { User } from '@supabase/supabase-js'

export function getNombre(user: User | null): string {
  const nombre = user?.user_metadata?.nombre as string | undefined
  return nombre || user?.email?.split('@')[0] || 'ahí'
}

// Nombre + apellido juntos, para donde se necesite el nombre "de verdad"
// de la persona (ej. el titular en la vista previa de una tarjeta) — a
// diferencia de getNombre(), que es solo el nombre de pila para saludos.
export function getNombreCompleto(user: User | null): string {
  const nombre = (user?.user_metadata?.nombre as string | undefined)?.trim()
  const apellido = (user?.user_metadata?.apellido as string | undefined)?.trim()
  const junto = [nombre, apellido].filter(Boolean).join(' ')
  return junto || user?.email?.split('@')[0] || ''
}

export function getIniciales(user: User | null): string {
  const nombre = user?.user_metadata?.nombre as string | undefined
  const apellido = user?.user_metadata?.apellido as string | undefined
  if (nombre && apellido) return (nombre[0] + apellido[0]).toUpperCase()
  if (nombre) return nombre.slice(0, 2).toUpperCase()
  return (user?.email || 'ZF').slice(0, 2).toUpperCase()
}

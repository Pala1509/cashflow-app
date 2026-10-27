// Colombia (y casi todo el mundo detrás de UTC) sufre un bug clásico de JS:
// `new Date('2026-08-01')` se interpreta como medianoche UTC, que en UTC-5
// es el 31 de julio a las 7pm — un día ANTES del que realmente es.
// Estas dos funciones evitan ese corrimiento usando siempre fecha LOCAL.

// "Hoy" en formato YYYY-MM-DD, en la zona horaria del dispositivo (no UTC).
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Convierte un string YYYY-MM-DD (como los que vienen de Supabase) a un
// Date en hora LOCAL, sin el corrimiento de interpretarlo como UTC.
export function parseLocalDate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

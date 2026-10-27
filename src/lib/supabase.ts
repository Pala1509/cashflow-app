import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local, pon los valores de tu proyecto (Settings > API en Supabase) y reinicia "npm run dev".'
  )
}

// Nota: no usamos el genérico <Database> de supabase-js aquí porque su versión
// actual de postgrest-js exige una forma más estricta (Views/Functions con tipos
// específicos) que complica el archivo sin aportar valor real todavía. Los tipos
// de cada tabla siguen viviendo en database.types.ts y se aplican al leer los
// resultados (ver src/hooks/useFinanzas.ts). Cuando el esquema esté más estable,
// se puede generar el tipo oficial con `npx supabase gen types typescript`.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)

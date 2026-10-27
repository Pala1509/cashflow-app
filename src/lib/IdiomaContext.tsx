import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { t as traducir, type Idioma, type ClaveTraduccion } from '../lib/i18n'

interface IdiomaContextValue {
  idioma: Idioma
  cargando: boolean
  cambiarIdioma: (nuevo: Idioma) => Promise<void>
  t: (clave: ClaveTraduccion, vars?: Record<string, string | number>) => string
}

const IdiomaContext = createContext<IdiomaContextValue | null>(null)

// Se monta UNA sola vez, en AppShell (que persiste mientras navegas entre
// pestañas) — así cada pantalla lee el mismo idioma ya cargado, en vez de
// cada una haciendo su propia consulta y mostrando español por un
// instante mientras espera la respuesta (el "glitch" al cambiar de
// pantalla).
export function IdiomaProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>('es')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!userId) { setCargando(false); return }
    let cancelado = false
    supabase.from('profiles').select('idioma').eq('id', userId).single().then(({ data }) => {
      if (cancelado) return
      setIdiomaState((data?.idioma as Idioma) ?? 'es')
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [userId])

  async function cambiarIdioma(nuevo: Idioma) {
    setIdiomaState(nuevo)
    if (userId) await supabase.from('profiles').update({ idioma: nuevo }).eq('id', userId)
  }

  const t = useCallback(
    (clave: ClaveTraduccion, vars?: Record<string, string | number>) => traducir(clave, idioma, vars),
    [idioma]
  )

  return <IdiomaContext.Provider value={{ idioma, cargando, cambiarIdioma, t }}>{children}</IdiomaContext.Provider>
}

export function useIdioma() {
  const ctx = useContext(IdiomaContext)
  if (!ctx) throw new Error('useIdioma() se usó fuera de <IdiomaProvider>')
  return ctx
}

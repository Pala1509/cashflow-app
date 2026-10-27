import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { t as traducir, type Idioma, type ClaveTraduccion } from '../lib/i18n'

export function useIdioma(userId: string | null) {
  const [idioma, setIdiomaState] = useState<Idioma>('es')

  useEffect(() => {
    if (!userId) return
    let cancelado = false
    supabase.from('profiles').select('idioma').eq('id', userId).single().then(({ data }) => {
      if (cancelado) return
      setIdiomaState((data?.idioma as Idioma) ?? 'es')
    })
    return () => { cancelado = true }
  }, [userId])

  async function cambiarIdioma(nuevo: Idioma) {
    setIdiomaState(nuevo)
    if (userId) await supabase.from('profiles').update({ idioma: nuevo }).eq('id', userId)
  }

  // useCallback para que t no cambie de referencia en cada render — evita
  // que un useEffect que dependa de t se re-ejecute sin necesidad.
  const t = useCallback(
    (clave: ClaveTraduccion, vars?: Record<string, string | number>) => traducir(clave, idioma, vars),
    [idioma]
  )

  return { idioma, cambiarIdioma, t }
}

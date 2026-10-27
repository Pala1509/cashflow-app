import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Hook liviano y standalone (a propósito NO pasa por useFinanzas, que ya
// carga bastante de por sí con su cache offline-first) — solo lee el país
// guardado del usuario, para las pantallas puntuales que lo necesitan
// (selector de bancos, perfil) sin arrastrar todo lo demás.
export function usePais(): { pais: string | null; loading: boolean } {
  const { user } = useAuth()
  const [pais, setPais] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelado = false
    supabase
      .from('profiles')
      .select('pais')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelado) return
        setPais(data?.pais ?? null)
        setLoading(false)
      })
    return () => { cancelado = true }
  }, [user])

  return { pais, loading }
}

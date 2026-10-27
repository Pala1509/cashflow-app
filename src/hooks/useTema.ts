import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Tema = 'dark' | 'light'

// Se guarda en profiles (servidor), como moneda e idioma — así el tema
// viaja con la cuenta, no se queda pegado a un solo dispositivo.
export function useTema(userId: string | null) {
  const [tema, setTemaState] = useState<Tema>('dark')

  useEffect(() => {
    if (!userId) return
    let cancelado = false
    supabase.from('profiles').select('tema').eq('id', userId).single().then(({ data }) => {
      if (cancelado) return
      const t = (data?.tema as Tema) ?? 'dark'
      setTemaState(t)
      document.documentElement.setAttribute('data-theme', t)
    })
    return () => { cancelado = true }
  }, [userId])

  async function cambiarTema(nuevo: Tema) {
    setTemaState(nuevo)
    document.documentElement.setAttribute('data-theme', nuevo)
    if (userId) await supabase.from('profiles').update({ tema: nuevo }).eq('id', userId)
  }

  return { tema, cambiarTema }
}

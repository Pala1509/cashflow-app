import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { BancoPersonalizado } from '../lib/database.types'

// Bancos que el usuario agrega porque no están en la lista predeterminada
// (BANCOS_GRUPOS en Cuentas.tsx) — se usan tanto en Perfil → Preferencias
// → Bancos (para agregarlos/borrarlos) como en el selector de banco de
// CuentaNueva.tsx (para que aparezcan como opción al crear una cuenta).
export function useBancosPersonalizados() {
  const { user } = useAuth()
  const [bancos, setBancos] = useState<BancoPersonalizado[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) { setBancos([]); setLoading(false); return }
    const { data } = await supabase.from('bancos_personalizados').select('*').eq('user_id', user.id).order('nombre')
    setBancos((data as BancoPersonalizado[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { bancos, loading, reload }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export type ProDuoEstado = 'pendiente' | 'activo' | 'finalizado'

export interface ProDuoRow {
  id: string
  inviter_id: string
  invitado_id: string | null
  codigo: string
  estado: ProDuoEstado
  created_at: string
  vinculado_at: string | null
  finalizado_at: string | null
}

// Estado de Pro Dúo del usuario actual: si ya invitó a alguien (o lo
// invitaron a él), el código pendiente si aplica, y el nombre de la
// pareja vinculada. Se usa desde Perfil, Cuentas (banner) y la pantalla
// dedicada de Pro Dúo.
export function useProDuo() {
  const { user } = useAuth()
  const [row, setRow] = useState<ProDuoRow | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('pro_duo')
      .select('*')
      .or(`inviter_id.eq.${user.id},invitado_id.eq.${user.id}`)
      .in('estado', ['pendiente', 'activo'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const r = (data as ProDuoRow) ?? null
    setRow(r)

    if (r && r.estado === 'activo') {
      const partnerId = r.inviter_id === user.id ? r.invitado_id : r.inviter_id
      if (partnerId) {
        const { data: perfil } = await supabase.from('profiles').select('nombre').eq('id', partnerId).single()
        setPartnerName(perfil?.nombre ?? null)
      }
    } else {
      setPartnerName(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  async function crearCodigo(): Promise<ProDuoRow | null> {
    setError(null)
    const { data, error: err } = await supabase.rpc('crear_codigo_pro_duo')
    if (err) { setError(err.message); return null }
    await reload()
    return data as ProDuoRow
  }

  async function canjearCodigo(codigo: string): Promise<boolean> {
    setError(null)
    const { error: err } = await supabase.rpc('canjear_codigo_pro_duo', { p_codigo: codigo.trim() })
    if (err) { setError(err.message); return false }
    await reload()
    return true
  }

  async function desvincular(id: string) {
    setError(null)
    const { error: err } = await supabase.rpc('desvincular_pro_duo', { p_id: id })
    if (err) { setError(err.message); return false }
    await reload()
    return true
  }

  return { row, partnerName, loading, error, setError, reload, crearCodigo, canjearCodigo, desvincular }
}

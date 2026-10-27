import { supabase } from './supabase'

// Se guarda en profiles (servidor), no en localStorage — así queda
// ligado a la CUENTA, no al navegador/dispositivo.
export async function tourVisto(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('cashflow_onboarding_visto').eq('id', userId).single()
  return data?.cashflow_onboarding_visto ?? false
}

export async function marcarTourVisto(userId: string) {
  await supabase.from('profiles').update({ cashflow_onboarding_visto: true }).eq('id', userId)
}

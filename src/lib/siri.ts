import { Capacitor, registerPlugin } from '@capacitor/core'
import { supabase } from './supabase'

// "Anotar con Siri" (solo iOS). El App Intent nativo
// (ios/App/App/CashFlowSiri.swift) corre fuera del WebView, así que no
// puede usar la sesión de Supabase. En su lugar usa un token propio que
// se genera acá con la RPC crear_token_siri() y se guarda con el plugin
// Preferences, que en iOS escribe en UserDefaults con la llave
// "CapacitorStorage.siri_token" — la misma que lee el Swift.
//
// Se usa registerPlugin directo (es exactamente lo que hace
// @capacitor/preferences por dentro) para no depender de sus tipos; el
// paquete igual tiene que estar instalado para que `cap sync` agregue la
// parte nativa.

interface PreferencesPlugin {
  get(o: { key: string }): Promise<{ value: string | null }>
  set(o: { key: string; value: string }): Promise<void>
  remove(o: { key: string }): Promise<void>
}

const Preferences = registerPlugin<PreferencesPlugin>('Preferences')
const LLAVE = 'siri_token'

export const siriDisponible = () => Capacitor.getPlatform() === 'ios'
// En Android el mismo token lo usa "Anotar con voz" (widget 🎤 y accesos
// directos del ícono — ver android/.../VozActivity.java). Preferences en
// Android guarda en SharedPreferences "CapacitorStorage", que es lo que lee
// la Activity nativa.
export const vozNativaDisponible = () => ['ios', 'android'].includes(Capacitor.getPlatform())

export async function siriActivado(): Promise<boolean> {
  if (!vozNativaDisponible()) return false
  try {
    const { value } = await Preferences.get({ key: LLAVE })
    return Boolean(value)
  } catch {
    return false
  }
}

const LLAVE_USUARIO = 'siri_usuario'
const LLAVE_APAGADO = 'siri_apagado'
const LLAVE_ANUNCIO = 'siri_anuncio_visto'

async function leer(key: string): Promise<string | null> {
  try { return (await Preferences.get({ key })).value } catch { return null }
}

export async function activarSiri(userId?: string): Promise<void> {
  const { data, error } = await supabase.rpc('crear_token_siri')
  if (error) throw new Error(error.message)
  if (typeof data !== 'string' || !data) throw new Error('Respuesta inválida')
  await Preferences.set({ key: LLAVE, value: data })
  if (userId) await Preferences.set({ key: LLAVE_USUARIO, value: userId })
  try { await Preferences.remove({ key: LLAVE_APAGADO }) } catch { /* nada */ }
}

// Activación automática: al entrar a la app en iPhone, si este dispositivo
// no tiene token (o el token es de OTRA cuenta que inició sesión antes),
// se genera uno solo — así "Oye Siri, agrega un gasto a CashFlow" funciona
// sin que el usuario tenga que encontrar el interruptor. Respeta si el
// usuario lo desconectó a propósito desde Perfil → Anotar con Siri.
// Devuelve true si lo acaba de activar (para mostrar el aviso una vez).
export async function asegurarSiri(userId: string): Promise<boolean> {
  if (!vozNativaDisponible()) return false
  if ((await leer(LLAVE_APAGADO)) === '1') return false
  const [token, dueno] = await Promise.all([leer(LLAVE), leer(LLAVE_USUARIO)])
  if (token && dueno === userId) return false
  await activarSiri(userId)
  return true
}

export async function anuncioSiriVisto(): Promise<boolean> {
  return (await leer(LLAVE_ANUNCIO)) === '1'
}

export async function marcarAnuncioSiriVisto(): Promise<void> {
  try { await Preferences.set({ key: LLAVE_ANUNCIO, value: '1' }) } catch { /* nada */ }
}

// Borra el token de este dispositivo y revoca TODOS los tokens de Siri del
// usuario en el servidor (si tenía otro iPhone conectado, también se
// desconecta — es lo más seguro y lo más simple de entender). Queda
// marcado como apagado para que la activación automática no lo reviva.
export async function desactivarSiri(userId: string): Promise<void> {
  await supabase.from('siri_tokens').delete().eq('user_id', userId)
  try {
    await Preferences.remove({ key: LLAVE })
    await Preferences.remove({ key: LLAVE_USUARIO })
    await Preferences.set({ key: LLAVE_APAGADO, value: '1' })
  } catch { /* ya no estaba */ }
}

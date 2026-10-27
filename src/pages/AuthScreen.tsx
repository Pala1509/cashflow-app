import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Mail, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react'
import fondoAuth from '../assets/splash/cashflow_background.webp'
import { useIdioma } from '../lib/IdiomaContext'
import { PAISES } from '../lib/paises'

type Mode = 'login' | 'signup' | 'forgot'

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, resetPasswordForEmail } = useAuth()
  const { t } = useIdioma()

  const [mode, setMode] = useState<Mode>('login')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [pais, setPais] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupEmailSent, setSignupEmailSent] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [verPassword, setVerPassword] = useState(false)

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await resetPasswordForEmail(email)
    setLoading(false)
    if (result.error) setError(mensajeErrorSeguro(result.error))
    else setForgotSent(true)
  }

  // Supabase a veces devuelve un error casi vacío (o literalmente "{}")
  // cuando la falla real pasó del lado del servidor (ej. un trigger de
  // la base de datos que se rompió al crear el perfil) — mostrar eso
  // crudo en pantalla es peor que no mostrar nada. Si el mensaje no se
  // ve como un mensaje real, se cambia por uno genérico.
  function mensajeErrorSeguro(msg: string): string {
    const limpio = msg.trim()
    if (!limpio || limpio === '{}' || limpio === '[object Object]' || limpio.length < 3) {
      return t('auth_error_generico')
    }
    return limpio
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result =
      mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password, nombre, apellido, telefono, pais)
    setLoading(false)
    if (result.error) setError(mensajeErrorSeguro(result.error))
    else if (mode === 'signup') setSignupEmailSent(true)
  }

  async function handleResend() {
    setResendMsg(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResendMsg(error ? { ok: false, text: 'No se pudo reenviar: ' + error.message } : { ok: true, text: 'Correo reenviado' })
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-8"
      style={{ background: 'var(--bg)', backgroundImage: `url(${fondoAuth})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {forgotSent ? (
        <>
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            <Mail size={28} />
          </div>
          <div className="text-lg font-bold font-display text-center">{t('auth_revisa_correo')}</div>
          <div className="mt-2.5 max-w-xs text-center text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {t('auth_forgot_enviado_pre')} <b style={{ color: 'var(--text-1)' }}>{email}</b> {t('auth_forgot_enviado_post')}
          </div>
          <button
            onClick={() => { setForgotSent(false); setMode('login') }}
            className="mt-5 flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--text-3)' }}
          >
            <ArrowLeft size={13} /> {t('auth_volver_login')}
          </button>
        </>
      ) : signupEmailSent ? (
        <>
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            <Mail size={28} />
          </div>
          <div className="text-lg font-bold font-display text-center">{t('auth_revisa_correo')}</div>
          <div className="mt-2.5 max-w-xs text-center text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {t('auth_signup_enviado_pre')} <b style={{ color: 'var(--text-1)' }}>{email}</b>. {t('auth_signup_enviado_post')}
          </div>
          {resendMsg && (
            <div className="mt-3 flex items-center justify-center gap-1 text-xs" style={{ color: resendMsg.ok ? 'var(--lime)' : 'var(--coral)' }}>
              {resendMsg.ok && <Check size={13} />} {resendMsg.text}
            </div>
          )}
          <button onClick={handleResend} className="mt-5 rounded-2xl px-5 py-3 text-[13px] font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
            {t('auth_reenviar_correo')}
          </button>
          <button
            onClick={() => { setSignupEmailSent(false); setMode('login'); setPassword('') }}
            className="mt-4 flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--text-3)' }}
          >
            <ArrowLeft size={13} /> {t('auth_volver_login')}
          </button>
        </>
      ) : (
        <>
      <div className="mb-2">
        <Logo size={80} rounded={22} />
      </div>
      <div className="mt-4 text-2xl font-bold font-display">CashFlow</div>
      <div className="mb-8 text-sm" style={{ color: 'var(--text-2)' }}>
        {t('auth_tagline')}
      </div>

      {mode === 'forgot' ? (
        <form onSubmit={handleForgotSubmit} className="w-full max-w-xs space-y-3">
          <div className="mb-1 text-center text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {t('auth_forgot_instruccion')}
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth_placeholder_correo')}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
            required
          />
          {error && <div className="text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
          >
            {loading ? t('auth_un_momento') : t('auth_enviar_link')}
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className="flex w-full items-center justify-center gap-1.5 text-center text-xs"
            style={{ color: 'var(--text-3)' }}
          >
            <ArrowLeft size={13} /> {t('auth_volver_login')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmailSubmit} className="w-full max-w-xs space-y-3">
          {mode === 'signup' && (
            <>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t('auth_placeholder_nombre')}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
                required
              />
              <input
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder={t('auth_placeholder_apellido')}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
                required
              />
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder={t('auth_placeholder_celular')}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
                required
              />
              {/* País — de entrada solo le mostramos a la persona los bancos
              de su propio continente (ver BANCOS_GRUPOS/continenteDe en
              CuentaNueva.tsx); sin esto no hay cómo saber cuál mostrarle. */}
              <select
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: pais ? 'var(--text-1)' : 'var(--text-3)' }}
                required
              >
                <option value="" disabled>{t('auth_placeholder_pais')}</option>
                {PAISES.map((p) => (
                  <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth_placeholder_correo')}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
            required
          />
          <div className="relative">
            <input
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth_placeholder_contrasena')}
              className="cf-password-input w-full rounded-2xl px-4 py-3 pr-11 text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center"
              style={{ color: 'var(--text-2)' }}
              tabIndex={-1}
            >
              {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null) }}
              className="block w-full text-right text-[11px] font-bold"
              style={{ color: 'var(--text-1)' }}
            >
              {t('auth_olvidaste')}
            </button>
          )}
          {error && <div className="text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
          >
            {loading ? t('auth_un_momento') : mode === 'login' ? t('auth_entrar') : t('auth_crear_cuenta')}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className="w-full text-center text-xs font-bold"
            style={{ color: 'var(--lime)' }}
          >
            {mode === 'login' ? t('auth_no_tienes_cuenta') : t('auth_ya_tienes_cuenta')}
          </button>
        </form>
      )}
        </>
      )}
    </div>
  )
}

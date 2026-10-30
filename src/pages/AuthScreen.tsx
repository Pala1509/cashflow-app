import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { Mail, ArrowLeft, Check, Eye, EyeOff, AtSign, X, Loader2 } from 'lucide-react'
import fondoAuth from '../assets/splash/cashflow_background.webp'
import { useIdioma } from '../lib/IdiomaContext'
import { PAISES } from '../lib/paises'
import OnboardingGuiado, { MarcoOnb, BotonOnb } from '../components/OnboardingGuiado'
import { type DatosOnboarding, guardarPendiente, borrarPendiente } from '../lib/onboardingDatos'

// Registro nuevo: primero las preguntas del onboarding guiado (objetivo,
// nómina, banco, cuentas, deudas, fijos) y AL FINAL el formulario de la
// cuenta (nombre, apellido, nickname, correo, país, contraseña). Las
// respuestas se guardan en el celular y se aplican apenas haya sesión
// (ver OnboardingFlujo en AppShell), así funciona aunque Supabase pida
// confirmar el correo. El inicio de sesión acepta correo O nickname.

type Mode = 'login' | 'registro' | 'signup' | 'forgot'

const NICK_RE = /^[a-z0-9_.]{3,20}$/
const sugerirNick = (nombre: string, apellido: string) =>
  [nombre, apellido].map((s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')).filter(Boolean).join('.').slice(0, 20)

const inputStyle = { background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, resetPasswordForEmail } = useAuth()
  const { t } = useIdioma()

  const [mode, setMode] = useState<Mode>('login')
  const [datosOnb, setDatosOnb] = useState<DatosOnboarding | null>(null)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [nickname, setNickname] = useState('')
  const [nickTocado, setNickTocado] = useState(false)
  const [nickEstado, setNickEstado] = useState<'vacio' | 'revisando' | 'libre' | 'ocupado' | 'invalido'>('vacio')
  const [pais, setPais] = useState('Colombia')
  const [email, setEmail] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupEmailSent, setSignupEmailSent] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [verPassword, setVerPassword] = useState(false)

  // Nickname sugerido a partir del nombre mientras la persona no lo toque.
  useEffect(() => {
    if (!nickTocado) setNickname(sugerirNick(nombre, apellido))
  }, [nombre, apellido, nickTocado])

  // ¿Está libre? (con una pausa para no consultar en cada tecla)
  useEffect(() => {
    const n = nickname.trim().toLowerCase()
    if (!n) { setNickEstado('vacio'); return }
    if (!NICK_RE.test(n)) { setNickEstado('invalido'); return }
    setNickEstado('revisando')
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc('nickname_disponible', { p_nickname: n })
      if (error) { setNickEstado('vacio'); return }
      setNickEstado(data ? 'libre' : 'ocupado')
    }, 450)
    return () => clearTimeout(id)
  }, [nickname])

  // Supabase a veces devuelve un error casi vacío (o literalmente "{}")
  // cuando la falla real pasó del lado del servidor — mostrar eso crudo es
  // peor que no mostrar nada.
  function mensajeErrorSeguro(msg: string): string {
    const limpio = msg.trim()
    if (!limpio || limpio === '{}' || limpio === '[object Object]' || limpio.length < 3) return t('auth_error_generico')
    if (/already registered|already been registered/i.test(limpio)) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
    if (/invalid login credentials/i.test(limpio)) return 'Usuario o contraseña incorrectos'
    return limpio
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await resetPasswordForEmail(email)
    setLoading(false)
    if (result.error) setError(mensajeErrorSeguro(result.error))
    else setForgotSent(true)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await signInWithEmail(usuario, password)
    setLoading(false)
    if (result.error) setError(mensajeErrorSeguro(result.error))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (nickEstado === 'ocupado') { setError('Ese nickname ya está en uso, prueba otro.'); return }
    if (nickEstado === 'invalido') { setError('El nickname solo puede tener letras, números, punto y guion bajo (3 a 20).'); return }
    setLoading(true)
    // Las respuestas quedan en el celular ANTES de crear la cuenta: si la
    // app se cierra o pide confirmar el correo, igual se aplican al entrar.
    guardarPendiente(email, datosOnb)
    const result = await signUpWithEmail({ email, password, nombre, apellido, pais, nickname: nickname.trim().toLowerCase() })
    setLoading(false)
    if (result.error) { borrarPendiente(); setError(mensajeErrorSeguro(result.error)); return }
    // Con sesión, App navega solo a /inicio y AppShell aplica los datos.
    if (!result.conSesion) setSignupEmailSent(true)
  }

  async function handleResend() {
    setResendMsg(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResendMsg(error ? { ok: false, text: 'No se pudo reenviar: ' + error.message } : { ok: true, text: 'Correo reenviado' })
  }

  // ---------- registro: primero las preguntas ----------
  if (mode === 'registro') {
    return (
      <OnboardingGuiado
        inicial={datosOnb ?? undefined}
        pasoInicial={datosOnb ? 6 : 0}
        textoFinal="Continuar"
        textoSaltar="Saltar y crear mi cuenta"
        onCompletar={(d) => { setDatosOnb(d); setMode('signup'); setError(null) }}
        onSaltar={() => { setDatosOnb(null); setMode('signup'); setError(null) }}
        onSalirInicio={() => { setMode('login'); setError(null) }}
      />
    )
  }

  // ---------- registro: al final, la cuenta ----------
  if (mode === 'signup' && !signupEmailSent) {
    const nickInfo =
      nickEstado === 'revisando' ? { color: 'var(--text-2)', texto: 'Revisando…', icon: <Loader2 size={14} className="animate-spin" /> }
      : nickEstado === 'libre' ? { color: 'var(--lime)', texto: 'Disponible', icon: <Check size={14} /> }
      : nickEstado === 'ocupado' ? { color: 'var(--coral)', texto: 'Ya está en uso', icon: <X size={14} /> }
      : nickEstado === 'invalido' ? { color: 'var(--coral)', texto: 'Solo letras, números, punto y _ (3 a 20)', icon: <X size={14} /> }
      : { color: 'var(--text-2)', texto: 'Con esto también puedes entrar, sin escribir el correo', icon: null }
    const listo = nombre.trim() && apellido.trim() && email.trim() && password.length >= 6 && pais && nickEstado !== 'ocupado' && nickEstado !== 'invalido' && nickEstado !== 'revisando'
    return (
      <form onSubmit={handleSignup}>
        <MarcoOnb
          paso={7}
          onAtras={() => { setMode('registro'); setError(null) }}
          onYaTengoCuenta={() => { setMode('login'); setError(null) }}
          pie={
            <>
              <BotonOnb type="submit" disabled={!listo || loading}>{loading ? t('auth_un_momento') : 'Crear mi cuenta'}</BotonOnb>
              <button type="button" onClick={() => { setMode('login'); setError(null) }} className="flex w-full items-center justify-center text-[13px] font-bold" style={{ height: 40, color: 'var(--lime)' }}>{t('auth_ya_tienes_cuenta')}</button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] font-bold leading-tight font-display" style={{ color: 'var(--text-1)' }}>Crea tu cuenta</h1>
            <p className="m-0 text-[15px]" style={{ color: 'var(--text-2)' }}>{datosOnb ? 'Último paso: así guardamos todo lo que nos contaste.' : 'Último paso y entras a CashFlow.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" required className="w-full rounded-2xl px-4 text-[15px] outline-none" style={{ ...inputStyle, height: 52 }} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Apellido</span>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" required className="w-full rounded-2xl px-4 text-[15px] outline-none" style={{ ...inputStyle, height: 52 }} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Nickname</span>
            <div className="flex items-center gap-2 rounded-2xl px-4" style={{ ...inputStyle, height: 52, borderColor: nickEstado === 'libre' ? 'var(--lime)' : nickEstado === 'ocupado' || nickEstado === 'invalido' ? 'var(--coral)' : 'var(--line)' }}>
              <AtSign size={17} color="var(--text-2)" />
              <input value={nickname} onChange={(e) => { setNickTocado(true); setNickname(e.target.value.toLowerCase().replace(/\s/g, '')) }} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: 'var(--text-1)' }} placeholder="tu.nickname" />
            </div>
            <span className="flex items-center gap-1 text-[12px]" style={{ color: nickInfo.color }}>{nickInfo.icon}{nickInfo.texto}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Correo electrónico</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" required className="w-full rounded-2xl px-4 text-[15px] outline-none" style={{ ...inputStyle, height: 52 }} />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            {/* País — de entrada solo le mostramos los bancos de su continente
            (ver continenteDe en CuentaNueva.tsx). */}
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>País</span>
              <select value={pais} onChange={(e) => setPais(e.target.value)} required className="w-full rounded-2xl px-3 text-[15px] outline-none" style={{ ...inputStyle, height: 52 }}>
                {PAISES.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Contraseña</span>
              <div className="relative">
                <input type={verPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6}
                  className="cf-password-input w-full rounded-2xl pl-4 pr-10 text-[15px] outline-none" style={{ ...inputStyle, height: 52 }} placeholder="6+ caracteres" />
                <button type="button" aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'} onClick={() => setVerPassword((x) => !x)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center" style={{ color: 'var(--text-2)' }}>
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          </div>

          {error && <div className="rounded-xl p-3 text-[13px]" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>{error}</div>}
        </MarcoOnb>
      </form>
    )
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
          <button onClick={() => { setForgotSent(false); setMode('login') }} className="mt-5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
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
          {datosOnb && (
            <div className="mt-3 max-w-xs text-center text-[12px]" style={{ color: 'var(--lime)' }}>
              Tus respuestas quedaron guardadas: apenas entres, tu CashFlow arranca con ellas.
            </div>
          )}
          {resendMsg && (
            <div className="mt-3 flex items-center justify-center gap-1 text-xs" style={{ color: resendMsg.ok ? 'var(--lime)' : 'var(--coral)' }}>
              {resendMsg.ok && <Check size={13} />} {resendMsg.text}
            </div>
          )}
          <button onClick={handleResend} className="mt-5 rounded-2xl px-5 py-3 text-[13px] font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
            {t('auth_reenviar_correo')}
          </button>
          <button onClick={() => { setSignupEmailSent(false); setMode('login'); setPassword(''); setUsuario(nickname || email) }} className="mt-4 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <ArrowLeft size={13} /> {t('auth_volver_login')}
          </button>
        </>
      ) : (
        <>
          <div className="mb-2">
            <Logo size={80} rounded={22} />
          </div>
          <div className="mt-4 text-2xl font-bold font-display">CashFlow</div>
          <div className="mb-8 text-sm" style={{ color: 'var(--text-2)' }}>{t('auth_tagline')}</div>

          {mode === 'forgot' ? (
            <form onSubmit={handleForgotSubmit} className="w-full max-w-xs space-y-3">
              <div className="mb-1 text-center text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t('auth_forgot_instruccion')}</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth_placeholder_correo')} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={inputStyle} required />
              {error && <div className="text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
                {loading ? t('auth_un_momento') : t('auth_enviar_link')}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(null) }} className="flex w-full items-center justify-center gap-1.5 text-center text-xs" style={{ color: 'var(--text-3)' }}>
                <ArrowLeft size={13} /> {t('auth_volver_login')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Correo o nickname"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
                required
              />
              <div className="relative">
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth_placeholder_contrasena')}
                  autoComplete="current-password"
                  className="cf-password-input w-full rounded-2xl px-4 py-3 pr-11 text-sm outline-none"
                  style={inputStyle}
                  required
                />
                <button type="button" aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'} onClick={() => setVerPassword((x) => !x)} className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center" style={{ color: 'var(--text-2)' }} tabIndex={-1}>
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <button type="button" onClick={() => { setMode('forgot'); setError(null); if (usuario.includes('@')) setEmail(usuario) }} className="block w-full text-right text-[11px] font-bold" style={{ color: 'var(--text-1)' }}>
                {t('auth_olvidaste')}
              </button>
              {error && <div className="text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
                {loading ? t('auth_un_momento') : t('auth_entrar')}
              </button>
              <button type="button" onClick={() => { setMode('registro'); setError(null) }} className="w-full text-center text-xs font-bold" style={{ color: 'var(--lime)' }}>
                {t('auth_no_tienes_cuenta')}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

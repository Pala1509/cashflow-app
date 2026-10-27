import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { useIdioma } from '../lib/IdiomaContext'

// A esta pantalla llega la gente desde el link del correo de "recuperar
// contraseña" — Supabase procesa el token que viene en la URL solo con
// cargar la página, y te deja con una sesión temporal de "recuperación"
// (evento PASSWORD_RECOVERY). No hace falta que hayas iniciado sesión
// normal para llegar aquí — por eso vive fuera de las rutas protegidas.
export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useIdioma()
  const { updatePassword } = useAuth()
  const [listo, setListo] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setListo(true)
    })
    // Por si el evento ya disparó antes de montar este componente (pasa a
    // veces con el primer render), revisa también si ya hay una sesión.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setListo(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError(t('rp_error_min_caracteres')); return }
    if (password !== password2) { setError(t('rp_error_no_coincide')); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) { setError(error); return }
    setOk(true)
    setTimeout(() => navigate('/inicio'), 1800)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8" style={{ background: 'var(--bg)' }}>
      <div className="mb-5" style={{ filter: 'drop-shadow(0 0 40px rgba(198,255,77,0.35))' }}>
        <Logo size={72} rounded={20} />
      </div>

      {ok ? (
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            <Check size={28} />
          </div>
          <div className="text-lg font-bold font-display text-center">{t('rp_listo_titulo')}</div>
          <div className="mt-2 max-w-xs text-center text-[12.5px]" style={{ color: 'var(--text-2)' }}>
            {t('rp_listo_texto')}
          </div>
        </>
      ) : !listo ? (
        <>
          <div className="text-lg font-bold font-display text-center">{t('rp_abriendo_titulo')}</div>
          <div className="mt-2 max-w-xs text-center text-[12.5px]" style={{ color: 'var(--text-2)' }}>
            {t('rp_abriendo_texto')}
          </div>
        </>
      ) : (
        <>
          <div className="mb-1.5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--lavender-dim)', color: 'var(--lavender)' }}>
            <Lock size={24} />
          </div>
          <div className="mb-6 mt-3 text-lg font-bold font-display text-center">{t('rp_titulo')}</div>
          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('rp_placeholder_nueva')}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
              required
              minLength={6}
            />
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder={t('rp_placeholder_repite')}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
              required
              minLength={6}
            />
            {error && <div className="text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
              style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
            >
              {loading ? t('rp_guardando') : t('rp_guardar')}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

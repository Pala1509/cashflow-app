import { useState } from 'react'
import { Mail, Check, LogOut } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import Logo from './Logo'

export default function EmailBloqueado() {
  const { user, resendConfirmation, signOut } = useAuth()
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    if (!user?.email) return
    setSending(true)
    setError(null)
    const { error } = await resendConfirmation(user.email)
    setSending(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8" style={{ background: 'var(--bg)' }}>
      <Logo size={64} rounded={18} />
      <div className="mb-5 mt-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
        <Mail size={28} />
      </div>
      <div className="text-lg font-bold font-display text-center">Confirma tu correo para seguir</div>
      <div className="mt-2.5 max-w-xs text-center text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Pasaron los 5 días para confirmar <b style={{ color: 'var(--text-1)' }}>{user?.email}</b>. Confírmalo para volver a entrar — tus datos siguen ahí, no se perdió nada.
      </div>

      {sent ? (
        <div className="mt-5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lime)' }}>
          <Check size={13} /> Correo reenviado — revisa tu bandeja
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending}
          className="mt-5 rounded-2xl px-5 py-3 text-[13px] font-bold disabled:opacity-50"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          {sending ? 'Enviando…' : 'Reenviar correo de confirmación'}
        </button>
      )}
      {error && <div className="mt-2 text-xs" style={{ color: 'var(--coral)' }}>{error}</div>}

      <button onClick={() => signOut()} className="mt-6 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
        <LogOut size={13} /> Cerrar sesión
      </button>
    </div>
  )
}

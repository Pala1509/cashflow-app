import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { PIN_STORAGE_KEY } from '../lib/pinGate'
import { useIdioma } from '../lib/IdiomaContext'

export default function SeguridadPin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  const isEmailUser = Boolean(user?.email)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [passwordOk, setPasswordOk] = useState(false)

  const [pinEnabled, setPinEnabled] = useState(Boolean(localStorage.getItem(PIN_STORAGE_KEY)))
  const [settingPin, setSettingPin] = useState(false)
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinMsg, setPinMsg] = useState<string | null>(null)

  async function changePassword() {
    if (newPassword.length < 6) { setPasswordMsg(t('sp_min_caracteres')); setPasswordOk(false); return }
    setSavingPassword(true)
    setPasswordMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { setPasswordMsg(error.message); setPasswordOk(false) }
    else { setPasswordMsg(t('sp_contrasena_actualizada')); setPasswordOk(true); setNewPassword('') }
  }

  function togglePin() {
    if (pinEnabled) {
      localStorage.removeItem(PIN_STORAGE_KEY)
      sessionStorage.removeItem('cashflow_pin_unlocked')
      setPinEnabled(false)
      setSettingPin(false)
    } else {
      setSettingPin(true)
    }
  }

  function savePin() {
    setPinMsg(null)
    if (!/^\d{4}$/.test(pin1)) { setPinMsg(t('sp_pin_4_digitos')); return }
    if (pin1 !== pin2) { setPinMsg(t('sp_pin_no_coincide')); return }
    localStorage.setItem(PIN_STORAGE_KEY, pin1)
    sessionStorage.setItem('cashflow_pin_unlocked', '1')
    setPinEnabled(true)
    setSettingPin(false)
    setPin1(''); setPin2('')
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('sp_titulo')}</div>
        <button onClick={() => navigate('/perfil')} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {isEmailUser ? (
          <>
            <FieldLabel>{t('sp_cambiar_contrasena')}</FieldLabel>
            <InputRow icon={<Lock size={16} />} type="password" placeholder={t('sp_placeholder_nueva')} value={newPassword} onChange={setNewPassword} />
            {passwordMsg && <div className="mb-2 text-xs" style={{ color: passwordOk ? 'var(--lime)' : 'var(--coral)' }}>{passwordMsg}</div>}
            <button
              onClick={changePassword}
              disabled={savingPassword || !newPassword}
              className="w-full rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
            >
              {savingPassword ? t('sp_guardando') : t('sp_actualizar_contrasena')}
            </button>
          </>
        ) : (
          <div className="rounded-2xl p-3.5 text-xs leading-relaxed" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
            {t('sp_otp_nota')}
          </div>
        )}

        <FieldLabel>{t('sp_bloqueo_pin')}</FieldLabel>
        <div className="rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={16} style={{ color: 'var(--text-2)' }} />
              <div>
                <div className="text-[12.5px]">{t('sp_pedir_pin')}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-3)' }}>{t('sp_pin_nota')}</div>
              </div>
            </div>
            <button onClick={togglePin} className="relative flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: pinEnabled ? 'var(--lime)' : 'var(--card-2)' }}>
              <div className="absolute top-0.5 rounded-full transition-all" style={{ width: 18, height: 18, background: pinEnabled ? 'var(--lime-text)' : 'var(--text-3)', left: pinEnabled ? 18 : 2 }} />
            </button>
          </div>

          {settingPin && (
            <div className="mt-3.5" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <InputRow icon={<Lock size={16} />} type="password" placeholder={t('sp_nuevo_pin')} value={pin1} onChange={(v) => setPin1(v.replace(/\D/g, '').slice(0, 4))} />
              <InputRow icon={<Lock size={16} />} type="password" placeholder={t('sp_repite_pin')} value={pin2} onChange={(v) => setPin2(v.replace(/\D/g, '').slice(0, 4))} />
              {pinMsg && <div className="mb-2 text-xs" style={{ color: 'var(--coral)' }}>{pinMsg}</div>}
              <button onClick={savePin} className="w-full rounded-2xl py-3 text-[13px] font-semibold" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
                {t('sp_guardar_pin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

function InputRow({ icon, placeholder, value, onChange, type }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-1)' }}
      />
    </div>
  )
}

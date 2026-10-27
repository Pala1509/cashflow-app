import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Mic, Check } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useIdioma } from '../lib/IdiomaContext'
import { appAlert, appConfirm } from '../lib/dialogs'
import { activarSiri, desactivarSiri, siriActivado, siriDisponible } from '../lib/siri'

// Perfil → Anotar con Siri. Conecta este iPhone con el App Intent nativo
// (ver lib/siri.ts y ios/App/App/CashFlowSiri.swift) y explica cómo se usa.
export default function Siri() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  const [activo, setActivo] = useState<boolean | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    siriActivado().then(setActivo)
  }, [])

  async function activar() {
    setTrabajando(true)
    try {
      await activarSiri(user?.id)
      setActivo(true)
    } catch (e) {
      await appAlert(t('siri_error_activar', { msg: e instanceof Error ? e.message : String(e) }))
    } finally {
      setTrabajando(false)
    }
  }

  async function desactivar() {
    if (!user) return
    if (!(await appConfirm(t('siri_confirmar_desactivar'), { danger: true }))) return
    setTrabajando(true)
    try {
      await desactivarSiri(user.id)
      setActivo(false)
    } catch (e) {
      await appAlert(t('siri_error_activar', { msg: e instanceof Error ? e.message : String(e) }))
    } finally {
      setTrabajando(false)
    }
  }

  const ejemplos = [t('siri_ejemplo_1'), t('siri_ejemplo_2'), t('siri_ejemplo_3'), t('siri_ejemplo_4'), t('siri_ejemplo_5')]

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('siri_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:flex md:justify-center">
        <div className="md:w-[420px]">
          <div className="mt-2 rounded-3xl p-5" style={{ background: 'var(--lime)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#000000', color: 'var(--lime)' }}>
              <Mic size={18} />
            </div>
            <div className="text-[17px] font-bold font-display" style={{ color: '#000000' }}>{t('siri_hero_titulo')}</div>
            <div className="mt-1 text-[12px] leading-relaxed" style={{ color: '#000000', opacity: 0.75 }}>{t('siri_hero_texto')}</div>
          </div>

          {!siriDisponible() && (
            <div className="mt-4 rounded-2xl p-3.5 text-[11.5px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
              {t('siri_solo_ios')}
            </div>
          )}

          {siriDisponible() && (
            <>
              <div className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: activo ? 'var(--lime)' : 'var(--text-3)' }} />
                <div className="flex-1 text-[13px]">{activo === null ? '…' : activo ? t('siri_estado_activo') : t('siri_estado_inactivo')}</div>
                {activo && <Check size={16} style={{ color: 'var(--lime)' }} />}
              </div>

              <button
                disabled={trabajando || activo === null}
                onClick={activo ? desactivar : activar}
                className="mt-3 w-full rounded-2xl py-3.5 text-[14px] font-semibold"
                style={activo
                  ? { background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--coral)', opacity: trabajando ? 0.6 : 1 }
                  : { background: 'var(--lime)', color: '#000000', opacity: trabajando ? 0.6 : 1 }}
              >
                {trabajando ? t('siri_trabajando') : activo ? t('siri_desactivar') : t('siri_activar')}
              </button>
            </>
          )}

          <div className="mb-2 mt-6 text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{t('siri_como_titulo')}</div>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
            {[t('siri_paso_1'), t('siri_paso_2'), t('siri_paso_3')].map((paso, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5" style={{ borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>{i + 1}</span>
                <span className="text-[12.5px] leading-relaxed">{paso}</span>
              </div>
            ))}
          </div>

          <div className="mb-2 mt-6 text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{t('siri_ejemplos_titulo')}</div>
          <div className="flex flex-col gap-2">
            {ejemplos.map((e) => (
              <div key={e} className="rounded-2xl px-4 py-3 text-[12.5px] italic" style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>“{e}”</div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
            {t('siri_nota')}
          </div>
        </div>
      </div>
    </div>
  )
}

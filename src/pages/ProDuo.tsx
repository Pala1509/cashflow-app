import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { useEffect, useRef } from 'react'
import { ArrowLeft, Heart, QrCode, Link2, MessageCircle, Lock, Info, CircleCheck, MoreHorizontal, X } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useProDuo } from '../hooks/useProDuo'
import Logo from '../components/Logo'
import { useIdioma } from '../lib/IdiomaContext'

export default function ProDuo() {
  const navigate = useNavigate()
  const { esPro, reload: reloadFinanzas } = useFinanzas()
  const { row, partnerName, loading, error, crearCodigo, desvincular } = useProDuo()
  const { t } = useIdioma()
  const [creando, setCreando] = useState(false)
  const [showDesvincular, setShowDesvincular] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function handleCrear() {
    setCreando(true)
    await crearCodigo()
    setCreando(false)
  }

  async function handleDesvincular() {
    if (!row) return
    await desvincular(row.id)
    await reloadFinanzas()
    setShowDesvincular(false)
  }

  const link = row ? `${window.location.origin}/auth?codigo=${row.codigo}` : ''

  function copiarLink() {
    navigator.clipboard?.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  function abrirWhatsapp() {
    if (!row) return
    const texto = t('pd_whatsapp_msg', { codigo: row.codigo })
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('pd_titulo')}</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:flex md:justify-center">
        <div className="md:w-[420px]">

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Logo size={48} rounded={14} />
            </div>
          )}

          {!loading && error && (
            <div className="mt-4 rounded-2xl p-4 text-[11.5px] leading-relaxed" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
              {error}
            </div>
          )}

          {/* ---- Estado: ya vinculado (como inviter o como invitado) ---- */}
          {!loading && row && row.estado === 'activo' && (
            <>
              <div className="mt-4 flex items-center gap-3 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-base font-bold font-display" style={{ background: 'var(--pink-dim)', color: 'var(--pink)' }}>
                  {(partnerName ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{partnerName ?? t('pd_tu_pareja')}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--lime)' }}>
                    <CircleCheck size={11} /> {t('pd_pro_vinculados')}
                  </div>
                </div>
                <button onClick={() => setShowDesvincular(true)} style={{ color: 'var(--text-3)' }}>
                  <MoreHorizontal size={18} />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--card-2)', opacity: 0.65 }}>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
                  <Lock size={14} />
                </div>
                <div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('pd_cupo_lleno')}</div>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{t('pd_solo_una_persona')}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2 px-1">
                <Info size={13} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }} />
                <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {t('pd_pensado_para')}
                </p>
              </div>
            </>
          )}

          {/* ---- Estado: código pendiente ya generado (esperando a que lo canjeen) ---- */}
          {!loading && row && row.estado === 'pendiente' && (
            <>
              <div className="pt-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
                  <Heart size={24} />
                </div>
                <div className="mt-3 text-[15px] font-bold font-display">{t('pd_comparte_tu_pro')}</div>
                <p className="mx-auto mt-1.5 max-w-[250px] text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {t('pd_ella_entra_codigo')}
                </p>
              </div>

              <div className="mt-5 rounded-2xl p-4 text-center" style={{ background: 'var(--card)', border: '1px dashed var(--line)' }}>
                <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('pd_tu_codigo')}</div>
                <div className="mt-1.5 font-mono text-xl font-bold tracking-wide" style={{ color: 'var(--lime)' }}>{row.codigo}</div>
                <div className="mt-1.5 text-[9.5px]" style={{ color: 'var(--text-3)' }}>{t('pd_solo_una_persona_usa')}</div>
              </div>

              <QrBlock value={link} label={t('pd_escanear_camara')} />

              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <button onClick={copiarLink} className="flex flex-col items-center gap-1.5 rounded-2xl py-3" style={{ background: 'var(--card)' }}>
                  <Link2 size={16} />
                  <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{copiado ? t('pd_copiado') : t('pd_copiar_link')}</span>
                </button>
                <button onClick={abrirWhatsapp} className="flex flex-col items-center gap-1.5 rounded-2xl py-3" style={{ background: 'var(--card)' }}>
                  <MessageCircle size={16} style={{ color: '#25D366' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>WhatsApp</span>
                </button>
              </div>

              <div className="mt-3.5 flex gap-2.5 rounded-2xl p-3.5" style={{ background: 'var(--card-2)' }}>
                <Lock size={14} style={{ color: 'var(--lavender)', flexShrink: 0, marginTop: 1 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {t('pd_no_comparte_movimientos')}
                </p>
              </div>
            </>
          )}

          {/* ---- Estado: sin vínculo todavía ---- */}
          {!loading && !row && (
            <div className="pt-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
                <Heart size={24} />
              </div>
              <div className="mt-3 text-[15px] font-bold font-display">{t('pd_regala_pro')}</div>
              <p className="mx-auto mt-1.5 max-w-[260px] text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {esPro ? t('pd_invitala_desc') : t('pd_hazte_pro_primero')}
              </p>
              {esPro ? (
                <button
                  onClick={handleCrear}
                  disabled={creando}
                  className="mx-auto mt-5 flex items-center gap-2 rounded-2xl px-5 py-3 text-[12.5px] font-bold disabled:opacity-50"
                  style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
                >
                  <Heart size={15} /> {creando ? t('pd_generando') : t('pd_invitar_pareja')}
                </button>
              ) : (
                <button
                  onClick={() => navigate('/perfil/pro')}
                  className="mx-auto mt-5 rounded-2xl px-5 py-3 text-[12.5px] font-bold"
                  style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
                >
                  {t('pd_ver_pro')}
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {showDesvincular && row && (
        <div className="absolute inset-0 z-40 flex items-end justify-center px-0 md:items-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full rounded-t-3xl p-5 md:max-w-[360px] md:rounded-3xl" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
            <div className="flex justify-between">
              <div className="text-[14.5px] font-bold font-display">{t('pd_desvincular_pregunta', { nombre: partnerName ?? t('pd_tu_pareja') })}</div>
              <button onClick={() => setShowDesvincular(false)} style={{ color: 'var(--text-3)' }}><X size={18} /></button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {t('pd_desvincular_desc', { nombre: partnerName ?? t('pd_ella_generico') })}
            </p>
            <button onClick={handleDesvincular} className="mt-4 w-full rounded-2xl py-3.5 text-[13px] font-bold" style={{ background: 'var(--coral)', color: '#2b0d09' }}>
              {t('pd_si_desvincular')}
            </button>
            <button onClick={() => setShowDesvincular(false)} className="mt-2 w-full py-1 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
              {t('pd_cancelar')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function QrBlock({ value, label }: { value: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!value || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, { width: 148, margin: 1, color: { dark: '#131313', light: '#C6FF4D' } })
  }, [value])
  return (
    <div className="mt-3.5 flex flex-col items-center gap-2 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
      <canvas ref={canvasRef} style={{ borderRadius: 12 }} />
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-3)' }}>
        <QrCode size={12} /> {label}
      </div>
    </div>
  )
}

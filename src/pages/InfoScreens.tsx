import { useEffect, useState } from 'react'
import { appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Mail, Bell, Scale, Home, PieChart, Target, Bug, Clock, DollarSign } from 'lucide-react'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { Capacitor } from '@capacitor/core'
import Logo from '../components/Logo'
import { useVersionApp } from '../lib/version'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { tienePermiso, pedirPermiso } from '../lib/notificaciones'
import { useIdioma } from '../lib/IdiomaContext'

function SimpleHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
      <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
        <ArrowLeft size={16} />
      </button>
      <div className="text-[15px] font-semibold font-display">{title}</div>
      <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
        <X size={16} />
      </button>
    </div>
  )
}

export function Ayuda() {
  const { t } = useIdioma()
  const FAQ = [
    { q: t('is_faq_q1'), a: t('is_faq_a1') },
    { q: t('is_faq_q2'), a: t('is_faq_a2') },
    { q: t('is_faq_q3'), a: t('is_faq_a3') },
    { q: t('is_faq_q4'), a: t('is_faq_a4') },
  ]
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <SimpleHeader title={t('is_ayuda_titulo')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {FAQ.map((f, i) => (
          <div key={i} className="mb-3 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
            <div className="text-[13px] font-semibold">{f.q}</div>
            <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.a}</div>
          </div>
        ))}
        <a href="mailto:hola@vantalabstudio.com" className="mt-2 flex items-center gap-2.5 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
          <Mail size={16} style={{ color: 'var(--lime)' }} />
          <span className="text-[13px]">hola@vantalabstudio.com</span>
        </a>
      </div>
    </div>
  )
}

export function Terminos() {
  const { t } = useIdioma()
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <SimpleHeader title={t('is_terminos_titulo')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p className="mb-3" style={{ color: 'var(--text-3)' }}>{t('is_terminos_actualizado')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h1')}</div>
        <p className="mb-3">{t('is_terminos_p1')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h2')}</div>
        <p className="mb-3">{t('is_terminos_p2')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h3')}</div>
        <p className="mb-3">{t('is_terminos_p3')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h4')}</div>
        <p className="mb-3">{t('is_terminos_p4')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h5')}</div>
        <p className="mb-3">{t('is_terminos_p5')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h6')}</div>
        <p className="mb-3">{t('is_terminos_p6')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h7')}</div>
        <p className="mb-3">{t('is_terminos_p7')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h8')}</div>
        <p className="mb-3">{t('is_terminos_p8')}</p>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>{t('is_terminos_h9')}</div>
        <p>{t('is_terminos_p9')}</p>
      </div>
    </div>
  )
}

export function Privacidad() {
  const { t } = useIdioma()
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <SimpleHeader title={t('is_privacidad_titulo')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p className="mb-3">{t('is_privacidad_p1')}</p>
        <p className="mb-3">{t('is_privacidad_p2')}</p>
        <p>{t('is_privacidad_p3')}</p>
      </div>
    </div>
  )
}

export function AcercaDe() {
  const version = useVersionApp()
  const { t } = useIdioma()
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <SimpleHeader title={t('is_acerca_titulo')} />
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-4">
          <Logo size={64} rounded={18} />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold font-display">CashFlow</div>
        </div>
        <div className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>{t('is_acerca_tagline')}</div>
        <div className="mt-4 text-[11px]" style={{ color: 'var(--text-3)' }}>{t('is_acerca_version', { v: version })}</div>
      </div>
    </div>
  )
}

export function Notificaciones() {
  const { user } = useAuth()
  const { t } = useIdioma()
  const [permiso, setPermiso] = useState<boolean | null>(null)
  const [movimientos, setMovimientos] = useState(true)
  const [deudas, setDeudas] = useState(true)
  const [gastosFijos, setGastosFijos] = useState(true)
  const [presupuestos, setPresupuestos] = useState(true)
  const [metas, setMetas] = useState(true)
  const [gastosHormiga, setGastosHormiga] = useState(true)
  const [recordatorio, setRecordatorio] = useState(true)
  const [dolar, setDolar] = useState(true)
  const [esPro, setEsPro] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [loading, setLoading] = useState(true)
  const esNativo = Capacitor.isNativePlatform()

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setPermiso(await tienePermiso())
      const { data } = await supabase
        .from('profiles')
        .select('notif_gastos_fijos, notif_presupuestos, notif_metas, notif_deudas, notif_deudas_dias_antes, notif_gastos_hormiga, notif_recordatorio_diario, notif_dolar, es_pro')
        .eq('id', user.id)
        .single()
      if (data) {
        setGastosFijos(data.notif_gastos_fijos)
        setPresupuestos(data.notif_presupuestos)
        setMetas(data.notif_metas)
        setDeudas(data.notif_deudas)
        setGastosHormiga(data.notif_gastos_hormiga)
        setRecordatorio(data.notif_recordatorio_diario)
        setDolar(data.notif_dolar)
        setEsPro(Boolean(data.es_pro))
      }
      setLoading(false)
    })()
  }, [user])

  async function activar() {
    const ok = await pedirPermiso()
    setPermiso(ok)
    if (!ok) await appAlert(t('is_notif_error_activar'))
  }

  async function guardar(campo: string, valor: boolean | number) {
    if (!user) return
    await supabase.from('profiles').update({ [campo]: valor }).eq('id', user.id)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <SimpleHeader title={t('is_notif_titulo')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {!esNativo && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
            <Bell size={15} className="flex-shrink-0" />
            {t('is_notif_solo_apk')}
          </div>
        )}

        {esNativo && !loading && permiso === false && (
          <button onClick={activar} className="mb-4 flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
              <Bell size={17} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold" style={{ color: 'var(--lime)' }}>{t('is_notif_activar')}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('is_notif_sin_esto')}</div>
            </div>
          </button>
        )}

        <div className="mb-1.5 mt-1 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_deudas_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<Scale size={16} />} color="coral" title={t('is_notif_deudas_row_title')} sub={t('is_notif_deudas_row_sub')} value={deudas} onChange={(v) => { setDeudas(v); guardar('notif_deudas', v) }} />
          {deudas && (
            <div className="px-3.5 pb-3.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {t('is_notif_deudas_general_nota')}
            </div>
          )}
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_gastos_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<Home size={16} />} color="yellow" title={t('is_notif_gastos_row_title')} sub={t('is_notif_gastos_row_sub')} value={gastosFijos} onChange={(v) => { setGastosFijos(v); guardar('notif_gastos_fijos', v) }} last />
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_presupuestos_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<PieChart size={16} />} color="coral" title={t('is_notif_presupuestos_row_title')} sub={t('is_notif_presupuestos_row_sub')} value={presupuestos} onChange={(v) => { setPresupuestos(v); guardar('notif_presupuestos', v) }} last />
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_metas_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<Target size={16} />} color="lime" title={t('is_notif_metas_row_title')} sub={t('is_notif_metas_row_sub')} value={metas} onChange={(v) => { setMetas(v); guardar('notif_metas', v) }} last />
        </div>

        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
          {t('is_notif_hormiga_titulo')}
          {!esPro && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold normal-case tracking-normal" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>PRO</span>}
        </div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow
            icon={<Bug size={16} />}
            color="coral"
            title={t('is_notif_hormiga_row_title')}
            sub={t('is_notif_hormiga_row_sub')}
            value={esPro && gastosHormiga}
            onChange={(v) => {
              if (!esPro) { setShowPaywall(true); return }
              setGastosHormiga(v); guardar('notif_gastos_hormiga', v)
            }}
            last
          />
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_movimientos_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<Bell size={16} />} color="lavender" title={t('is_notif_movimientos_row_title')} sub={t('is_notif_movimientos_row_sub')} value={movimientos} onChange={setMovimientos} last />
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_recordatorio_titulo')}</div>
        <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<Clock size={16} />} color="lavender" title={t('is_notif_recordatorio_row_title')} sub={t('is_notif_recordatorio_row_sub')} value={recordatorio} onChange={(v) => { setRecordatorio(v); guardar('notif_recordatorio_diario', v) }} last />
        </div>

        <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('is_notif_dolar_titulo')}</div>
        <div className="mb-2 overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>
          <NotifRow icon={<DollarSign size={16} />} color="yellow" title={t('is_notif_dolar_row_title')} sub={t('is_notif_dolar_row_sub')} value={dolar} onChange={(v) => { setDolar(v); guardar('notif_dolar', v) }} last />
        </div>
      </div>

      {showPaywall && <ProPaywallSheet reason={t('is_notif_hormiga_paywall')} onClose={() => setShowPaywall(false)} />}
    </div>
  )
}

function NotifRow({ icon, color, title, sub, value, onChange, last }: { icon: React.ReactNode; color: string; title: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const colores: Record<string, { fg: string; dim: string }> = {
    coral: { fg: 'var(--coral)', dim: 'var(--coral-dim)' },
    yellow: { fg: 'var(--yellow)', dim: 'var(--yellow-dim)' },
    lime: { fg: 'var(--lime)', dim: 'var(--lime-dim)' },
    lavender: { fg: 'var(--lavender)', dim: 'var(--lavender-dim)' },
  }
  const col = colores[color] ?? colores.lavender
  return (
    <div className="flex items-center gap-3 p-3.5" style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div className="flex h-8.5 w-8.5 flex-shrink-0 items-center justify-center rounded-xl" style={{ width: 34, height: 34, background: col.dim, color: col.fg }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">{title}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{sub}</div>
      </div>
      <button onClick={() => onChange(!value)} className="relative flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: value ? 'var(--lime)' : 'var(--card-2)' }}>
        <div className="absolute top-0.5 rounded-full transition-all" style={{ width: 18, height: 18, background: value ? 'var(--lime-text)' : 'var(--text-3)', left: value ? 18 : 2 }} />
      </button>
    </div>
  )
}

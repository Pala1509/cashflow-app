import { useEffect, useState } from 'react'
import { appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Check, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useIdioma } from '../lib/IdiomaContext'
import type { ClaveTraduccion } from '../lib/i18n'

const MONEDAS: { code: string; labelKey: ClaveTraduccion }[] = [
  { code: 'COP', labelKey: 'mn_cop' },
  { code: 'USD', labelKey: 'mn_usd' },
  { code: 'EUR', labelKey: 'mn_eur' },
  { code: 'MXN', labelKey: 'mn_mxn' },
]

export default function Moneda() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  const [moneda, setMoneda] = useState('COP')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('moneda').eq('id', user.id).single().then(({ data }) => {
      if (data?.moneda) setMoneda(data.moneda)
    })
  }, [user])

  async function save(code: string) {
    if (!user) return
    setMoneda(code)
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ moneda: code }).eq('id', user.id)
    setSaving(false)
    if (error) { await appAlert(t('mn_error_guardar', { msg: error.message })); return }
    navigate(-1)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('mn_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">
        <div className="mb-4 flex items-center gap-2 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
          <Info size={15} className="flex-shrink-0" />
          {t('mn_aviso')}
        </div>
        {MONEDAS.map((m) => (
          <button
            key={m.code}
            disabled={saving}
            onClick={() => save(m.code)}
            className="mb-2.5 flex w-full items-center justify-between rounded-2xl p-4 text-left disabled:opacity-60"
            style={{ background: 'var(--card)', border: `1px solid ${moneda === m.code ? 'var(--lime)' : 'var(--line)'}` }}
          >
            <div>
              <div className="text-[13px] font-semibold">{m.code}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t(m.labelKey)}</div>
            </div>
            {moneda === m.code && <Check size={16} style={{ color: 'var(--lime)' }} />}
          </button>
        ))}
      </div>
    </div>
  )
}

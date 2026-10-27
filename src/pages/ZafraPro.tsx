import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Check, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PERKS = [
  'Cuentas y billeteras ilimitadas',
  'Metas de ahorro ilimitadas',
  'Categorías personalizadas',
  'Motor de interés completo en deudas (sobre saldo, fijo, proyección de pago)',
  'Historial completo, sin límite de 3 meses',
]

export default function ZafraPro() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [esPro, setEsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('es_pro').eq('id', user.id).single().then(({ data }) => {
      setEsPro(Boolean(data?.es_pro))
      setLoading(false)
    })
  }, [user])

  async function toggle(value: boolean) {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ es_pro: value }).eq('id', user.id)
    setSaving(false)
    if (error) { alert('No se pudo actualizar: ' + error.message); return }
    setEsPro(value)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">Zafra Pro</div>
        <button onClick={() => navigate('/perfil')} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-5 mt-2 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
            <Sparkles size={26} />
          </div>
          <div className="mt-3 text-lg font-bold font-display">Desbloquea todo Zafra</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>Pago único · sin suscripción</div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'var(--card)' }}>
          {PERKS.map((p, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2">
              <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0, marginTop: 1 }} />
              <span className="text-[12.5px] leading-relaxed">{p}</span>
            </div>
          ))}
        </div>

        <button
          disabled
          className="mt-5 w-full rounded-2xl py-4 text-sm font-bold opacity-50"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          Comprar Zafra Pro — próximamente
        </button>
        <div className="mt-2 text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>
          El pago todavía no está conectado — esto se activa cuando integremos la pasarela de pago.
        </div>

        {!loading && (
          <div className="mt-6 rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px dashed var(--line)' }}>
            <div className="text-[11.5px] font-semibold" style={{ color: 'var(--text-2)' }}>Modo de prueba (solo para ti, mientras desarrollamos)</div>
            <div className="mt-1 mb-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Actívalo y desactívalo aquí para probar cómo se comporta la app en cada plan, sin depender de un pago real todavía.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(false)}
                disabled={saving}
                className="flex-1 rounded-2xl py-3 text-[12.5px] font-semibold disabled:opacity-50"
                style={!esPro ? { background: 'var(--lime)', color: 'var(--lime-text)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
              >
                Free
              </button>
              <button
                onClick={() => toggle(true)}
                disabled={saving}
                className="flex-1 rounded-2xl py-3 text-[12.5px] font-semibold disabled:opacity-50"
                style={esPro ? { background: 'var(--lime)', color: 'var(--lime-text)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
              >
                Pro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

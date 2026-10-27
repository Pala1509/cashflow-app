import { useEffect, useState } from 'react'
import { appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Check, Sparkles, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useIdioma } from '../lib/IdiomaContext'
import type { ClaveTraduccion } from '../lib/i18n'
import { Capacitor } from '@capacitor/core'

const PERK_KEYS: ClaveTraduccion[] = [
  'cp_perk_cuentas', 'cp_perk_metas', 'cp_perk_fijos', 'cp_perk_categorias', 'cp_perk_interes',
  'cp_perk_presupuestos', 'cp_perk_historial', 'cp_perk_hormiga', 'cp_perk_proyeccion', 'cp_perk_comparacion',
]

type PlanId = 'mensual' | 'semestral' | 'anual' | 'unico'

const PLANES: { id: PlanId; nombreKey: ClaveTraduccion; precio: string; precioTachado?: string; periodoKey: ClaveTraduccion; ahorroKey?: ClaveTraduccion; destacado?: boolean; badgeKey?: ClaveTraduccion; badgeColor?: string }[] = [
  { id: 'mensual', nombreKey: 'cp_plan_mensual', precio: '$16.900', periodoKey: 'cp_por_mes' },
  { id: 'semestral', nombreKey: 'cp_plan_semestral', precio: '$59.900', periodoKey: 'cp_por_6_meses', ahorroKey: 'cp_ahorras_41', destacado: true, badgeKey: 'cp_mejor_recurrente', badgeColor: 'lime' },
  { id: 'anual', nombreKey: 'cp_plan_anual', precio: '$169.900', periodoKey: 'cp_por_ano' },
  { id: 'unico', nombreKey: 'cp_plan_unico', precio: '$249.900', precioTachado: '$399.900', periodoKey: 'cp_una_vez', badgeKey: 'cp_lanzamiento', badgeColor: 'lavender' },
]

// null = nunca compró nada, o su Pro viene de Dúo (no es un plan propio).
type PlanPro = PlanId | 'vitalicio' | null

export default function CashFlowPro() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  // El interruptor de prueba Free/Pro (sin pago real todavía) solo debe
  // verlo Felipe mientras seguimos desarrollando — nadie más debería poder
  // activarse Pro gratis con un toque.
  const esDesarrollador = user?.email === 'andresfelipepalaciosmoreno@gmail.com'
  const [esPro, setEsPro] = useState(false)
  const [esProDuo, setEsProDuo] = useState(false)
  const [planPro, setPlanPro] = useState<PlanPro>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planSel, setPlanSel] = useState<PlanId>('unico')
  // Si ya eres Pro, por defecto se ve la pantalla de "tu plan actual" en
  // vez de la vitrina de compra — este toggle es el botón "Cambiar de
  // plan" de esa pantalla, para volver a ver las demás opciones.
  const [mostrarPlanes, setMostrarPlanes] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('es_pro, es_pro_duo, plan_pro').eq('id', user.id).single().then(({ data }) => {
      setEsPro(Boolean(data?.es_pro))
      setEsProDuo(Boolean(data?.es_pro_duo))
      setPlanPro((data?.plan_pro as PlanPro) ?? null)
      setLoading(false)
    })
  }, [user])

  async function toggle(value: boolean) {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ es_pro: value }).eq('id', user.id)
    setSaving(false)
    if (error) { await appAlert(t('cp_error_actualizar', { msg: error.message })); return }
    setEsPro(value)
    if (value) setMostrarPlanes(false)
  }

  const yaEsPro = esPro || esProDuo
  // App Store: mientras las compras dentro de la app no estén conectadas,
  // en iOS NO se muestran precios ni botón de comprar (Apple rechaza apps
  // con compras que no funcionan o que no pasan por su sistema de pago).
  // Se muestra solo qué incluye Pro y un "Próximamente". Android y web
  // siguen viendo la vitrina completa con el botón desactivado.
  const comprasVisibles = Capacitor.getPlatform() !== 'ios'
  const mostrarVitrina = !yaEsPro || mostrarPlanes

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('cp_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {!loading && yaEsPro && !mostrarVitrina ? (
          <EstadoProActual planPro={planPro} esProDuo={esProDuo} t={t} onCambiar={() => setMostrarPlanes(true)} />
        ) : (
          <>
            {yaEsPro && (
              <button
                onClick={() => setMostrarPlanes(false)}
                className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: 'var(--text-2)' }}
              >
                <ArrowLeft size={13} /> {t('cp_volver_a_mi_plan')}
              </button>
            )}

            <div className="mb-5 mt-2 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
                <Sparkles size={26} />
              </div>
              <div className="mt-3 text-lg font-bold font-display">{t('cp_desbloquea_todo')}</div>
              {comprasVisibles && <div className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>{t('cp_elige_plan')}</div>}
            </div>

            {!comprasVisibles && (
              <div className="rounded-2xl px-4 py-3.5 text-center" style={{ background: 'var(--lavender-dim)' }}>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--lavender)' }}>{t('cp_pronto_titulo')}</div>
                <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--lavender)' }}>{t('cp_pronto_desc')}</div>
              </div>
            )}

            {comprasVisibles && (<>
            <div className="grid grid-cols-2 gap-2.5">
              {PLANES.map((p) => {
                const sel = planSel === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlanSel(p.id)}
                    className="relative flex flex-col items-center gap-1 rounded-2xl px-2 py-4 text-center"
                    style={{ background: sel ? 'var(--lime-dim)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--lime)' : 'var(--line)'}` }}
                  >
                    {p.badgeKey && (
                      <span
                        className="absolute -top-2.5 rounded-full px-2 py-0.5 text-[8px] font-bold"
                        style={p.badgeColor === 'lavender'
                          ? { background: 'var(--lavender)', color: '#1c1330' }
                          : { background: 'var(--lime)', color: 'var(--lime-text)' }}
                      >
                        {t(p.badgeKey)}
                      </span>
                    )}
                    <div className="mt-1.5 text-[11px] font-semibold" style={{ color: sel ? 'var(--lime)' : 'var(--text-2)' }}>{t(p.nombreKey)}</div>
                    {p.precioTachado && (
                      <div className="font-mono text-[10.5px] line-through" style={{ color: 'var(--text-3)' }}>{p.precioTachado}</div>
                    )}
                    <div className="font-mono text-[17px] font-bold" style={{ color: sel ? 'var(--lime)' : 'var(--text-1)' }}>{p.precio}</div>
                    <div className="text-[9px]" style={{ color: 'var(--text-3)' }}>{t(p.periodoKey)}</div>
                    {p.ahorroKey && <div className="mt-0.5 text-[9px] font-semibold" style={{ color: 'var(--lime)' }}>{t(p.ahorroKey)}</div>}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--lavender-dim)' }}>
              <Sparkles size={12} style={{ color: 'var(--lavender)', flexShrink: 0, marginTop: 2 }} />
              <div className="text-[10.5px] leading-relaxed" style={{ color: 'var(--lavender)' }}>
                {t('cp_nota_pago_unico', { precio: '$249.900' })}
              </div>
            </div>
            </>)}

            <div className="mt-5 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
              {PERK_KEYS.map((k) => (
                <div key={k} className="flex items-start gap-2.5 py-2">
                  <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0, marginTop: 1 }} />
                  <span className="text-[12.5px] leading-relaxed">{t(k)}</span>
                </div>
              ))}
            </div>

            {comprasVisibles && (<>
            <button
              disabled
              className="mt-5 w-full rounded-2xl py-4 text-sm font-bold opacity-50"
              style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
            >
              {planSel === 'unico' ? t('cp_comprar_unico') : t('cp_suscribirme', { plan: t(PLANES.find((p) => p.id === planSel)!.nombreKey) })} — {t('cp_proximamente')}
            </button>
            <div className="mt-2 text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {t('cp_pago_no_conectado')}
            </div>
            </>)}
          </>
        )}

        {!loading && esDesarrollador && (
          <div className="mt-6 rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px dashed var(--line)' }}>
            <div className="text-[11.5px] font-semibold" style={{ color: 'var(--text-2)' }}>{t('cp_modo_prueba')}</div>
            <div className="mt-1 mb-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {t('cp_modo_prueba_desc')}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(false)}
                disabled={saving}
                className="flex-1 rounded-2xl py-3 text-[12.5px] font-semibold disabled:opacity-50"
                style={!esPro ? { background: 'var(--lime)', color: 'var(--lime-text)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
              >
                {t('cp_free')}
              </button>
              <button
                onClick={() => toggle(true)}
                disabled={saving}
                className="flex-1 rounded-2xl py-3 text-[12.5px] font-semibold disabled:opacity-50"
                style={esPro ? { background: 'var(--lime)', color: 'var(--lime-text)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
              >
                {t('cp_pro')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Pantalla de "ya tienes Pro" — qué te muestra depende de cómo llegaste
// a Pro: plan vitalicio (pagaste una vez, no hay nada que cambiar), Dúo
// (te lo compartieron, tampoco hay plan propio que cambiar), un plan
// recurrente/único con nombre (puedes ver los demás), o Pro sin plan
// registrado (casos viejos, antes de que existiera esta columna).
function EstadoProActual({
  planPro, esProDuo, t, onCambiar,
}: {
  planPro: PlanPro
  esProDuo: boolean
  t: (k: ClaveTraduccion, vars?: Record<string, string | number>) => string
  onCambiar: () => void
}) {
  const esVitalicio = planPro === 'vitalicio'
  const planConNombre = planPro && planPro !== 'vitalicio' ? PLANES.find((p) => p.id === planPro) : undefined

  let titulo: string
  let desc: string | null = null
  let mostrarCambiar = false

  if (esVitalicio) {
    titulo = t('cp_plan_vitalicio_titulo')
    desc = t('cp_plan_vitalicio_desc')
  } else if (planConNombre) {
    titulo = `${t('cp_tu_plan_actual')}: ${t(planConNombre.nombreKey)}`
    mostrarCambiar = true
  } else if (esProDuo) {
    titulo = t('cp_pro_duo_titulo')
    desc = t('cp_pro_duo_desc')
  } else {
    titulo = t('cp_ya_eres_pro')
    mostrarCambiar = true
  }

  return (
    <div>
      <div className="mb-5 mt-2 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
          <Crown size={26} />
        </div>
        <div className="mt-3 text-lg font-bold font-display">{titulo}</div>
        {desc && <div className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>{desc}</div>}
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'var(--card)' }}>
        {PERK_KEYS.map((k) => (
          <div key={k} className="flex items-start gap-2.5 py-2">
            <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0, marginTop: 1 }} />
            <span className="text-[12.5px] leading-relaxed">{t(k)}</span>
          </div>
        ))}
      </div>

      {mostrarCambiar && (
        <button
          onClick={onCambiar}
          className="mt-5 w-full rounded-2xl py-4 text-sm font-bold"
          style={{ background: 'var(--card)', color: 'var(--text-1)', border: '1.5px solid var(--line)' }}
        >
          {t('cp_cambiar_plan')}
        </button>
      )}
    </div>
  )
}

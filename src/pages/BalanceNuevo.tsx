import { useEffect, useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { X, Tag, DollarSign, Target, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useProDuo } from '../hooks/useProDuo'
import { FREE_LIMITS } from '../lib/pro'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { sortCategorias } from '../lib/categorias'
import { ICONS, COLORS, GRUPOS } from './Cuentas'
import type { FrecuenciaFija } from '../lib/database.types'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import type { ClaveTraduccion } from '../lib/i18n'

type Tipo = 'ingreso_fijo' | 'gasto_fijo' | 'meta'

const TITLE_KEYS: Record<Tipo, ClaveTraduccion> = {
  ingreso_fijo: 'bn_titulo_ingreso',
  gasto_fijo: 'bn_titulo_gasto',
  meta: 'bn_titulo_meta',
}
const EDIT_TITLE_KEYS: Record<Tipo, ClaveTraduccion> = {
  ingreso_fijo: 'bn_editar_ingreso',
  gasto_fijo: 'bn_editar_gasto',
  meta: 'bn_editar_meta',
}

const FRECUENCIAS: { id: FrecuenciaFija; labelKey: ClaveTraduccion }[] = [
  { id: 'quincenal', labelKey: 'bn_frec_quincenal' },
  { id: 'mensual', labelKey: 'bn_frec_mensual' },
  { id: 'trimestral', labelKey: 'bn_frec_trimestral' },
  { id: 'semestral', labelKey: 'bn_frec_semestral' },
  { id: 'anual', labelKey: 'bn_frec_anual' },
]

export default function BalanceNuevo() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const { metas, categorias, ingresosFijos, gastosFijos, esPro, reload } = useFinanzas()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [params] = useSearchParams()

  // En edición no sabemos el tipo por la URL — lo deducimos buscando el id
  // en las 3 listas que ya tenemos cargadas.
  const registroExistente = isEdit
    ? ingresosFijos.find((i) => i.id === id) ?? gastosFijos.find((g) => g.id === id) ?? metas.find((m) => m.id === id)
    : null
  const tipoDetectado: Tipo | null = isEdit
    ? ingresosFijos.some((i) => i.id === id) ? 'ingreso_fijo' : gastosFijos.some((g) => g.id === id) ? 'gasto_fijo' : metas.some((m) => m.id === id) ? 'meta' : null
    : null
  const tipo = isEdit ? (tipoDetectado ?? 'gasto_fijo') : ((params.get('tipo') as Tipo) ?? 'gasto_fijo')
  const [showPaywall, setShowPaywall] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const metasActivas = metas.filter((m) => m.estado === 'activa').length
  const limiteAlcanzado =
    (tipo === 'meta' && metasActivas >= FREE_LIMITS.maxMetasActivas) ||
    (tipo === 'ingreso_fijo' && ingresosFijos.length >= FREE_LIMITS.maxIngresosFijos) ||
    (tipo === 'gasto_fijo' && gastosFijos.length >= FREE_LIMITS.maxGastosFijos)
  const bloqueadoPorLimite = !isEdit && !esPro && limiteAlcanzado

  const limiteTexto: Record<Tipo, string> = {
    meta: t('bn_limite_meta', { n: FREE_LIMITS.maxMetasActivas }),
    ingreso_fijo: t('bn_limite_ingresos', { n: FREE_LIMITS.maxIngresosFijos }),
    gasto_fijo: t('bn_limite_gastos', { n: FREE_LIMITS.maxGastosFijos }),
  }

  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [frecuencia, setFrecuencia] = useState<FrecuenciaFija>('mensual')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [diaMes, setDiaMes] = useState('1')
  const [notifActivo, setNotifActivo] = useState(false)
  const [notifDiasAntes, setNotifDiasAntes] = useState('2')
  const [aporteMensual, setAporteMensual] = useState('')
  const [saving, setSaving] = useState(false)
  const [compartir, setCompartir] = useState(false)
  const { row: proDuoRow, partnerName } = useProDuo()
  const parejaActiva = proDuoRow?.estado === 'activo' ? proDuoRow : null
  const parejaId = parejaActiva ? (parejaActiva.inviter_id === user?.id ? parejaActiva.invitado_id : parejaActiva.inviter_id) : null

  useEffect(() => {
    if (!registroExistente) return
    setNombre(registroExistente.nombre)
    if ('monto_objetivo' in registroExistente) {
      setMonto(String(registroExistente.monto_objetivo))
      setAporteMensual(String(registroExistente.aporte_mensual))
      setCompartir(Boolean(registroExistente.compartida_con_id))
    } else {
      setMonto(String(registroExistente.monto))
      setFrecuencia(registroExistente.frecuencia)
      setCategoriaId(registroExistente.categoria_id)
      setDiaMes(String(registroExistente.dia_mes))
      if ('notif_dias_antes' in registroExistente) {
        setNotifActivo(registroExistente.notif_dias_antes !== null)
        setNotifDiasAntes(registroExistente.notif_dias_antes !== null ? String(registroExistente.notif_dias_antes) : '2')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroExistente?.id])

  const accent = tipo === 'ingreso_fijo' ? 'var(--lime)' : tipo === 'gasto_fijo' ? 'var(--coral)' : 'var(--lavender)'
  const accentDim = tipo === 'ingreso_fijo' ? 'var(--lime-dim)' : tipo === 'gasto_fijo' ? 'var(--coral-dim)' : 'var(--lavender-dim)'
  const accentText = tipo === 'ingreso_fijo' ? 'var(--lime-text)' : tipo === 'gasto_fijo' ? '#2b0906' : '#1c1330'

  const categoriasFiltradas = sortCategorias(
    categorias.filter((c) => c.tipo === (tipo === 'ingreso_fijo' ? 'ingreso' : 'egreso'))
  )

  async function save() {
    if (!user || !nombre) return
    setSaving(true)
    let error = null

    if (tipo === 'ingreso_fijo') {
      const payload = { nombre, monto: Number(monto || 0), frecuencia, categoria_id: categoriaId, dia_mes: Number(diaMes || 1) }
      const r = isEdit
        ? await supabase.from('ingresos_fijos').update(payload).eq('id', id)
        : await supabase.from('ingresos_fijos').insert({ ...payload, user_id: user.id, icono: 'cash', activo: true })
      error = r.error
    } else if (tipo === 'gasto_fijo') {
      const payload = {
        nombre, monto: Number(monto || 0), frecuencia, categoria_id: categoriaId, dia_mes: Number(diaMes || 1),
        notif_dias_antes: notifActivo ? Number(notifDiasAntes || 2) : null,
      }
      const r = isEdit
        ? await supabase.from('gastos_fijos').update(payload).eq('id', id)
        : await supabase.from('gastos_fijos').insert({ ...payload, user_id: user.id, icono: 'home', activo: true })
      error = r.error
    } else {
      const payload = { nombre, monto_objetivo: Number(monto || 0), aporte_mensual: Number(aporteMensual || 0), compartida_con_id: compartir ? parejaId : null }
      const r = isEdit
        ? await supabase.from('metas_ahorro').update(payload).eq('id', id)
        : await supabase.from('metas_ahorro').insert({ ...payload, user_id: user.id, monto_actual: 0, icono: 'target', color: 'lavender', estado: 'activa' })
      error = r.error
    }

    setSaving(false)
    if (error) { await appAlert(t('bn_error_guardar', { msg: (error as { message: string }).message })); return }
    await reload()
    navigate(-1)
  }

  async function remove() {
    if (!id || !tipo) return
    if (!(await appConfirm(t('bn_confirmar_borrar'), { danger: true }))) return
    setDeleting(true)
    const tabla = tipo === 'ingreso_fijo' ? 'ingresos_fijos' : tipo === 'gasto_fijo' ? 'gastos_fijos' : 'metas_ahorro'
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    setDeleting(false)
    if (error) { await appAlert(t('bn_error_borrar', { msg: error.message })); return }
    await reload()
    navigate(-1)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <div style={{ width: 34 }} />
        <div className="text-[15px] font-semibold font-display">{isEdit ? t(EDIT_TITLE_KEYS[tipo]) : t(TITLE_KEYS[tipo])}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {bloqueadoPorLimite ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: accentDim, color: accent }}>
              <Target size={22} />
            </div>
            <div className="mt-4 text-[14px] font-semibold">{t('bn_limite_titulo')}</div>
            <div className="mt-1.5 max-w-xs text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {t('bn_limite_desc', { limite: limiteTexto[tipo] })}
            </div>
            <button
              onClick={() => setShowPaywall(true)}
              className="mt-5 rounded-2xl px-6 py-3.5 text-[13px] font-bold"
              style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
            >
              {t('bn_ver_pro')}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 mt-2 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: accentDim, color: accent }}>
                <Target size={22} />
              </div>
            </div>

            <FieldLabel>{t('bn_nombre')}</FieldLabel>
            <InputRow icon={<Tag size={16} />} placeholder={tipo === 'meta' ? t('bn_placeholder_meta') : t('bn_placeholder_gasto')} value={nombre} onChange={setNombre} />

            <FieldLabel>{tipo === 'meta' ? t('bn_monto_objetivo') : t('bn_monto')}</FieldLabel>
            <InputRow icon={<DollarSign size={16} />} placeholder="0" value={monto} onChange={(v) => setMonto(v.replace(/[^0-9]/g, ''))} numeric />

            {tipo === 'meta' ? (
              <>
                <FieldLabel>{t('bn_aporte_mensual')}</FieldLabel>
                <InputRow icon={<DollarSign size={16} />} placeholder="0" value={aporteMensual} onChange={(v) => setAporteMensual(v.replace(/[^0-9]/g, ''))} numeric />

                {parejaId && (
                  <>
                    <FieldLabel>{t('bn_pro_duo')}</FieldLabel>
                    <div className="flex items-start justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                      <div>
                        <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{t('bn_compartir_con', { pareja: partnerName ?? t('bn_tu_pareja') })}</div>
                        <div className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('bn_compartir_meta_nota')}</div>
                      </div>
                      <button onClick={() => setCompartir(!compartir)} className="relative mt-0.5 flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: compartir ? 'var(--lavender)' : 'var(--card-2)' }}>
                        <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: compartir ? 'var(--bg)' : 'var(--text-3)', left: compartir ? 18 : 2, transition: 'left .15s' }} />
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <FieldLabel>{tipo === 'ingreso_fijo' ? t('bn_cada_cuanto_pagan') : t('bn_cada_cuanto_vence')}</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {FRECUENCIAS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFrecuencia(f.id)}
                      className="rounded-2xl px-3.5 py-2.5 text-[12px] font-medium"
                      style={frecuencia === f.id
                        ? { background: accentDim, color: accent, border: `1px solid ${accent}` }
                        : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
                    >
                      {t(f.labelKey)}
                    </button>
                  ))}
                </div>

                <FieldLabel>{tipo === 'ingreso_fijo' ? t('bn_que_dia_pagan') : t('bn_que_dia_vence')}</FieldLabel>
                <InputRow icon={<Tag size={16} />} placeholder={t('cn_ej', { v: 5 })} value={diaMes} onChange={(v) => setDiaMes(v.replace(/[^0-9]/g, '').slice(0, 2))} numeric />

                {tipo === 'gasto_fijo' && (
                  <>
                    <div className="mt-3 flex items-center justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                      <div>
                        <div className="text-[12.5px]">{t('bn_quieres_aviso')}</div>
                        <div className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('bn_aviso_nota')}</div>
                      </div>
                      <button onClick={() => setNotifActivo(!notifActivo)} className="relative mt-0.5 flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: notifActivo ? 'var(--lime)' : 'var(--card-2)' }}>
                        <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: notifActivo ? 'var(--lime-text)' : 'var(--text-3)', left: notifActivo ? 18 : 2, transition: 'left .15s' }} />
                      </button>
                    </div>
                    {notifActivo && (
                      <>
                        <FieldLabel>{t('bn_cuantos_dias_antes')}</FieldLabel>
                        <InputRow icon={<Tag size={16} />} placeholder={t('cn_ej', { v: 2 })} value={notifDiasAntes} onChange={(v) => setNotifDiasAntes(v.replace(/[^0-9]/g, ''))} numeric />
                      </>
                    )}
                  </>
                )}

                <FieldLabel>{t('bn_categoria')}</FieldLabel>
                {GRUPOS.map((g) => {
                  const items = categoriasFiltradas.filter((c) => c.grupo === g.id)
                  if (items.length === 0) return null
                  return (
                    <div key={g.id} className="mb-4">
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: (COLORS[g.color] ?? COLORS.lavender).fg }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{g.nombre}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2.5">
                        {items.map((c) => {
                          const Icon = ICONS[c.icono] ?? ICONS.otros
                          const col = COLORS[c.color] ?? COLORS.lavender
                          const sel = categoriaId === c.id
                          return (
                            <button
                              key={c.id}
                              onClick={() => setCategoriaId(c.id)}
                              className="flex flex-col items-center gap-1.5 text-center text-[9.5px]"
                              style={{ color: sel ? accent : 'var(--text-2)' }}
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: col.fg, boxShadow: sel ? `0 0 0 2px ${accent}` : 'none' }}>
                                <Icon size={15} style={{ color: 'var(--bg)' }} />
                              </div>
                              {nombreCategoria(c.nombre, idioma)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {(() => {
                  const sinGrupo = categoriasFiltradas.filter((c) => !c.grupo)
                  if (sinGrupo.length === 0) return null
                  return (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--text-3)' }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bn_personalizadas')}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2.5">
                        {sinGrupo.map((c) => {
                          const Icon = ICONS[c.icono] ?? ICONS.otros
                          const sel = categoriaId === c.id
                          return (
                            <button
                              key={c.id}
                              onClick={() => setCategoriaId(c.id)}
                              className="flex flex-col items-center gap-1.5 text-center text-[9.5px]"
                              style={{ color: sel ? accent : 'var(--text-2)' }}
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--card-2)', boxShadow: sel ? `0 0 0 2px ${accent}` : 'none' }}>
                                <Icon size={15} style={{ color: 'var(--text-2)' }} />
                              </div>
                              {nombreCategoria(c.nombre, idioma)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            <button
              onClick={save}
              disabled={saving || !nombre}
              className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
              style={{ background: accent, color: accentText }}
            >
              {saving ? t('bn_guardando') : isEdit ? t('bn_guardar_cambios') : t('bn_guardar')}
            </button>

            {isEdit && (
              <button
                onClick={remove}
                disabled={deleting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
              >
                <Trash2 size={15} /> {deleting ? t('bn_borrando') : t('bn_borrar')}
              </button>
            )}
          </>
        )}
      </div>

      {showPaywall && <ProPaywallSheet reason={t('bn_limite_desc', { limite: limiteTexto[tipo] })} onClose={() => setShowPaywall(false)} />}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

function InputRow({ icon, placeholder, value, onChange, numeric }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  const isPlainDigits = numeric && value && /^\d+$/.test(value)
  return (
    <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      <input
        value={isPlainDigits ? Number(value).toLocaleString('es-CO') : value}
        inputMode={numeric ? 'numeric' : 'text'}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-1)' }}
      />
    </div>
  )
}

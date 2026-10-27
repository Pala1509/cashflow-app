import { useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Trash2, MoreHorizontal, ArrowLeftRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFinanzas } from '../hooks/useFinanzas'
import { parseLocalDate } from '../lib/date'
import { ICONS } from './Cuentas'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import type { Idioma } from '../lib/i18n'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function friendlyDayHeader(fecha: string, idioma: Idioma, tr: (k: any, v?: any) => string): string {
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
  const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  const antier = new Date(hoy); antier.setDate(antier.getDate() - 2)
  const antierStr = `${antier.getFullYear()}-${String(antier.getMonth() + 1).padStart(2, '0')}-${String(antier.getDate()).padStart(2, '0')}`

  if (fecha === hoyStr) return tr('mv_hoy')
  if (fecha === ayerStr) return tr('mv_ayer')
  if (fecha === antierStr) return tr('mv_antier')

  const d = parseLocalDate(fecha)
  const mismoAnio = d.getFullYear() === hoy.getFullYear()
  const locale = idioma === 'en' ? 'en-US' : 'es-CO'
  const dia = d.toLocaleDateString(locale, { weekday: 'long' })
  const mes = d.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
  return `${dia}, ${d.getDate()} de ${mes}${mismoAnio ? '' : ` de ${d.getFullYear()}`}`
}

export default function Movimientos() {
  const navigate = useNavigate()
  const { t: tr, idioma } = useIdioma()
  const { transacciones, categorias, cuentas, loading, esPro, reload } = useFinanzas()
  const [tab, setTab] = useState<'todo' | 'ingreso' | 'egreso'>('todo')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  function catInfo(id: string | null) {
    return categorias.find((c) => c.id === id)
  }
  function accInfo(id: string) {
    return cuentas.find((c) => c.id === id)
  }
  function normalizar(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  const q = normalizar(query.trim())
  const lista = transacciones.filter((t) => {
    if (tab !== 'todo' && t.tipo !== tab) return false
    if (!q) return true
    const cat = catInfo(t.categoria_id)
    const acc = accInfo(t.cuenta_id)
    const accDestino = t.cuenta_destino_id ? accInfo(t.cuenta_destino_id) : null
    const haystack = normalizar([t.descripcion, cat ? nombreCategoria(cat.nombre, idioma) : null, acc?.nombre, accDestino?.nombre, t.lugar].filter(Boolean).join(' '))
    return haystack.includes(q)
  })

  const now = new Date()
  const delMes = transacciones.filter((t) => { const d = parseLocalDate(t.fecha); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const ingresosDelMes = delMes.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egresosDelMes = delMes.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  async function remove(id: string) {
    if (!(await appConfirm(tr('mv_confirmar_borrar'), { danger: true }))) return
    setDeletingId(id)
    const { error } = await supabase.from('transacciones').delete().eq('id', id)
    setDeletingId(null)
    if (error) { await appAlert(tr('mv_error_borrar', { msg: error.message })); return }
    await reload()
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{tr('mv_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-shrink-0 gap-2 px-5 pb-3 pt-2">
        <Pill active={tab === 'todo'} onClick={() => setTab('todo')}>{tr('mv_todo')}</Pill>
        <Pill active={tab === 'ingreso'} accent="lime" onClick={() => setTab('ingreso')}>{tr('mv_ingresos')}</Pill>
        <Pill active={tab === 'egreso'} accent="coral" onClick={() => setTab('egreso')}>{tr('mv_egresos')}</Pill>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 px-5 pb-3">
        <div className="flex flex-1 items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <Search size={15} style={{ color: 'var(--text-3)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('mv_buscar')}
            className="w-full bg-transparent text-[12.5px] outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text-3)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!esPro && (
        <div className="mx-5 mb-2 rounded-xl px-3 py-2 text-[10.5px]" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
          {tr('mv_free_3_meses')}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 lg:mx-auto lg:w-full lg:max-w-[900px]">
        <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-6">
          <div>
            {loading && <div className="py-8 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{tr('mv_cargando')}</div>}
            {!loading && lista.length === 0 && <div className="py-8 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{tr('mv_sin_resultados')}</div>}

            {Object.entries(
              lista.reduce<Record<string, typeof lista>>((groups, t) => {
                (groups[t.fecha] ??= []).push(t)
                return groups
              }, {})
            )
              .sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .map(([fecha, movs]) => (
                <div key={fecha} className="mb-4">
                  <div className="mb-2 flex items-baseline justify-between px-0.5">
                    <div className="text-[11.5px] font-semibold" style={{ color: 'var(--text-2)' }}>{friendlyDayHeader(fecha, idioma, tr)}</div>
                    <div className="font-mono text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                      {(() => {
                        const neto = movs.reduce((s, t) => s + (t.tipo === 'transferencia' ? 0 : t.tipo === 'ingreso' ? t.monto : -(t.monto + t.monto_4x1000)), 0)
                        return `${neto >= 0 ? '+' : '–'}${fmt(Math.abs(neto))}`
                      })()}
                    </div>
                  </div>
                  {movs.map((t) => {
                    const esTransferencia = t.tipo === 'transferencia'
                    const cat = catInfo(t.categoria_id)
                    const acc = accInfo(t.cuenta_id)
                    const accDestino = t.cuenta_destino_id ? accInfo(t.cuenta_destino_id) : null
                    const catNombre = cat ? nombreCategoria(cat.nombre, idioma) : tr('mv_otros')
                    const Icon = esTransferencia ? ArrowLeftRight : (ICONS[cat?.icono ?? 'otros'] ?? MoreHorizontal)
                    const accent = esTransferencia ? 'var(--lavender)' : t.tipo === 'ingreso' ? 'var(--lime)' : 'var(--coral)'
                    const accentDim = esTransferencia ? 'var(--lavender-dim)' : t.tipo === 'ingreso' ? 'var(--lime-dim)' : 'var(--coral-dim)'
                    return (
                      <div key={t.id} className="mb-2.5 flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
                        <button onClick={() => navigate(`/movimiento/${t.id}/editar`)} className="flex flex-1 items-center gap-3 text-left">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: accentDim, color: accent }}>
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium">
                              {esTransferencia ? `${acc?.nombre ?? '?'} → ${accDestino?.nombre ?? '?'}` : (t.descripcion || catNombre)}
                            </div>
                            <div className="truncate text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                              {esTransferencia ? tr('mv_transferencia') : `${catNombre}${acc ? ` · ${acc.nombre}` : ''}`}
                            </div>
                          </div>
                          <div className="font-mono text-[13px]" style={{ color: accent }}>
                            {esTransferencia ? '' : t.tipo === 'ingreso' ? '+' : '–'}{fmt(t.monto + t.monto_4x1000)}
                          </div>
                        </button>
                        <button
                          onClick={() => remove(t.id)}
                          disabled={deletingId === t.id}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                          style={{ color: 'var(--text-3)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
          </div>

          <div className="hidden rounded-2xl p-4 lg:block" style={{ background: 'var(--card)' }}>
            <div className="mb-3 text-[12.5px] font-semibold">{tr('mv_este_mes')}</div>
            <div className="flex justify-between py-1.5 text-[11.5px]">
              <span style={{ color: 'var(--text-2)' }}>{tr('mv_ingresos')}</span>
              <span className="font-mono" style={{ color: 'var(--lime)' }}>{fmt(ingresosDelMes)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-[11.5px]">
              <span style={{ color: 'var(--text-2)' }}>{tr('mv_egresos')}</span>
              <span className="font-mono" style={{ color: 'var(--coral)' }}>{fmt(egresosDelMes)}</span>
            </div>
            <div className="my-2 h-px" style={{ background: 'var(--line)' }} />
            <div className="flex justify-between py-1.5 text-[11.5px] font-semibold">
              <span>{tr('mv_balance_del_mes')}</span>
              <span className="font-mono" style={{ color: ingresosDelMes - egresosDelMes >= 0 ? 'var(--lime)' : 'var(--coral)' }}>
                {fmt(ingresosDelMes - egresosDelMes)}
              </span>
            </div>
          </div>
        </div>

        {/* Espaciador explícito — mismo criterio que el resto de la app. */}
        <div className="h-28 md:h-6" />
      </div>
    </div>
  )
}

function Pill({ active, accent, onClick, children }: { active: boolean; accent?: 'lime' | 'coral'; onClick: () => void; children: React.ReactNode }) {
  const activeStyle = accent === 'lime'
    ? { background: 'var(--lime-dim)', color: 'var(--lime)', border: '1px solid var(--lime)' }
    : accent === 'coral'
    ? { background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid var(--coral)' }
    : { background: 'var(--lime)', color: 'var(--lime-text)', border: '1px solid var(--lime)' }
  return (
    <button onClick={onClick} className="rounded-2xl px-3.5 py-2 text-[12px] font-semibold" style={active ? activeStyle : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}>
      {children}
    </button>
  )
}

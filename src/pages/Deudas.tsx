import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronUp, ChevronDown, Flame, Pencil } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import { COLORS, IconCircle, SectionHead, Empty, estiloTarjeta } from './Cuentas'
import { FREE_LIMITS } from '../lib/pro'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import logoBlanco from '../assets/logos/logo-blanco-transparente-web.png'
import { parseLocalDate } from '../lib/date'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

export default function Deudas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const { cuentas, deudas, transacciones, categorias, esPro, loading } = useFinanzas()
  const [tarjetaExpandidaId, setTarjetaExpandidaId] = useState<string | null>(null)
  const [movExpandidaId, setMovExpandidaId] = useState<string | null>(null)

  // Cuánto se ha pagado en puro interés por deuda, sin tocar la caché
  // grande de useFinanzas — es un dato chiquito, se trae aparte. Sirve
  // sobre todo para préstamos con un tercero, donde el interés corre
  // exista o no un pago ese mes — así se ve claro cuánto de lo pagado
  // nunca bajó el capital.
  const [interesPorDeuda, setInteresPorDeuda] = useState<Record<string, number>>({})
  // Los últimos pagos de cada deuda/crédito viven en la tabla pagos_deuda
  // (no en transacciones — ahí solo queda el registro genérico del
  // egreso/ingreso para el saldo de la cuenta, sin el vínculo directo).
  const [pagosDeuda, setPagosDeuda] = useState<{ id: string; deuda_id: string; monto_total: number; fecha: string }[]>([])
  useEffect(() => {
    if (!user || deudas.length === 0) { setInteresPorDeuda({}); setPagosDeuda([]); return }
    let cancelado = false
    supabase
      .from('pagos_deuda')
      .select('id, deuda_id, monto_total, monto_interes, fecha')
      .in('deuda_id', deudas.map((d) => d.id))
      .then(({ data }) => {
        if (cancelado || !data) return
        const acc: Record<string, number> = {}
        for (const p of data as { deuda_id: string; monto_interes: number }[]) {
          acc[p.deuda_id] = (acc[p.deuda_id] ?? 0) + p.monto_interes
        }
        setInteresPorDeuda(acc)
        setPagosDeuda(data as { id: string; deuda_id: string; monto_total: number; fecha: string }[])
      })
    return () => { cancelado = true }
  }, [user, deudas])

  const tarjetas = (() => {
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)
    const usos = new Map<string, number>()
    for (const t of transacciones) {
      if (!t.cuenta_id || parseLocalDate(t.fecha) < hace30) continue
      usos.set(t.cuenta_id, (usos.get(t.cuenta_id) ?? 0) + 1)
    }
    return cuentas
      .filter((c) => c.tipo === 'tarjeta_credito')
      .map((c) => ({ cuenta: c, usos: usos.get(c.id) ?? 0 }))
      .sort((a, b) => b.usos - a.usos)
  })()

  const deudasSolas = deudas.filter((d) => d.tipo === 'deuda')
  const creditos = deudas.filter((d) => d.tipo === 'credito')

  const debesTarjetas = tarjetas.reduce((s, { cuenta: c }) => s + ((c.cupo_total ?? 0) - c.saldo), 0)
  const debesDeudas = deudasSolas.reduce((s, d) => s + (d.capital - d.capital_pagado), 0)
  const debesTotal = debesTarjetas + debesDeudas
  const teDeben = creditos.reduce((s, c) => s + (c.capital - c.capital_pagado), 0)

  // Últimos 7 días de movimientos en una tarjeta de crédito — cargos
  // (egresos, suben lo usado) y pagos (transferencia hacia la tarjeta,
  // bajan lo usado).
  function resumenTarjeta(cuentaId: string) {
    const desde = new Date()
    desde.setDate(desde.getDate() - 7)
    const items = transacciones
      .filter((tx) => (tx.cuenta_id === cuentaId || tx.cuenta_destino_id === cuentaId) && parseLocalDate(tx.fecha) >= desde)
      .map((tx) => {
        const esPago = tx.tipo === 'transferencia' && tx.cuenta_destino_id === cuentaId
        const origen = esPago ? cuentas.find((c) => c.id === tx.cuenta_id)?.nombre ?? '' : ''
        const nombre = esPago
          ? t('deudas_pago_hacia', { cuenta: origen })
          : (tx.descripcion || nombreCategoria(categorias.find((c) => c.id === tx.categoria_id)?.nombre, idioma) || t('mov_otros'))
        return { id: tx.id, nombre, monto: tx.monto + tx.monto_4x1000, esPago }
      })
      .sort((a, b) => (a.id < b.id ? 1 : -1))
    const cargos = items.filter((i) => !i.esPago).reduce((s, i) => s + i.monto, 0)
    const pagos = items.filter((i) => i.esPago).reduce((s, i) => s + i.monto, 0)
    return { items: items.slice(0, 5), cargos, pagos }
  }

  // Últimos 7 días de abonos hechos a una deuda o cuenta por cobrar,
  // desde pagos_deuda (ya cargados arriba).
  function resumenAbonos(deudaId: string) {
    const desde = new Date()
    desde.setDate(desde.getDate() - 7)
    return pagosDeuda
      .filter((p) => p.deuda_id === deudaId && parseLocalDate(p.fecha) >= desde)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, 5)
      .map((p) => ({ id: p.id, fecha: p.fecha, monto: p.monto_total }))
  }

  function PanelTarjeta({ cuentaId, onEditar }: { cuentaId: string; onEditar: () => void }) {
    const { items, cargos, pagos } = resumenTarjeta(cuentaId)
    return (
      <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <div className="mb-1.5 text-[9px] uppercase tracking-wide opacity-70" style={{ color: 'var(--text-2)' }}>{t('deudas_ultimos_7_dias')}</div>
        <div className="mb-2 flex gap-2">
          <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('deudas_cargos')}</div>
            <div className="font-mono text-[12px] font-bold" style={{ color: 'var(--coral)' }}>+{fmt(cargos)}</div>
          </div>
          <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('deudas_pagos')}</div>
            <div className="font-mono text-[12px] font-bold" style={{ color: 'var(--lime)' }}>–{fmt(pagos)}</div>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="py-1.5 text-[10.5px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('deudas_sin_movimientos_semana')}</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between py-1 text-[11px]">
              <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-1)' }}>{it.nombre}</span>
              <span className="ml-2 flex-shrink-0 font-mono" style={{ color: it.esPago ? 'var(--lime)' : 'var(--coral)' }}>
                {it.esPago ? '–' : '+'}{fmt(it.monto)}
              </span>
            </div>
          ))
        )}
        <button onClick={onEditar} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.18)', color: 'var(--text-2)' }}>
          <Pencil size={12} /> {t('deudas_editar_tarjeta')}
        </button>
      </div>
    )
  }

  function PanelAbonos({ deudaId, onEditar, editLabel }: { deudaId: string; onEditar: () => void; editLabel: string }) {
    const abonos = resumenAbonos(deudaId)
    return (
      <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--line)' }}>
        <div className="mb-1.5 text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('deudas_abonos')} · {t('deudas_ultimos_7_dias').toLowerCase()}</div>
        {abonos.length === 0 ? (
          <div className="py-1.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('deudas_sin_abonos_semana')}</div>
        ) : (
          abonos.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-1 text-[11px]">
              <span style={{ color: 'var(--text-2)' }}>{new Date(a.fecha + 'T00:00:00').toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' })}</span>
              <span className="font-mono" style={{ color: 'var(--lime)' }}>{fmt(a.monto)}</span>
            </div>
          ))
        )}
        <button onClick={onEditar} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
          <Pencil size={12} /> {editLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pt-3 md:px-8 md:pt-6">
      <div className="mb-1 flex items-center justify-between pt-2 md:justify-center">
        <div style={{ width: 34 }} className="md:hidden" />
        <div className="text-[15px] font-semibold font-display">{t('deudas_titulo')}</div>
        <div className="md:hidden">
          <Avatar user={user} size={34} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      <div className="lg:mx-auto lg:max-w-[640px]">
        {/* Deudas: esta tarjeta es la única "negativa" de las tres heroes
        (Patrimonio neto en Cuentas/Resumen usa el lima), así que su fondo
        pasa de lima a --coral (el rojo de marca) — no tiene sentido que la
        pantalla de "cuánto debo" se vea en verde. Todo el texto en negro
        puro, mismo criterio que las demás tarjetas hero. */}
        <div className="mt-1.5 rounded-3xl p-5" style={{ background: 'var(--coral)' }}>
          <div className="text-xs" style={{ color: '#000000', opacity: 0.65 }}>{t('deudas_debes_total')}</div>
          <div className="mt-1 text-[25px] font-bold font-display font-mono" style={{ color: '#000000' }}>{fmt(debesTotal)}</div>
          {teDeben > 0 && (
            <div className="mt-3">
              <span className="text-[10.5px] font-semibold" style={{ color: '#000000' }}>● {t('deudas_te_deben')}</span>
              <div className="font-mono text-[13px] font-bold" style={{ color: '#000000' }}>{fmt(teDeben)}</div>
            </div>
          )}
        </div>

        <SectionHead title={t('seccion_tarjetas_credito')} onAdd={() => navigate('/cuentas/nueva?tipo=tarjeta_credito', { state: { from: '/deudas' } })} contador={!esPro ? `${tarjetas.length}/${FREE_LIMITS.maxTarjetasCredito} Free` : undefined} />
        {!loading && tarjetas.length === 0 && <Empty>{t('deudas_vacio_tarjetas')}</Empty>}
        {tarjetas.map(({ cuenta: c, usos }, idx) => {
          const usado = Math.max((c.cupo_total ?? 0) - c.saldo, 0)
          const interesEstimado = c.tasa_interes > 0 ? Math.round(usado * (c.tasa_interes / 100)) : 0
          const proyeccion = c.cuota_manejo + interesEstimado
          const pctUsado = c.cupo_total ? Math.min((usado / c.cupo_total) * 100, 100) : 0
          const esMasUsada = idx === 0 && usos > 0
          const expandida = tarjetaExpandidaId === c.id
          const grad = estiloTarjeta(c.color, c.diseno_tarjeta)

          if (!expandida) {
            return (
              <button
                key={c.id}
                onClick={() => setTarjetaExpandidaId(c.id)}
                className="relative mb-2 flex w-full items-center gap-2.5 overflow-hidden rounded-2xl py-2.5 pl-3 pr-3.5 text-left"
                style={{ background: 'var(--card)' }}
              >
                <div className="absolute inset-y-0 left-0" style={{ width: 4, background: (COLORS[c.color] ?? COLORS.lavender).fg }} />
                <div className="ml-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium">
                    {c.nombre}
                    {esMasUsada && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
                        <Flame size={8} /> {t('deudas_mas_usada')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                    {usos > 0 ? t('deudas_pct_usado', { pct: Math.round(pctUsado) }) : t('deudas_sin_uso')}
                    {c.dia_corte ? ` · ${t('deudas_corte_dia', { dia: c.dia_corte })}` : ''}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-[11.5px] font-semibold" style={{ color: (COLORS[c.color] ?? COLORS.lavender).fg }}>{fmt(usado)}</div>
                  <div className="text-[8px]" style={{ color: 'var(--text-3)' }}>{t('deudas_de_cupo', { monto: fmt(c.cupo_total ?? 0) })}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
              </button>
            )
          }

          return (
            <div key={c.id} className="relative mb-2.5 overflow-hidden rounded-2xl p-4" style={{ background: grad.background }}>
              {c.diseno_tarjeta === 'oscuro' && (
                <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px)' }} />
              )}
              <img
                src={logoBlanco}
                alt=""
                className="absolute pointer-events-none select-none"
                style={{ right: 6, top: '20%', width: 92, opacity: 0.2, filter: 'blur(1px)', transform: 'rotate(-18deg)' }}
              />
              <div className="relative mb-4 flex items-start justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-bold font-display" style={{ color: grad.text }}>
                  {c.nombre}
                  {esMasUsada && (
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase" style={{ background: 'rgba(0,0,0,0.16)', color: grad.text }}>
                      <Flame size={8} /> {t('deudas_mas_usada')}
                    </span>
                  )}
                </div>
                <button onClick={() => setTarjetaExpandidaId(null)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.28)', color: grad.text }}>
                  <ChevronUp size={14} />
                </button>
              </div>

              <button onClick={() => navigate(`/cuentas/${c.id}/editar`, { state: { from: '/deudas' } })} className="relative block w-full text-left">
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,0.22)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pctUsado}%`, background: 'rgba(0,0,0,0.55)' }} />
                </div>
                <div className="mt-2.5 flex items-end justify-between" style={{ color: grad.text }}>
                  <div><div className="text-[8px] uppercase opacity-75">{t('deudas_usado')}</div><div className="font-mono text-[15px] font-bold">{fmt(usado)}</div></div>
                  <div className="text-right"><div className="text-[8px] uppercase opacity-75">{t('deudas_cupo')}</div><div className="font-mono text-[15px] font-bold">{fmt(c.cupo_total ?? 0)}</div></div>
                </div>
                {(c.dia_corte || c.dia_pago || c.tasa_interes > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-x-2 text-[9px] opacity-80" style={{ color: grad.text }}>
                    {c.dia_corte ? <span>{t('deudas_corte_dia', { dia: c.dia_corte })}</span> : null}
                    {c.dia_pago ? <span>· {t('deudas_paga_dia', { dia: c.dia_pago })}</span> : null}
                    {c.tasa_interes > 0 ? <span>· {t('deudas_interes', { pct: c.tasa_interes })}</span> : null}
                  </div>
                )}
                {(c.cuota_manejo > 0 || interesEstimado > 0) && (
                  <div className="mt-1.5 text-[9.5px] font-semibold" style={{ color: grad.text }}>
                    {t('deudas_proyeccion_corte', { monto: fmt(proyeccion) })}
                    {c.cuota_manejo > 0 && interesEstimado > 0 ? t('deudas_manejo_e_interes', { manejo: fmt(c.cuota_manejo), interes: fmt(interesEstimado) }) : c.cuota_manejo > 0 ? t('deudas_de_manejo') : t('deudas_de_interes_est')}
                  </div>
                )}
                <div className="mt-2.5 text-[8.5px] underline opacity-70" style={{ color: grad.text }}>{t('deudas_toca_editar')}</div>
              </button>
              <PanelTarjeta cuentaId={c.id} onEditar={() => navigate(`/cuentas/${c.id}/editar`, { state: { from: '/deudas' } })} />
            </div>
          )
        })}

        <SectionHead title={t('seccion_deudas')} onAdd={() => navigate('/cuentas/nueva?tipo=deuda', { state: { from: '/deudas' } })} contador={!esPro ? `${deudasSolas.length}/${FREE_LIMITS.maxDeudas} Free` : undefined} />
        {!loading && deudasSolas.length === 0 && <Empty>{t('deudas_vacio_deudas')}</Empty>}
        {deudasSolas.map((d) => {
          const pctPagado = d.capital > 0 ? Math.min((d.capital_pagado / d.capital) * 100, 100) : 0
          const interesPagado = interesPorDeuda[d.id] ?? 0
          const expandida = movExpandidaId === d.id
          return (
            <div key={d.id} className="mb-2.5 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
              <button onClick={() => setMovExpandidaId(expandida ? null : d.id)} className="flex w-full items-center gap-3 text-left">
              <IconCircle icono="scale" color="coral" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{d.nombre}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {t('deudas_deuda')}{d.tipo_interes === 'fijo_capital' ? t('deudas_interes_fijo') : ''}
                  {d.fecha_limite ? t('deudas_corte_fecha', { fecha: parseLocalDate(d.fecha_limite).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' }) }) : ''}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pctPagado}%`, background: pctPagado >= 100 ? 'var(--lime)' : 'var(--coral)' }} />
                </div>
                <div className="mt-1 text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                  {pctPagado > 0
                    ? t('deudas_pagado_de', { pagado: fmt(d.capital_pagado), total: fmt(d.capital), pct: Math.round(pctPagado) })
                    : t('deudas_nada_pagado', { total: fmt(d.capital) })}
                </div>
                {d.tipo_interes === 'fijo_capital' && interesPagado > 0 && (
                  <div className="mt-1 text-[9.5px]" style={{ color: 'var(--yellow)' }}>
                    {t('deudas_solo_interes', { monto: fmt(interesPagado) })}
                  </div>
                )}
              </div>
              <div className="ml-auto flex-shrink-0 font-mono text-[13px]" style={{ color: 'var(--coral)' }}>{fmt(d.capital - d.capital_pagado)}</div>
              {expandida ? <ChevronUp size={14} style={{ color: 'var(--lime)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
              </button>
              {expandida && <PanelAbonos deudaId={d.id} editLabel={t('deudas_editar_deuda')} onEditar={() => navigate(`/cuentas/${d.id}/editar`, { state: { from: '/deudas' } })} />}
            </div>
          )
        })}

        <SectionHead title={t('seccion_cuentas_cobrar')} onAdd={() => navigate('/cuentas/nueva?tipo=credito', { state: { from: '/deudas' } })} contador={!esPro ? `${creditos.length}/${FREE_LIMITS.maxCuentasPorCobrar} Free` : undefined} />
        {!loading && creditos.length === 0 && <Empty>{t('deudas_vacio_cobrar')}</Empty>}
        {creditos.map((c) => {
          const pctCobrado = c.capital > 0 ? Math.min((c.capital_pagado / c.capital) * 100, 100) : 0
          const interesCobrado = interesPorDeuda[c.id] ?? 0
          const expandida = movExpandidaId === c.id
          return (
            <div key={c.id} className="mb-2.5 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
              <button onClick={() => setMovExpandidaId(expandida ? null : c.id)} className="flex w-full items-center gap-3 text-left">
              <IconCircle icono="arrow-back-up" color="yellow" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{c.nombre}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{t('deudas_te_deben_label')}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pctCobrado}%`, background: pctCobrado >= 100 ? 'var(--lime)' : 'var(--yellow)' }} />
                </div>
                <div className="mt-1 text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                  {pctCobrado > 0
                    ? t('deudas_cobrado_de', { cobrado: fmt(c.capital_pagado), total: fmt(c.capital), pct: Math.round(pctCobrado) })
                    : t('deudas_nada_cobrado', { total: fmt(c.capital) })}
                </div>
                {c.tipo_interes === 'fijo_capital' && interesCobrado > 0 && (
                  <div className="mt-1 text-[9.5px]" style={{ color: 'var(--yellow)' }}>
                    {t('deudas_solo_interes_cobrado', { monto: fmt(interesCobrado) })}
                  </div>
                )}
              </div>
              <div className="ml-auto flex-shrink-0 font-mono text-[13px]" style={{ color: 'var(--yellow)' }}>{fmt(c.capital - c.capital_pagado)}</div>
              {expandida ? <ChevronUp size={14} style={{ color: 'var(--lime)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
              </button>
              {expandida && <PanelAbonos deudaId={c.id} editLabel={t('deudas_editar_credito')} onEditar={() => navigate(`/cuentas/${c.id}/editar`, { state: { from: '/deudas' } })} />}
            </div>
          )
        })}
      </div>

      {/* Espaciador — mismo criterio que Cuentas.tsx, ver ahí el porqué. */}
      <div className="h-28 md:h-6" />
    </div>
  )
}

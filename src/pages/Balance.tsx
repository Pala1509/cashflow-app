import { useNavigate } from 'react-router-dom'
import { Plus, MoreHorizontal } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useAuth } from '../lib/AuthContext'
import Avatar from '../components/Avatar'
import { ICONS, COLORS } from './Cuentas'
import { parseLocalDate } from '../lib/date'
import { FREE_LIMITS } from '../lib/pro'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import type { ClaveTraduccion } from '../lib/i18n'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// El círculo tiene un ancho fijo — un número con muchos dígitos
// ("$-10.500.000") se saldría o se sobrepondría con un tamaño de letra
// fijo. En vez de abreviar a "M" (en una app financiera, perder la
// precisión exacta del peso no es buena idea), se reduce el tamaño de
// letra según cuántos caracteres tenga el texto formateado — así
// siempre se ve el número completo y exacto, solo un poco más chico
// cuando hace falta.
function tamanoDisponible(texto: string): string {
  const len = texto.length
  if (len <= 8) return '19px'
  if (len <= 10) return '16px'
  if (len <= 12) return '14px'
  return '12px'
}
const FREC_KEY: Record<string, ClaveTraduccion> = {
  quincenal: 'frec_quincenal', mensual: 'frec_mensual', trimestral: 'frec_trimestral', semestral: 'frec_semestral', anual: 'frec_anual',
}
const FREC_DIAS: Record<string, number> = {
  quincenal: 15, mensual: 30, trimestral: 90, semestral: 180, anual: 365,
}

// Arco SVG real (no un círculo completo con dasharray) — así el patrón de
// "cuentas separadas" (como en Buddy) solo se ve DENTRO de ese tramo, en
// vez de tener que calzar un patrón que se repite en todo el círculo.
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const start = toXY(endDeg)
  const end = toXY(startDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

export default function Balance() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const {
    ingresosFijos, gastosFijos, metas, categorias, transacciones, loading, esPro,
    totalIngresosFijos, totalGastosFijos, totalAporteMetas, disponibleLibre,
  } = useFinanzas()
  // El ícono de cada fijo toma el color de su categoría, así no salen todos
  // del mismo color (verde los ingresos, rojo los gastos) y se distinguen.
  const colorDeCategoria = (categoriaId: string | null, porDefecto: string) => {
    const col = COLORS[categorias.find((c) => c.id === categoriaId)?.color ?? ''] ?? COLORS[porDefecto]
    return { background: col.dim, color: col.fg }
  }

  const total = totalIngresosFijos || 1
  const gasPct = Math.min(Math.max(totalGastosFijos / total, 0), 1)
  const ahoPct = Math.min(Math.max(totalAporteMetas / total, 0), 1)
  const librePct = Math.max(1 - gasPct - ahoPct, 0)

  // Anillo continuo y sólido — sin huecos entre segmentos ni puntas
  // redondeadas (antes era estilo "Buddy", segmentos separados; ahora es
  // un donut clásico de una sola pieza, como el de la demo).
  const segsPct = [gasPct, ahoPct, librePct].filter((p) => p > 0.003)

  let cursor = 0
  const gasArc = gasPct > 0.003 ? { start: cursor, end: (cursor += gasPct * 360) } : null
  const ahoArc = ahoPct > 0.003 ? { start: cursor, end: (cursor += ahoPct * 360) } : null
  const libreArc = librePct > 0.003 ? { start: cursor, end: cursor + librePct * 360 } : null

  const donutBlock = (
    <>
      <div className="relative mx-auto mt-1.5 flex justify-center lg:mx-0" style={{ width: 190, height: 190 }} data-tour="balance-donut">
        <svg width="190" height="190" viewBox="0 0 230 230">
          <circle cx="115" cy="115" r="92" fill="none" stroke="var(--card-2)" strokeWidth="26" />
          {segsPct.length === 1 ? (
            // Un solo segmento cubre el 100% — el arco SVG no puede
            // dibujar un círculo completo con path, así que se usa el
            // círculo base directo con el color correspondiente.
            <circle
              cx="115" cy="115" r="92" fill="none" strokeWidth="26"
              stroke={gasArc ? 'var(--coral)' : ahoArc ? 'var(--lime)' : 'var(--lavender)'}
            />
          ) : (
            <>
              {gasArc && <path d={describeArc(115, 115, 92, gasArc.start, gasArc.end)} fill="none" stroke="var(--coral)" strokeWidth="26" />}
              {ahoArc && <path d={describeArc(115, 115, 92, ahoArc.start, ahoArc.end)} fill="none" stroke="var(--lime)" strokeWidth="26" />}
              {libreArc && <path d={describeArc(115, 115, 92, libreArc.start, libreArc.end)} fill="none" stroke="var(--lavender)" strokeWidth="26" />}
            </>
          )}
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('balance_libre_despues')}</div>
          <div className="mt-0.5 font-mono font-bold font-display" style={{ color: disponibleLibre >= 0 ? 'var(--lime)' : 'var(--coral)', fontSize: tamanoDisponible(fmt(disponibleLibre)) }}>
            {fmt(disponibleLibre)}
          </div>
        </div>
      </div>

      <div className="mb-1.5 mt-3 flex justify-center gap-4.5 text-[10.5px] lg:justify-start">
        <span style={{ color: 'var(--coral)' }}>● {t('balance_gastos_fijos_leyenda')}</span>
        <span style={{ color: 'var(--lime)' }}>● {t('balance_ahorro_metas_leyenda')}</span>
        <span style={{ color: 'var(--lavender)' }}>● {t('balance_libre_leyenda')}</span>
      </div>

      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
          <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('balance_ingresos_fijos')}</div>
          <div className="mt-0.5 font-mono text-base font-bold font-display" style={{ color: 'var(--lime)' }}>{fmt(totalIngresosFijos)}</div>
        </div>
        <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
          <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('balance_gastos_fijos')}</div>
          <div className="mt-0.5 font-mono text-base font-bold font-display" style={{ color: 'var(--coral)' }}>{fmt(totalGastosFijos)}</div>
        </div>
      </div>

      <SectionHead title={t('seccion_ingresos_fijos')} onAdd={() => navigate('/balance/nuevo?tipo=ingreso_fijo')} contador={!esPro ? `${ingresosFijos.length}/${FREE_LIMITS.maxIngresosFijos} Free` : undefined} />
      {!loading && ingresosFijos.length === 0 && <Empty>{t('balance_vacio_ingresos')}</Empty>}
      {ingresosFijos.map((i) => {
        const Icon = ICONS[i.icono] ?? MoreHorizontal
        const ciclo = FREC_DIAS[i.frecuencia] ?? 30
        const cortePagos = new Date()
        cortePagos.setDate(cortePagos.getDate() - ciclo)
        const cobrosVinculados = transacciones.filter((t) => t.ingreso_fijo_id === i.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
        const ultimoCobro = cobrosVinculados[0] ?? null
        const cobrosDelCiclo = cobrosVinculados.filter((c) => parseLocalDate(c.fecha) >= cortePagos)
        const montoCobradoCiclo = cobrosDelCiclo.reduce((s, c) => s + c.monto, 0)
        const recibido = montoCobradoCiclo >= i.monto
        const recibidoParcial = montoCobradoCiclo > 0 && !recibido
        const diasDesdeCobro = ultimoCobro ? Math.floor((Date.now() - parseLocalDate(ultimoCobro.fecha).getTime()) / (24 * 60 * 60 * 1000)) : null
        // Mismo arreglo que en gastos fijos — la barra tiene que reflejar
        // cuánto llevas recibido del monto total, no cuántos días llevas
        // sin cobrar (eran dos cosas distintas mostrando el mismo lugar).
        const pctBarraIng = i.monto > 0 ? Math.min((montoCobradoCiclo / i.monto) * 100, 100) : 0
        const atrasado = !recibido && !recibidoParcial && ultimoCobro !== null
        return (
          <button key={i.id} onClick={() => navigate(`/balance/${i.id}/editar`)} className="mb-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={colorDeCategoria(i.categoria_id, 'lime')}>
              <Icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium">
                {i.nombre}
                {recibido && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>{t('balance_recibido')}</span>}
                {recibidoParcial && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>{t('balance_parcial')}</span>}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                {t(FREC_KEY[i.frecuencia] ?? 'frec_mensual')}{i.categoria_id ? ` · ${nombreCategoria(categorias.find((c) => c.id === i.categoria_id)?.nombre, idioma)}` : ''}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${recibido || atrasado ? 100 : pctBarraIng}%`, background: recibido ? 'var(--lime)' : recibidoParcial ? 'var(--yellow)' : atrasado ? 'var(--coral)' : 'var(--yellow)' }} />
              </div>
              <div className="mt-1 text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                {recibidoParcial
                  ? t('balance_recibidos_de', { cobrado: fmt(montoCobradoCiclo), total: fmt(i.monto), falta: fmt(i.monto - montoCobradoCiclo) })
                  : ultimoCobro
                    ? recibido
                      ? t('balance_recibido_hace', { n: diasDesdeCobro ?? 0, s: diasDesdeCobro === 1 ? '' : 's', dias: Math.max(ciclo - (diasDesdeCobro ?? 0), 0) })
                      : t('balance_atrasado', { n: Math.max((diasDesdeCobro ?? 0) - ciclo, 0), s: Math.max((diasDesdeCobro ?? 0) - ciclo, 0) === 1 ? '' : 's' })
                    : t('balance_sin_vincular_cobro')}
              </div>
            </div>
            <div className="ml-auto font-mono text-[13px]" style={{ color: recibido ? 'var(--text-3)' : 'var(--lime)' }}>{fmt(i.monto)}</div>
          </button>
        )
      })}

      <SectionHead title={t('seccion_gastos_fijos')} onAdd={() => navigate('/balance/nuevo?tipo=gasto_fijo')} contador={!esPro ? `${gastosFijos.length}/${FREE_LIMITS.maxGastosFijos} Free` : undefined} />
      {!loading && gastosFijos.length === 0 && <Empty>{t('balance_vacio_gastos')}</Empty>}
      {gastosFijos.map((g) => {
        const Icon = ICONS[g.icono] ?? MoreHorizontal
        const ciclo = FREC_DIAS[g.frecuencia] ?? 30
        const cortePagos = new Date()
        cortePagos.setDate(cortePagos.getDate() - ciclo)
        const pagosVinculados = transacciones.filter((t) => t.gasto_fijo_id === g.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
        const ultimoPago = pagosVinculados[0] ?? null
        // No basta con que exista UN pago vinculado — hay que sumar lo pagado
        // dentro del ciclo actual y compararlo contra el valor completo del
        // gasto fijo. Antes, con pagar $7.200 de un parqueadero de $260.000
        // ya marcaba "PAGADO", lo cual no tiene sentido.
        const pagosDelCiclo = pagosVinculados.filter((p) => parseLocalDate(p.fecha) >= cortePagos)
        // Lo que "cuenta" como pago hacia el gasto fijo es SOLO el monto
        // real — el 4x1000 es un cobro del banco, no hace parte de lo que
        // le abonas al gasto (antes se sumaba por error, inflando el
        // "pagado" con dinero que en realidad se fue en impuesto).
        const montoPagadoCiclo = pagosDelCiclo.reduce((s, p) => s + p.monto, 0)
        const pagado = montoPagadoCiclo >= g.monto
        const pagadoParcial = montoPagadoCiclo > 0 && !pagado
        const diasDesdePago = ultimoPago ? Math.floor((Date.now() - parseLocalDate(ultimoPago.fecha).getTime()) / (24 * 60 * 60 * 1000)) : null
        // La barra tiene que mostrar lo mismo que dice el texto de abajo
        // (cuánto llevas pagado del monto total) — antes mostraba algo
        // completamente distinto: cuántos días llevas SIN pagar, lo cual
        // no tiene nada que ver con el % pagado y hacía que la barra y el
        // número dijeran cosas distintas.
        const pctBarra = g.monto > 0 ? Math.min((montoPagadoCiclo / g.monto) * 100, 100) : 0
        // Mismo criterio que ya usaba el texto de abajo ("Vencido hace X
        // días"): hubo un pago alguna vez, pero nada todavía en este ciclo.
        const vencido = !pagado && !pagadoParcial && ultimoPago !== null
        return (
          <button key={g.id} onClick={() => navigate(`/balance/${g.id}/editar`)} className="mb-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={colorDeCategoria(g.categoria_id, 'coral')}>
              <Icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-medium">
                {g.nombre}
                {pagado && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>{t('balance_pagado')}</span>}
                {pagadoParcial && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>{t('balance_parcial')}</span>}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                {t(FREC_KEY[g.frecuencia] ?? 'frec_mensual')}{g.categoria_id ? ` · ${nombreCategoria(categorias.find((c) => c.id === g.categoria_id)?.nombre, idioma)}` : ''}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${pagado || vencido ? 100 : pctBarra}%`, background: pagado ? 'var(--lime)' : pagadoParcial ? 'var(--yellow)' : vencido ? 'var(--coral)' : 'var(--yellow)' }} />
              </div>
              <div className="mt-1 text-[9.5px]" style={{ color: pagado ? 'var(--text-3)' : vencido ? 'var(--coral)' : 'var(--text-3)' }}>
                {pagadoParcial
                  ? t('balance_pagados_de', { pagado: fmt(montoPagadoCiclo), total: fmt(g.monto), falta: fmt(g.monto - montoPagadoCiclo) })
                  : ultimoPago
                    ? pagado
                      ? t('balance_pagado_hace', { n: diasDesdePago ?? 0, s: diasDesdePago === 1 ? '' : 's', dias: Math.max(ciclo - (diasDesdePago ?? 0), 0) })
                      : t('balance_vencido_hace', { n: Math.max((diasDesdePago ?? 0) - ciclo, 0), s: Math.max((diasDesdePago ?? 0) - ciclo, 0) === 1 ? '' : 's' })
                    : t('balance_sin_vincular_pago')}
              </div>
            </div>
            <div className="ml-auto font-mono text-[13px]" style={{ color: pagado ? 'var(--text-3)' : 'var(--coral)' }}>{fmt(g.monto)}</div>
          </button>
        )
      })}
    </>
  )

  const sideBlock = (
    <>
      <SectionHead title={t('seccion_metas_ahorro')} onAdd={() => navigate('/balance/nuevo?tipo=meta')} label={t('balance_nueva')} first contador={!esPro ? `${metas.filter((m) => m.estado === 'activa').length}/${FREE_LIMITS.maxMetasActivas} Free` : undefined} />
      {!loading && metas.length === 0 && <Empty>{t('balance_vacio_metas')}</Empty>}
      {metas.map((g) => {
        const pct = g.monto_objetivo > 0 ? Math.round((g.monto_actual / g.monto_objetivo) * 100) : 0
        const Icon = ICONS[g.icono] ?? MoreHorizontal
        const color = g.color === 'coral' ? 'var(--coral)' : g.color === 'yellow' ? 'var(--yellow)' : g.color === 'lavender' ? 'var(--lavender)' : 'var(--lime)'
        const dim = g.color === 'coral' ? 'var(--coral-dim)' : g.color === 'yellow' ? 'var(--yellow-dim)' : g.color === 'lavender' ? 'var(--lavender-dim)' : 'var(--lime-dim)'

        // Cuántos meses han pasado desde que creaste la meta, cuánto
        // deberías llevar aportado a ese ritmo, y si te quedaste atrás,
        // a cuántas "cuotas" (aportes mensuales) equivale ese atraso.
        const mesesTranscurridos = Math.max(
          Math.floor((Date.now() - parseLocalDate(g.created_at.slice(0, 10)).getTime()) / (30 * 24 * 60 * 60 * 1000)),
          0
        )
        const esperado = mesesTranscurridos * g.aporte_mensual
        const atraso = esperado - g.monto_actual
        const cuotasPendientes = g.estado === 'activa' && g.aporte_mensual > 0 && atraso > 0 ? Math.ceil(atraso / g.aporte_mensual) : 0

        return (
          <button key={g.id} onClick={() => navigate(`/balance/${g.id}/editar`)} className="mb-2.5 flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: dim, color }}>
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {g.nombre}
                  {cuotasPendientes > 0 && (
                    <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                      {cuotasPendientes} {cuotasPendientes === 1 ? t('balance_cuota_atrasada') : t('balance_cuotas_atrasadas')}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11.5px]">{fmt(g.monto_objetivo)}</div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
              </div>
              <div className="mt-1.5 text-[10.5px]" style={{ color: 'var(--text-2)' }}>
                {t('balance_pct_completado', { pct, monto: fmt(g.aporte_mensual) })}
              </div>
            </div>
          </button>
        )
      })}

      <button
        onClick={() => navigate('/presupuestos')}
        className="mt-5.5 mb-2 flex w-full items-center justify-between rounded-2xl p-4"
        style={{ background: 'var(--card)' }}
      >
        <div className="text-left">
          <div className="text-sm font-semibold">{t('balance_presupuestos_titulo')}</div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('balance_presupuestos_desc')}</div>
        </div>
        <span className="text-[11.5px]" style={{ color: 'var(--lime)' }}>{t('balance_ver')}</span>
      </button>
    </>
  )

  return (
    <div className="px-5 pt-3 md:px-8 md:pt-6">
      <div className="mb-1 flex items-center justify-between pt-2 md:justify-center">
        <div style={{ width: 34 }} className="md:hidden" />
        <div className="text-[15px] font-semibold font-display">{t('balance_titulo')}</div>
        <div className="md:hidden">
          <Avatar user={user} size={34} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      <div className="lg:mx-auto lg:mt-2 lg:grid lg:max-w-[900px] lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>{donutBlock}</div>
        <div>{sideBlock}</div>
      </div>

      {/* Espaciador explícito — no depender solo del padding del shell para
          que el contenido no quede tapado por la tab bar/borde inferior.
          Más grande en celular a propósito (tab bar fija ~4.5rem + margen),
          vuelve a ser chico en desktop/tablet donde no hay tab bar. */}
      <div className="h-28 md:h-6" />
    </div>
  )
}

function SectionHead({ title, onAdd, label, first, contador }: { title: string; onAdd: () => void; label?: string; first?: boolean; contador?: string }) {
  const { t } = useIdioma()
  return (
    <div className={`mb-2.5 flex items-center justify-between ${first ? 'mt-1.5 lg:mt-0' : 'mt-5.5'}`}>
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">{title}</div>
        {contador && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>{contador}</span>}
      </div>
      <button onClick={onAdd} className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--lime)' }}>
        {label ?? (<><Plus size={13} /> {t('cuentas_agregar')}</>)}
      </button>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-3.5 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{children}</div>
}

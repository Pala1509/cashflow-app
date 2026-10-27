import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, DollarSign, Wand2, Scale, Target, Bug } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { calcularGastosHormigaProducto } from '../lib/gastosHormiga'
import { mesesParaPagarDeuda } from '../lib/interes'
import { useIdioma } from '../lib/IdiomaContext'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { ICONS, COLORS } from './Cuentas'
import type { DeudaCredito, MetaAhorro } from '../lib/database.types'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Meses -> "X años Y meses" / "X meses" — para que el resultado se lea
// natural en vez de "14 meses" cuando en realidad es "1 año 2 meses".
function fmtMeses(n: number, t: (k: any, v?: any) => string): string {
  if (n <= 0) return t('sim_ya')
  const anios = Math.floor(n / 12)
  const meses = n % 12
  if (anios === 0) return t('sim_n_meses', { n: meses })
  if (meses === 0) return t('sim_n_anios', { n: anios })
  return t('sim_n_anios_n_meses', { anios, meses })
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha)
  d.setMonth(d.getMonth() + meses)
  return d
}

export default function Simulador() {
  const navigate = useNavigate()
  const { t, idioma } = useIdioma()
  const { transacciones, deudas, metas, esPro } = useFinanzas()
  const [showPaywall, setShowPaywall] = useState(false)

  const gastosHormiga = calcularGastosHormigaProducto(transacciones)
  // La ventana de gastos hormiga es de 15 días — se duplica para
  // estimar un equivalente mensual, misma lógica que ya usa Resumen
  // para mostrar el total quincenal.
  const hormigaOpciones = gastosHormiga.items.slice(0, 5).map((h) => ({ nombre: h.nombre, mensual: h.total * 2 }))

  const [hormigaSel, setHormigaSel] = useState<string | null>(hormigaOpciones[0]?.nombre ?? null)
  const [montoManual, setMontoManual] = useState('')
  const usandoManual = montoManual.trim().length > 0
  const ahorroMensual = usandoManual
    ? Number(montoManual || 0)
    : (hormigaOpciones.find((h) => h.nombre === hormigaSel)?.mensual ?? 0)

  const deudasConSaldo = deudas.filter((d) => d.tipo === 'deuda' && (d.capital - d.capital_pagado) > 0)
  const metasActivas = metas.filter((m) => m.estado === 'activa' && !m.congelada)

  type Destino = { tipo: 'deuda'; item: DeudaCredito } | { tipo: 'meta'; item: MetaAhorro }
  const [destino, setDestino] = useState<Destino | null>(null)

  const resultado = useMemo(() => {
    if (!destino || ahorroMensual <= 0) return null
    if (destino.tipo === 'deuda') {
      const d = destino.item
      const pendiente = d.capital - d.capital_pagado
      const pagoBase = d.cuota_mensual && d.cuota_mensual > 0 ? d.cuota_mensual : pendiente / 12
      const mesesSinCambio = mesesParaPagarDeuda(pendiente, d.capital, d.tipo_interes, d.tasa_interes, d.periodo_interes, pagoBase)
      const mesesConCambio = mesesParaPagarDeuda(pendiente, d.capital, d.tipo_interes, d.tasa_interes, d.periodo_interes, pagoBase + ahorroMensual)
      if (mesesSinCambio === null || mesesConCambio === null) return null
      return { mesesSinCambio, mesesConCambio, diferencia: mesesSinCambio - mesesConCambio }
    } else {
      const m = destino.item
      const falta = m.monto_objetivo - m.monto_actual
      if (falta <= 0) return { mesesSinCambio: 0, mesesConCambio: 0, diferencia: 0 }
      const mesesSinCambio = m.aporte_mensual > 0 ? Math.ceil(falta / m.aporte_mensual) : null
      const mesesConCambio = Math.ceil(falta / (m.aporte_mensual + ahorroMensual))
      if (mesesSinCambio === null) return null
      return { mesesSinCambio, mesesConCambio, diferencia: mesesSinCambio - mesesConCambio }
    }
  }, [destino, ahorroMensual])

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('sim_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      {!esPro ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            <Wand2 size={26} />
          </div>
          <div className="text-base font-bold font-display">{t('sim_paywall_titulo')}</div>
          <div className="mt-2 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{t('sim_paywall_desc')}</div>
          <button onClick={() => setShowPaywall(true)} className="mt-5 rounded-2xl px-6 py-3.5 text-[13px] font-bold" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
            {t('sim_ver_pro')}
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:mx-auto md:w-full md:max-w-[520px]">
          <div className="mb-2 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('sim_intro')}</div>

          {/* ---- Paso 1: qué dejarías de gastar ---- */}
          <div className="mb-2 mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            <Bug size={12} /> {t('sim_paso1')}
          </div>

          {hormigaOpciones.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {hormigaOpciones.map((h) => {
                const sel = !usandoManual && hormigaSel === h.nombre
                return (
                  <button
                    key={h.nombre}
                    onClick={() => { setHormigaSel(h.nombre); setMontoManual('') }}
                    className="rounded-2xl px-3.5 py-2.5 text-left"
                    style={{ background: sel ? 'var(--lime-dim)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--lime)' : 'var(--line)'}` }}
                  >
                    <div className="text-[12px] font-semibold" style={{ color: sel ? 'var(--lime)' : 'var(--text-1)' }}>{h.nombre}</div>
                    <div className="font-mono text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('sim_por_mes', { monto: fmt(h.mensual) })}</div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mb-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('sim_o_otro_monto')}</div>
          <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--text-3)' }}><DollarSign size={16} /></span>
            <input
              inputMode="numeric"
              value={montoManual ? Number(montoManual).toLocaleString('es-CO') : ''}
              onChange={(e) => setMontoManual(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('sim_placeholder_monto')}
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--text-1)' }}
            />
            <span className="flex-shrink-0 text-[11px]" style={{ color: 'var(--text-3)' }}>{t('sim_al_mes')}</span>
          </div>

          {/* ---- Paso 2: a qué se lo metes ---- */}
          <div className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            <Target size={12} /> {t('sim_paso2')}
          </div>

          {deudasConSaldo.length === 0 && metasActivas.length === 0 ? (
            <div className="rounded-xl p-3.5 text-[11px]" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>{t('sim_sin_destinos')}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {deudasConSaldo.map((d) => {
                const sel = destino?.tipo === 'deuda' && destino.item.id === d.id
                return (
                  <button
                    key={d.id}
                    onClick={() => setDestino({ tipo: 'deuda', item: d })}
                    className="flex items-center gap-3 rounded-2xl p-3.5 text-left"
                    style={{ background: sel ? 'var(--coral-dim)' : 'var(--card)', border: `1.5px solid ${sel ? 'var(--coral)' : 'var(--line)'}` }}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                      <Scale size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{d.nombre}</div>
                      <div className="font-mono text-[10.5px]" style={{ color: 'var(--text-3)' }}>{fmt(d.capital - d.capital_pagado)}</div>
                    </div>
                  </button>
                )
              })}
              {metasActivas.map((m) => {
                const Icon = ICONS[m.icono] ?? Target
                const col = COLORS[m.color] ?? COLORS.lavender
                const sel = destino?.tipo === 'meta' && destino.item.id === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setDestino({ tipo: 'meta', item: m })}
                    className="flex items-center gap-3 rounded-2xl p-3.5 text-left"
                    style={{ background: sel ? col.dim : 'var(--card)', border: `1.5px solid ${sel ? col.fg : 'var(--line)'}` }}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: col.dim, color: col.fg }}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{m.nombre}</div>
                      <div className="font-mono text-[10.5px]" style={{ color: 'var(--text-3)' }}>{fmt(m.monto_actual)} / {fmt(m.monto_objetivo)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ---- Resultado ---- */}
          {destino && ahorroMensual > 0 && (
            <div className="mt-5 rounded-2xl p-4" style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}>
              {resultado === null ? (
                <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t('sim_no_calculable')}</div>
              ) : resultado.diferencia <= 0 ? (
                <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t('sim_sin_diferencia')}</div>
              ) : (
                <>
                  <Wand2 size={18} style={{ color: 'var(--lime)' }} />
                  <div className="mt-2 text-[13.5px] font-semibold leading-relaxed">
                    {destino.tipo === 'deuda'
                      ? t('sim_resultado_deuda', { nombre: destino.item.nombre, tiempo: fmtMeses(resultado.diferencia, t) })
                      : t('sim_resultado_meta', { nombre: destino.item.nombre, tiempo: fmtMeses(resultado.diferencia, t) })}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--card)' }}>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                      {t('sim_sin_cambios')}<br />
                      <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-1)' }}>{fmtMeses(resultado.mesesSinCambio, t)}</span>
                    </div>
                    <div className="text-right text-[10.5px]" style={{ color: 'var(--lime)' }}>
                      {t('sim_con_el_cambio')}<br />
                      <span className="font-mono text-[11.5px] font-bold" style={{ color: 'var(--lime)' }}>{fmtMeses(resultado.mesesConCambio, t)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {t('sim_fecha_estimada', { fecha: sumarMeses(new Date(), resultado.mesesConCambio).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { month: 'long', year: 'numeric' }) })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-4 text-[9.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('sim_disclaimer')}</div>
        </div>
      )}

      {showPaywall && <ProPaywallSheet reason={t('sim_paywall_desc')} onClose={() => setShowPaywall(false)} />}
    </div>
  )
}

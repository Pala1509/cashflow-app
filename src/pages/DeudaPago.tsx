import { useMemo, useState } from 'react'
import { appAlert } from '../lib/dialogs'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X, DollarSign, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { todayLocal } from '../lib/date'
import { useIdioma } from '../lib/IdiomaContext'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
function firstWord(nombre: string | null | undefined, generico: string): string {
  const limpio = (nombre ?? '').trim()
  return limpio ? limpio.split(/\s+/)[0] : generico
}

export default function DeudaPago() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { deudas, cuentas, gastosFijos, reload } = useFinanzas()
  const { t } = useIdioma()

  const deuda = deudas.find((d) => d.id === id)
  const [monto, setMonto] = useState('')
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tipoPago, setTipoPago] = useState<'normal' | 'solo_interes' | 'solo_capital'>('normal')

  const pendiente = deuda ? deuda.capital - deuda.capital_pagado : 0
  const montoNum = Number(monto || 0)
  const esInteresFijo = deuda?.tipo_interes === 'fijo_capital'

  const { interes, capitalAbonado } = useMemo(() => {
    if (!deuda) return { interes: 0, capitalAbonado: 0 }

    // Con interés fijo sobre capital, tú decides a qué corresponde el pago
    // (a veces solo pagas el interés del mes, otras veces abonas capital
    // aparte) — no siempre tiene sentido calcularlo automático.
    if (deuda.tipo_interes === 'fijo_capital') {
      if (tipoPago === 'solo_interes') return { interes: montoNum, capitalAbonado: 0 }
      if (tipoPago === 'solo_capital') return { interes: 0, capitalAbonado: Math.min(montoNum, pendiente) }
    }

    let interesCalc = 0
    if (deuda.tipo_interes === 'fijo_capital') {
      interesCalc = Math.round(deuda.capital * (deuda.tasa_interes / 100))
    } else if (deuda.tipo_interes === 'sobre_saldo') {
      interesCalc = Math.round(pendiente * (deuda.tasa_interes / 100))
    }
    const capitalCalc = Math.max(montoNum - interesCalc, 0)
    return { interes: interesCalc, capitalAbonado: Math.min(capitalCalc, pendiente) }
  }, [deuda, montoNum, pendiente, tipoPago])

  if (!deuda) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-3)' }}>{t('dp_cargando')}</div>
      </div>
    )
  }

  const esDeuda = deuda.tipo === 'deuda'
  const accent = esDeuda ? 'var(--coral)' : 'var(--yellow)'
  const accentDim = esDeuda ? 'var(--coral-dim)' : 'var(--yellow-dim)'
  const accentText = esDeuda ? '#2b0906' : '#2b2000'

  async function save() {
    if (!user || !deuda || !cuentaId || montoNum <= 0) return
    setSaving(true)

    const { error: pagoError } = await supabase.from('pagos_deuda').insert({
      deuda_id: deuda.id,
      monto_total: montoNum,
      monto_interes: interes,
      monto_capital: capitalAbonado,
      fecha: todayLocal(),
    })
    if (pagoError) { setSaving(false); await appAlert(t('dp_error_registrar_pago', { msg: pagoError.message })); return }

    const { error: txError } = await supabase.from('transacciones').insert({
      user_id: user.id,
      tipo: esDeuda ? 'egreso' : 'ingreso',
      monto: montoNum,
      monto_4x1000: 0,
      categoria_id: null,
      cuenta_id: cuentaId,
      gasto_fijo_id: deuda.gasto_fijo_id,
      descripcion: esDeuda ? t('dp_abono_a', { nombre: deuda.nombre }) : t('dp_cobro_de', { nombre: deuda.nombre }),
      fecha: todayLocal(),
    })

    setSaving(false)
    if (txError) { await appAlert(t('dp_error_ajustar_cuenta', { msg: txError.message })); }
    await reload()
    navigate(-1)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{esDeuda ? t('dp_titulo_pago') : t('dp_titulo_cobro')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mt-2 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
          <div className="text-[13px] font-semibold">{deuda.nombre}</div>
          <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
            {esDeuda ? t('dp_debes') : t('dp_te_deben')} <span className="font-mono" style={{ color: accent }}>{fmt(pendiente)}</span> {t('dp_de')} {fmt(deuda.capital)}
          </div>
          {deuda.tipo_interes !== 'sin_interes' && (
            <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {t('dp_interes_label')}: {deuda.tasa_interes}% {deuda.periodo_interes} · {deuda.tipo_interes === 'fijo_capital' ? t('dp_fijo_sobre_capital') : t('dp_sobre_saldo_pendiente')}
            </div>
          )}
          {(deuda.cuota_mensual || deuda.plazo_meses) && (
            <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {deuda.cuota_mensual ? t('dp_cuota_mensual', { monto: fmt(deuda.cuota_mensual) }) : ''}
              {deuda.cuota_mensual && deuda.plazo_meses ? ' · ' : ''}
              {deuda.plazo_meses ? t('dp_plazo_meses', { n: deuda.plazo_meses }) : ''}
            </div>
          )}
          {deuda.gasto_fijo_id && (
            <div className="mt-2 flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--lime)' }}>
              <Info size={11} /> {t('dp_va_marcar_pagado', { gasto: gastosFijos.find((g) => g.id === deuda.gasto_fijo_id)?.nombre ?? t('dp_tu_gasto_fijo') })}
            </div>
          )}
        </div>

        {esInteresFijo && (
          <>
            <FieldLabel>{t('dp_a_que_corresponde')}</FieldLabel>
            <div className="mb-1 flex flex-col gap-2">
              {[
                { id: 'normal' as const, nombre: t('dp_cuota_normal'), desc: t('dp_cuota_normal_desc') },
                { id: 'solo_interes' as const, nombre: t('dp_solo_interes'), desc: t('dp_solo_interes_desc') },
                { id: 'solo_capital' as const, nombre: t('dp_solo_capital'), desc: t('dp_solo_capital_desc') },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setTipoPago(o.id)}
                  className="rounded-2xl p-3 text-left"
                  style={{ border: `1.5px solid ${tipoPago === o.id ? accent : 'var(--line)'}`, background: tipoPago === o.id ? accentDim : 'var(--card)' }}
                >
                  <div className="text-[12.5px] font-semibold">{o.nombre}</div>
                  <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <FieldLabel>{esDeuda ? t('dp_monto_pagas') : t('dp_monto_pagan')}</FieldLabel>
        <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--text-3)' }}><DollarSign size={16} /></span>
          <input
            inputMode="numeric"
            value={monto ? Number(monto).toLocaleString('es-CO') : ''}
            onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="w-full bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text-1)' }}
          />
        </div>

        {montoNum > 0 && deuda.tipo_interes !== 'sin_interes' && (
          <div className="mt-3.5 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between py-1 text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="flex items-center gap-1"><Info size={11} /> {t('dp_interes_este_pago')}</span>
              <span className="font-mono">{fmt(interes)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs" style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 9, fontWeight: 600, color: accent }}>
              <span>{t('dp_va_a_capital')}</span>
              <span className="font-mono">{fmt(capitalAbonado)}</span>
            </div>
            {montoNum < interes && (
              <div className="mt-2 text-[10.5px]" style={{ color: 'var(--coral)' }}>
                {t('dp_no_alcanza_interes')}
              </div>
            )}
          </div>
        )}

        <FieldLabel>{esDeuda ? t('dp_sale_de') : t('dp_entra_a')} <span style={{ color: accent, textTransform: 'none', letterSpacing: 0 }}>{t('dp_obligatorio')}</span></FieldLabel>
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {cuentas.filter((c) => c.tipo !== 'tarjeta_credito').map((a) => (
            <button
              key={a.id}
              onClick={() => setCuentaId(a.id)}
              className="flex-shrink-0 rounded-2xl px-3 py-2.75 text-center"
              style={{ width: 84, background: cuentaId === a.id ? accentDim : 'var(--card)', border: `1.5px solid ${cuentaId === a.id ? accent : 'var(--line)'}` }}
            >
              <div className="text-[10px] font-medium" style={{ color: cuentaId === a.id ? accent : 'var(--text-1)' }}>{firstWord(a.nombre, t('dp_cuenta_generica'))}</div>
              <div className="mt-0.5 font-mono text-[9px]" style={{ color: 'var(--text-3)' }}>{fmt(a.saldo)}</div>
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving || montoNum <= 0 || !cuentaId}
          className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
          style={{ background: accent, color: accentText }}
        >
          {saving ? t('dp_guardando') : esDeuda ? t('dp_titulo_pago') : t('dp_titulo_cobro')}
        </button>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

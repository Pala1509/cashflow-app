import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { useFlujoCaja } from '../hooks/useFlujoCaja'
import { useIdioma } from '../lib/IdiomaContext'
import { parseLocalDate } from '../lib/date'
import FlujoGrafica from '../components/FlujoGrafica'
import ProPaywallSheet from '../components/ProPaywallSheet'

const fmt = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CO')
const PERIODOS = [7, 30, 90] as const
const FILAS_INICIALES = 5

export default function FlujoCaja() {
  const navigate = useNavigate()
  const { t, idioma } = useIdioma()
  const [dias, setDias] = useState<number>(30)
  const [verTodos, setVerTodos] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const { resultado, loading, esPro, tieneBase } = useFlujoCaja(dias)

  const locale = idioma === 'en' ? 'en-US' : 'es-CO'
  const fmtFecha = (f: string) => parseLocalDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const { hueco, eventos } = resultado
  const filas = verTodos ? eventos : eventos.slice(0, FILAS_INICIALES)

  function elegirPeriodo(d: number) {
    // 7 y 30 días son para todos; 90 días es de Pro.
    if (d === 90 && !esPro) { setShowPaywall(true); return }
    setDias(d)
    setVerTodos(false)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('flujo_titulo')}</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4.5 pt-3">
        {loading ? (
          <div className="py-10 text-center text-xs" style={{ color: 'var(--text-3)' }}>{t('inicio_cargando')}</div>
        ) : (
          <>
            <div className="mb-3 flex gap-1.5">
              {PERIODOS.map((d) => (
                <button
                  key={d}
                  onClick={() => elegirPeriodo(d)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px]"
                  style={d === dias ? { background: 'var(--lime)', color: 'var(--lime-text)', fontWeight: 600 } : { background: 'var(--card-2)', color: 'var(--text-2)' }}
                >
                  {t('flujo_n_dias', { dias: d })}
                  {d === 90 && !esPro && <Lock size={10} />}
                </button>
              ))}
            </div>

            {!tieneBase && (
              <button onClick={() => navigate('/balance')} className="mb-3 w-full rounded-2xl p-3.5 text-left text-[11.5px] leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
                {t('flujo_card_sin_datos')}
              </button>
            )}

            {hueco ? (
              <div className="mb-3 flex gap-2.5 rounded-2xl p-3.5" style={{ background: 'var(--coral-dim)', border: '1px solid var(--coral)' }}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--coral)', color: '#000' }}><AlertTriangle size={15} /></div>
                <div>
                  <div className="text-[13.5px] font-bold">{t('flujo_alerta_titulo', { fecha: fmtFecha(hueco.fecha), monto: fmt(hueco.falta) })}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--text-2)' }}>{t('flujo_alerta_desc')}</div>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex gap-2.5 rounded-2xl p-3.5" style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime)', color: '#000' }}><CheckCircle2 size={15} /></div>
                <div>
                  <div className="text-[13.5px] font-bold">{t('flujo_ok_titulo')}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--text-2)' }}>{t('flujo_ok_desc', { dias })}</div>
                </div>
              </div>
            )}

            <div className="rounded-2xl p-3 pb-2" style={{ background: 'var(--card)' }}>
              <div className="mb-1.5 flex justify-between px-1.5">
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('flujo_hoy_tienes')}</div>
                  <div className="font-mono text-[18px] font-bold">{fmt(resultado.saldoInicial)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('flujo_dentro_de', { dias })}</div>
                  <div className="font-mono text-[18px] font-bold" style={{ color: resultado.saldoFinal < 0 ? 'var(--coral)' : undefined }}>{fmt(resultado.saldoFinal)}</div>
                </div>
              </div>
              <FlujoGrafica resultado={resultado} idioma={idioma} />
            </div>

            <div className="mb-1 mt-5 text-sm font-semibold">{t('flujo_lo_que_viene')}</div>
            {eventos.length === 0 ? (
              <div className="py-4 text-[11.5px]" style={{ color: 'var(--text-3)' }}>{t('flujo_sin_eventos')}</div>
            ) : (
              <div>
                {filas.map((e, i) => {
                  const f = parseLocalDate(e.fecha)
                  const rojo = e.saldoDespues < 0
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                      <div className="flex h-[42px] w-[38px] flex-shrink-0 flex-col items-center justify-center rounded-xl leading-none" style={{ background: 'var(--card-2)' }}>
                        <b className="text-[15px]">{f.getDate()}</b>
                        <span className="mt-0.5 text-[9px] uppercase" style={{ color: 'var(--text-3)' }}>{f.toLocaleDateString(locale, { month: 'short' }).replace('.', '')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{e.nombre}</div>
                        <div className="mt-0.5 text-[10.5px]" style={{ color: rojo ? 'var(--coral)' : 'var(--text-3)' }}>
                          {t('flujo_te_queda', { monto: fmt(e.saldoDespues) })}{rojo ? ` · ${t('flujo_falta_plata')}` : ''}
                        </div>
                      </div>
                      <div className="flex-shrink-0 font-mono text-[12.5px] font-bold" style={{ color: e.monto > 0 ? 'var(--lime)' : 'var(--text-1)' }}>
                        {e.monto > 0 ? '+' : '–'}{fmt(Math.abs(e.monto)).replace('-', '')}
                      </div>
                    </div>
                  )
                })}
                {eventos.length > FILAS_INICIALES && (
                  <button onClick={() => setVerTodos(!verTodos)} className="mt-2 w-full py-1.5 text-center text-[11.5px]" style={{ color: 'var(--lime)' }}>
                    {verTodos ? t('flujo_ver_menos') : t('flujo_ver_todos', { n: eventos.length })}
                  </button>
                )}
              </div>
            )}

            <div className="mt-5 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {t('flujo_nota', { gasto: fmt(resultado.gastoDiario), reservas: fmt(resultado.reservas) })}
            </div>
          </>
        )}
        <div className="h-28 md:h-6" />
      </div>

      {showPaywall && <ProPaywallSheet reason={t('flujo_paywall')} onClose={() => setShowPaywall(false)} />}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react'
import { useFlujoCaja } from '../hooks/useFlujoCaja'
import { useIdioma } from '../lib/IdiomaContext'
import { parseLocalDate } from '../lib/date'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const DIAS = 30

// Tarjeta de Inicio: "Próximos 30 días" con la línea del saldo y, si se ve
// un hueco, el aviso con fecha y monto exactos. Un toque abre el flujo
// completo.
export default function FlujoCajaCard() {
  const navigate = useNavigate()
  const { t, idioma } = useIdioma()
  const { resultado, loading, tieneBase } = useFlujoCaja(DIAS)
  if (loading) return null

  if (!tieneBase) {
    return (
      <button onClick={() => navigate('/balance')} className="mt-5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}><TrendingUp size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">{t('flujo_card_titulo', { dias: DIAS })}</div>
          <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('flujo_card_sin_datos')}</div>
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
      </button>
    )
  }

  const { serie, hueco } = resultado
  const valores = serie.map((d) => d.saldo)
  const max = Math.max(...valores, 0), min = Math.min(...valores, 0)
  const rango = max - min || 1
  const w = 300, h = 36
  const pts = serie.map((d, i) => `${((i / (serie.length - 1)) * w).toFixed(1)},${(h - ((d.saldo - min) / rango) * (h - 4) - 2).toFixed(1)}`).join(' ')
  const y0 = h - ((0 - min) / rango) * (h - 4) - 2
  const fechaHueco = hueco ? parseLocalDate(hueco.fecha).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' }) : ''
  const color = hueco ? 'var(--coral)' : 'var(--lime)'

  return (
    <button
      onClick={() => navigate('/resumen/flujo')}
      className="mt-5 block w-full rounded-2xl p-3.5 text-left"
      style={{ background: 'var(--card)', border: `1px solid ${hueco ? 'var(--coral)' : 'var(--line)'}` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-semibold">{t('flujo_card_titulo', { dias: DIAS })}</div>
        <div className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--lime)' }}>{t('flujo_ver')} <ChevronRight size={12} /></div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={36} preserveAspectRatio="none" className="my-2">
        {hueco && <line x1="0" x2={w} y1={y0} y2={y0} style={{ stroke: 'var(--coral)', opacity: 0.7 }} strokeDasharray="3 4" strokeWidth="1" />}
        <polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {hueco ? (
        <>
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--coral)' }}>
            <AlertTriangle size={13} /> {t('flujo_alerta_titulo', { fecha: fechaHueco, monto: fmt(hueco.falta) })}
          </div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('flujo_card_enterate')}</div>
        </>
      ) : (
        <div className="text-[11.5px]" style={{ color: 'var(--lime)' }}>{t('flujo_card_ok')}</div>
      )}
    </button>
  )
}

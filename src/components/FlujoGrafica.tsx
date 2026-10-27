import { useId } from 'react'
import type { ResultadoFlujo } from '../lib/flujoCaja'
import { parseLocalDate } from '../lib/date'

// Línea del saldo proyectado: verde cuando estás en positivo, coral (y con
// el área sombreada) cuando baja de cero. Los puntos marcan los días con
// pagos o ingresos.
export default function FlujoGrafica({ resultado, idioma }: { resultado: ResultadoFlujo; idioma: 'es' | 'en' }) {
  const uid = useId().replace(/:/g, '')
  const { serie, eventos } = resultado
  const W = 330, H = 150
  const valores = serie.map((d) => d.saldo)
  const max = Math.max(...valores, 0), min = Math.min(...valores, 0)
  const pad = Math.max((max - min) * 0.12, 1)
  const hi = max + pad, lo = min - pad
  const X = (i: number) => 8 + (i * (W - 16)) / Math.max(serie.length - 1, 1)
  const Y = (v: number) => 8 + ((hi - v) * (H - 26)) / (hi - lo)
  const y0 = Y(0)
  const puntos = serie.map((d, i) => `${X(i).toFixed(1)},${Y(d.saldo).toFixed(1)}`).join(' ')
  const area = `M${X(0).toFixed(1)},${y0.toFixed(1)} ` + serie.map((d, i) => `L${X(i).toFixed(1)},${Y(d.saldo).toFixed(1)}`).join(' ') + ` L${X(serie.length - 1).toFixed(1)},${y0.toFixed(1)} Z`
  const indiceDe = (fecha: string) => serie.findIndex((d) => d.fecha === fecha)
  const fmtF = (fecha: string) => parseLocalDate(fecha).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' })
  const mitad = Math.floor((serie.length - 1) / 2)
  const hayNegativo = min < 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img">
      <defs>
        <clipPath id={`pos${uid}`}><rect x="0" y="0" width={W} height={y0} /></clipPath>
        <clipPath id={`neg${uid}`}><rect x="0" y={y0} width={W} height={H} /></clipPath>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--lime)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--lime)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${uid})`} clipPath={`url(#pos${uid})`} />
      {hayNegativo && <path d={area} style={{ fill: 'var(--coral)', fillOpacity: 0.35 }} clipPath={`url(#neg${uid})`} />}
      <line x1="8" x2={W - 8} y1={y0} y2={y0} style={{ stroke: 'var(--coral)', opacity: 0.8 }} strokeWidth="1" strokeDasharray="3 4" />
      <polyline points={puntos} fill="none" style={{ stroke: 'var(--lime)' }} strokeWidth="2.4" strokeLinejoin="round" clipPath={`url(#pos${uid})`} />
      {hayNegativo && <polyline points={puntos} fill="none" style={{ stroke: 'var(--coral)' }} strokeWidth="2.4" strokeLinejoin="round" clipPath={`url(#neg${uid})`} />}
      {eventos.map((e, i) => {
        const idx = indiceDe(e.fecha)
        if (idx < 0) return null
        const color = e.saldoDespues < 0 ? 'var(--coral)' : e.monto > 0 ? 'var(--lime)' : 'var(--text-1)'
        return <circle key={i} cx={X(idx)} cy={Y(e.saldoDespues)} r="3.4" style={{ fill: color, stroke: 'var(--card)' }} strokeWidth="1.5" />
      })}
      <text x={W - 8} y={y0 - 5} textAnchor="end" fontSize="9" style={{ fill: 'var(--coral)' }}>$0</text>
      <text x="8" y={H - 4} fontSize="9.5" style={{ fill: 'var(--text-3)' }}>{idioma === 'en' ? 'Today' : 'Hoy'}</text>
      <text x={X(mitad)} y={H - 4} textAnchor="middle" fontSize="9.5" style={{ fill: 'var(--text-3)' }}>{fmtF(serie[mitad].fecha)}</text>
      <text x={W - 8} y={H - 4} textAnchor="end" fontSize="9.5" style={{ fill: 'var(--text-3)' }}>{fmtF(serie[serie.length - 1].fecha)}</text>
    </svg>
  )
}

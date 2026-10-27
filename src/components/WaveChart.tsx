import { useMemo, useRef, useState } from 'react'
import { parseLocalDate } from '../lib/date'
import type { Transaccion } from '../lib/database.types'

const W = 335, H = 150
const ZERO_Y = H / 2 - 6 // línea central, un poco arriba de mitad para dejar espacio a las etiquetas de mes
const MAX_BAR = 52 // alto máximo de cada barra desde la línea central
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Gráfica de barras divergentes: ingresos suben desde una línea central,
// egresos bajan desde esa misma línea — así nunca hay que adivinar cuál
// línea es cuál, y los números viven arriba en su propio espacio fijo,
// nunca flotando encima de las barras.
export default function WaveChart({ transacciones }: { transacciones: Transaccion[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  const data = useMemo(() => {
    const now = new Date()
    const buckets: { label: string; ingreso: number; egreso: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ label: MESES[d.getMonth()], ingreso: 0, egreso: 0 })
    }
    transacciones.forEach((t) => {
      const td = parseLocalDate(t.fecha)
      const diffMonths = (now.getFullYear() - td.getFullYear()) * 12 + (now.getMonth() - td.getMonth())
      if (diffMonths >= 0 && diffMonths <= 6) {
        const idx = 6 - diffMonths
        if (t.tipo === 'ingreso') buckets[idx].ingreso += t.monto
        else if (t.tipo === 'egreso') buckets[idx].egreso += t.monto + t.monto_4x1000
      }
    })
    return buckets
  }, [transacciones])

  const [selected, setSelected] = useState(6) // mes actual por defecto
  const n = data.length
  const groupW = W / n
  const barW = 11
  const barGap = 3

  const maxVal = Math.max(...data.flatMap((d) => [d.ingreso, d.egreso]), 1)

  function barHeight(v: number) {
    return (v / maxVal) * MAX_BAR
  }

  function selectAt(clientX: number) {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    setSelected(Math.min(n - 1, Math.floor(rel * n)))
  }

  const sel = data[selected]
  const hasData = data.some((d) => d.ingreso > 0 || d.egreso > 0)

  return (
    <div>
      {/* Números del mes elegido — en su propio espacio fijo arriba,
          nunca sobre las barras. */}
      <div className="mb-3 flex items-center gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-3)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--lime)' }} /> Ingresos · {sel.label}
          </div>
          <div className="mt-0.5 font-mono text-[17px] font-bold" style={{ color: 'var(--lime)' }}>{fmt(sel.ingreso)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-3)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral)' }} /> Egresos · {sel.label}
          </div>
          <div className="mt-0.5 font-mono text-[17px] font-bold" style={{ color: 'var(--coral)' }}>{fmt(sel.egreso)}</div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative"
        style={{ height: H, touchAction: 'none' }}
        onPointerDown={(e) => selectAt(e.clientX)}
        onPointerMove={(e) => e.buttons === 1 && selectAt(e.clientX)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
          {/* línea central (cero) */}
          <line x1="0" y1={ZERO_Y} x2={W} y2={ZERO_Y} stroke="#2C2C2F" strokeWidth="1" />

          {data.map((d, i) => {
            const cx = i * groupW + groupW / 2
            const ingX = cx - barW - barGap / 2
            const egrX = cx + barGap / 2
            const ingH = Math.max(barHeight(d.ingreso), d.ingreso > 0 ? 3 : 0)
            const egrH = Math.max(barHeight(d.egreso), d.egreso > 0 ? 3 : 0)
            const dim = i !== selected
            return (
              <g key={i} opacity={dim ? 0.38 : 1}>
                <rect x={ingX} y={ZERO_Y - ingH} width={barW} height={ingH} rx={3} fill="#C6FF4D" />
                <rect x={egrX} y={ZERO_Y} width={barW} height={egrH} rx={3} fill="#FF7A6E" />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: 'var(--text-3)' }}>
        {data.map((d, i) => (
          <button key={i} onClick={() => setSelected(i)} style={i === selected ? { color: 'var(--text-1)', fontWeight: 600 } : undefined}>
            {d.label}
          </button>
        ))}
      </div>

      {!hasData && (
        <div className="mt-2 text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>
          Todavía no hay suficiente historial — las barras se van a llenar a medida que registres movimientos.
        </div>
      )}
    </div>
  )
}

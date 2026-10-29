import { forwardRef } from 'react'
import Logo from './Logo'
import type { ComponenteSalud, NivelSalud } from '../lib/saludFinanciera'

// Imagen para compartir el puntaje de salud financiera (Instagram/WhatsApp).
// A propósito NO lleva ni un solo peso: solo el puntaje, el nivel y cómo va
// cada pieza en porcentaje — se puede publicar sin mostrar cuánta plata
// tienes. Tamaño fijo 1080x1350 (igual que ReporteCard).
const W = 1080
const H = 1350
const COLOR: Record<NivelSalud, string> = { bajo: '#FF7A6E', medio: '#FFD166', bien: '#C6FF4D', excelente: '#C6FF4D' }

export interface DatosSaludShare {
  puntaje: number
  nivel: NivelSalud
  nivelTexto: string
  titulo: string
  componentes: { nombre: string; c: ComponenteSalud }[]
  pie: string
}

// eslint-disable-next-line react/display-name
const SaludShareCard = forwardRef<HTMLDivElement, { data: DatosSaludShare }>(({ data }, ref) => {
  const color = COLOR[data.nivel]
  const R = 190, C = 2 * Math.PI * R
  return (
    <div ref={ref} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: '#131313', fontFamily: "'Inter', -apple-system, sans-serif", padding: '72px 72px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(198,255,77,0.12), transparent 60%)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, alignSelf: 'flex-start' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden' }}><Logo size={56} rounded={16} /></div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#F5F5F3' }}>CashFlow</div>
      </div>

      <div style={{ position: 'relative', fontSize: 34, color: '#9A9A9E', marginTop: 70 }}>{data.titulo}</div>

      <div style={{ position: 'relative', width: 440, height: 440, marginTop: 30 }}>
        <svg viewBox="0 0 440 440" width="440" height="440" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="220" cy="220" r={R} fill="none" strokeWidth="34" stroke="#26262A" />
          <circle cx="220" cy="220" r={R} fill="none" strokeWidth="34" strokeLinecap="round" stroke={color} strokeDasharray={C} strokeDashoffset={C * (1 - data.puntaje / 100)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 150, fontWeight: 800, color: '#F5F5F3', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{data.puntaje}</div>
          <div style={{ fontSize: 30, color: '#9A9A9E', marginTop: 8 }}>/ 100</div>
        </div>
      </div>

      <div style={{ position: 'relative', fontSize: 56, fontWeight: 800, color, marginTop: 26 }}>{data.nivelTexto}</div>

      <div style={{ position: 'relative', width: '100%', marginTop: 50, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {data.componentes.map(({ nombre, c }) => {
          const pct = c.maximo > 0 ? c.puntos / c.maximo : 0
          const col = pct >= 0.7 ? '#C6FF4D' : pct >= 0.4 ? '#FFD166' : '#FF7A6E'
          return (
            <div key={c.clave} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ width: 300, fontSize: 26, color: '#D8D8D6' }}>{nombre}</div>
              <div style={{ flex: 1, height: 18, borderRadius: 9, background: '#26262A', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 9, background: col }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', fontSize: 26, color: '#9A9A9E' }}>{data.pie}</div>
    </div>
  )
})

export default SaludShareCard

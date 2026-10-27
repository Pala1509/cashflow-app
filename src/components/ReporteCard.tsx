import { forwardRef } from 'react'
import Logo from './Logo'
import type { Transaccion, Categoria } from '../lib/database.types'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export interface ReporteMes {
  mes: number
  anio: number
  ingresos: number
  egresos: number
  topCategorias: { nombre: string; monto: number; color: string }[]
  patrimonioNeto: number
  nombreUsuario: string
}

// Se renderiza SIEMPRE a un tamaño fijo (1080x1350, proporción típica de
// story/post) para que la imagen capturada se vea igual de bien en
// cualquier pantalla desde donde se comparta — no depende del tamaño de
// la ventana del que lo genera.
const W = 1080
const H = 1350

// eslint-disable-next-line react/display-name
const ReporteCard = forwardRef<HTMLDivElement, { data: ReporteMes }>(({ data }, ref) => {
  const balance = data.ingresos - data.egresos
  const positivo = balance >= 0

  return (
    <div
      ref={ref}
      style={{
        width: W, height: H, position: 'relative', overflow: 'hidden',
        background: '#131313', fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '72px 64px', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Fondo con degradado sutil de marca, no plano */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 15% 0%, rgba(198,255,77,0.14), transparent 55%)' }} />
      <div style={{ position: 'absolute', right: -80, bottom: -80, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(185,166,245,0.12), transparent 70%)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden' }}>
          <Logo size={56} rounded={16} />
        </div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#F5F5F3', letterSpacing: -0.5 }}>CashFlow</div>
          <div style={{ fontSize: 20, color: '#9A9A9E', marginTop: 2 }}>{MESES[data.mes]} {data.anio}</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 64 }}>
        <div style={{ fontSize: 20, color: '#9A9A9E' }}>Hola, {data.nombreUsuario} — así te fue este mes</div>
        <div style={{ fontSize: 22, color: '#5C5C60', marginTop: 20 }}>Balance del mes</div>
        <div style={{ fontSize: 92, fontWeight: 800, color: positivo ? '#C6FF4D' : '#FF7A6E', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.05, marginTop: 4 }}>
          {positivo ? '+' : '–'}{fmt(Math.abs(balance))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 48, display: 'flex', gap: 20 }}>
        <div style={{ flex: 1, background: '#1D1D1F', borderRadius: 28, padding: '28px 30px' }}>
          <div style={{ fontSize: 18, color: '#9A9A9E' }}>Ingresos</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#C6FF4D', fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>{fmt(data.ingresos)}</div>
        </div>
        <div style={{ flex: 1, background: '#1D1D1F', borderRadius: 28, padding: '28px 30px' }}>
          <div style={{ fontSize: 18, color: '#9A9A9E' }}>Egresos</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#FF7A6E', fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>{fmt(data.egresos)}</div>
        </div>
      </div>

      {data.topCategorias.length > 0 && (
        <div style={{ position: 'relative', marginTop: 40, background: '#1D1D1F', borderRadius: 28, padding: '30px 34px', flex: 1 }}>
          <div style={{ fontSize: 20, color: '#9A9A9E', marginBottom: 20 }}>En qué se fue la plata</div>
          {data.topCategorias.map((c, i) => (
            <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: i === data.topCategorias.length - 1 ? 0 : 22 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <div style={{ fontSize: 22, color: '#F5F5F3', flex: 1 }}>{c.nombre}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F3', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(c.monto)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', marginTop: 40, textAlign: 'center', fontSize: 17, color: '#5C5C60' }}>
        Patrimonio neto: {fmt(data.patrimonioNeto)} · Vanta Lab Studio
      </div>
    </div>
  )
})

export default ReporteCard

// Agrupa las transacciones del mes seleccionado y arma los datos que
// necesita la tarjeta — separado del componente para poder probarlo o
// reusarlo sin tener que renderizar nada.
export function calcularReporteMes(
  transacciones: Transaccion[],
  categorias: Categoria[],
  patrimonioNeto: number,
  nombreUsuario: string,
  fecha = new Date()
): ReporteMes {
  const mes = fecha.getMonth()
  const anio = fecha.getFullYear()
  const delMes = transacciones.filter((t) => {
    const [y, m] = t.fecha.split('-').map(Number)
    return m - 1 === mes && y === anio
  })

  const ingresos = delMes.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egresos = delMes.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  const porCategoria = new Map<string, number>()
  for (const t of delMes) {
    if (t.tipo !== 'egreso' || !t.categoria_id) continue
    porCategoria.set(t.categoria_id, (porCategoria.get(t.categoria_id) ?? 0) + t.monto + t.monto_4x1000)
  }
  const COLORES_HEX: Record<string, string> = {
    lime: '#C6FF4D', coral: '#FF7A6E', yellow: '#FFD666', lavender: '#B9A6F5', pink: '#FF8FC7', blue: '#7AB3F5', teal: '#5FE0C8',
  }
  const topCategorias = Array.from(porCategoria.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([catId, monto]) => {
      const cat = categorias.find((c) => c.id === catId)
      return { nombre: cat?.nombre ?? 'Sin categoría', monto, color: COLORES_HEX[cat?.color ?? 'lavender'] ?? '#B9A6F5' }
    })

  return { mes, anio, ingresos, egresos, topCategorias, patrimonioNeto, nombreUsuario }
}

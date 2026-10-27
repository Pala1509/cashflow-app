import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, HeartPulse } from 'lucide-react'
import { useSaludFinanciera } from '../hooks/useSaludFinanciera'
import { useIdioma } from '../lib/IdiomaContext'
import type { ClaveComponente, ComponenteSalud, NivelSalud } from '../lib/saludFinanciera'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const COLOR_NIVEL: Record<NivelSalud, string> = { bajo: 'var(--coral)', medio: 'var(--yellow)', bien: 'var(--lime)', excelente: 'var(--lime)' }
const ORDEN: ClaveComponente[] = ['colchon', 'ahorro', 'deuda', 'flujo', 'hormiga']

// Tarjeta de Resumen: el puntaje de 0 a 100 en un anillo, el nivel, el
// consejo que más puntos te da, y (al tocar) el detalle de cada pieza.
export default function SaludFinancieraCard() {
  const navigate = useNavigate()
  const { t } = useIdioma()
  const { salud, loading } = useSaludFinanciera()
  const [abierto, setAbierto] = useState(false)
  if (loading) return null

  if (salud.puntaje === null || salud.nivel === null) {
    return (
      <button onClick={() => navigate('/balance')} className="mb-5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}><HeartPulse size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">{t('salud_titulo')}</div>
          <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('salud_sin_ingresos')}</div>
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
      </button>
    )
  }

  const color = COLOR_NIVEL[salud.nivel]
  const R = 30, C = 2 * Math.PI * R
  const detalle = (c: ComponenteSalud): string => {
    const v = c.valor
    switch (c.clave) {
      case 'colchon': return t('salud_det_colchon', { meses: (v ?? 0).toFixed(1) })
      case 'ahorro': return (v ?? 0) < 0 ? t('salud_det_ahorro_neg') : t('salud_det_ahorro', { pct: Math.round((v ?? 0) * 100) })
      case 'deuda': return (v ?? 0) <= 0 ? t('salud_det_deuda_sin') : t('salud_det_deuda', { pct: Math.round((v ?? 0) * 100) })
      case 'flujo': return v === null ? t('salud_det_flujo_ok') : t('salud_det_flujo_hueco', { monto: fmt(v) })
      case 'hormiga': return t('salud_det_hormiga', { pct: Math.round((v ?? 0) * 100) })
    }
  }
  const componentes = ORDEN.map((k) => salud.componentes.find((c) => c.clave === k)).filter(Boolean) as ComponenteSalud[]

  return (
    <div className="mb-5 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-3.5 text-left">
        <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
          <svg viewBox="0 0 72 72" width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" style={{ stroke: 'var(--card-2)' }} />
            <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - salud.puntaje / 100)} style={{ stroke: color }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="font-mono text-[22px] font-bold">{salud.puntaje}</span>
            <span className="mt-0.5 text-[8.5px]" style={{ color: 'var(--text-3)' }}>{t('salud_de_100')}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('salud_titulo')}</div>
          <div className="text-[15px] font-bold font-display" style={{ color }}>{t(`salud_nivel_${salud.nivel}` as 'salud_nivel_bajo')}</div>
          <div className="mt-1 text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
            {salud.palanca ? t(`salud_tip_${salud.palanca}` as 'salud_tip_colchon') : t('salud_tip_ok')}
          </div>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-3)', transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>

      {abierto && (
        <div className="mt-3.5 flex flex-col gap-3 pt-3.5" style={{ borderTop: '1px solid var(--line)' }}>
          {componentes.map((c) => (
            <div key={c.clave}>
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-semibold">{t(`salud_comp_${c.clave}` as 'salud_comp_colchon')}</div>
                <div className="font-mono text-[11px]" style={{ color: 'var(--text-2)' }}>{c.puntos}/{c.maximo}</div>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(c.puntos / c.maximo) * 100}%`, background: c.puntos / c.maximo >= 0.7 ? 'var(--lime)' : c.puntos / c.maximo >= 0.4 ? 'var(--yellow)' : 'var(--coral)' }} />
              </div>
              <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{detalle(c)}</div>
            </div>
          ))}
          <div className="text-[9.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('salud_nota')}</div>
        </div>
      )}
    </div>
  )
}

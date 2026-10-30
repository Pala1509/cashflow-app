import { ICONS } from '../pages/Cuentas'

// Selector de ícono para gastos/ingresos fijos, cuentas y deudas: así cada
// cosa se distingue de un vistazo y no salen todas con el mismo dibujo.
// Usa el mismo mapa ICONS que pinta las listas, de modo que lo que se
// escoge acá es exactamente lo que se ve después.
// 'otros' es el mismo dibujo que 'dots'; 'banknote' repite 'cash'.
const OCULTOS = new Set(['otros', 'banknote', 'building2'])
export const ICONOS_ELEGIBLES = Object.keys(ICONS).filter((k) => !OCULTOS.has(k))

export default function IconoPicker({ valor, onChange, color = 'var(--lime)' }: { valor: string | null; onChange: (icono: string) => void; color?: string }) {
  return (
    <div className="grid grid-cols-6 gap-2 overflow-y-auto rounded-2xl p-2" style={{ maxHeight: 236, background: 'var(--card)' }} role="radiogroup" aria-label="Ícono">
      {ICONOS_ELEGIBLES.map((k) => {
        const Icon = ICONS[k]
        const sel = valor === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={k}
            onClick={() => onChange(k)}
            className="flex aspect-square items-center justify-center rounded-xl"
            style={{ background: sel ? color : 'var(--card-2)', color: sel ? 'var(--bg)' : 'var(--text-2)', boxShadow: sel ? `0 0 0 2px ${color}` : 'none' }}
          >
            <Icon size={18} />
          </button>
        )
      })}
    </div>
  )
}

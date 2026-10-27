import { useState } from 'react'
import { Check } from 'lucide-react'
import CenterModal from './CenterModal'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Reemplaza el <input type="date"> / <select> nativo (que abre el picker
// genérico del sistema) por tres botones que abren una lista con el
// diseño propio de la app, centrada en pantalla.
export default function DateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m, d] = value ? value.split('-').map(Number) : [undefined, undefined, undefined]
  const [picking, setPicking] = useState<'dia' | 'mes' | 'anio' | null>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i)
  const daysInMonth = m ? new Date(y || currentYear, m, 0).getDate() : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function update(newD?: number, newM?: number, newY?: number) {
    const dd = newD ?? d
    const mm = newM ?? m
    const yy = newY ?? y
    if (dd && mm && yy) onChange(`${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`)
    setPicking(null)
  }

  return (
    <>
      <div className="mb-2.5 grid grid-cols-[1fr_1.6fr_1fr] gap-2">
        <Btn label="Día" value={d} onClick={() => setPicking('dia')} />
        <Btn label="Mes" value={m ? MESES[m - 1] : undefined} onClick={() => setPicking('mes')} />
        <Btn label="Año" value={y} onClick={() => setPicking('anio')} />
      </div>

      {picking === 'dia' && (
        <CenterModal onClose={() => setPicking(null)}>
          <Title>Día</Title>
          <List>
            {days.map((day) => (
              <Item key={day} selected={day === d} onClick={() => update(day, undefined, undefined)}>{day}</Item>
            ))}
          </List>
        </CenterModal>
      )}

      {picking === 'mes' && (
        <CenterModal onClose={() => setPicking(null)}>
          <Title>Mes</Title>
          <List>
            {MESES.map((mes, i) => (
              <Item key={mes} selected={i + 1 === m} onClick={() => update(undefined, i + 1, undefined)}>{mes}</Item>
            ))}
          </List>
        </CenterModal>
      )}

      {picking === 'anio' && (
        <CenterModal onClose={() => setPicking(null)}>
          <Title>Año</Title>
          <List>
            {years.map((yr) => (
              <Item key={yr} selected={yr === y} onClick={() => update(undefined, undefined, yr)}>{yr}</Item>
            ))}
          </List>
        </CenterModal>
      )}
    </>
  )
}

function Btn({ label, value, onClick }: { label: string; value?: string | number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-3 py-3 text-left"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="mt-0.5 text-[13px]" style={{ color: value ? 'var(--text-1)' : 'var(--text-3)' }}>{value ?? '—'}</div>
    </button>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-center text-[14px] font-semibold font-display">{children}</div>
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 space-y-1 overflow-y-auto">{children}</div>
}

function Item({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px]"
      style={{ background: selected ? 'var(--lime-dim)' : 'transparent', color: selected ? 'var(--lime)' : 'var(--text-1)' }}
    >
      {children}
      {selected && <Check size={14} />}
    </button>
  )
}

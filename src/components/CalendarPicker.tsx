import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Calendario real de mes — reemplaza el picker genérico de listas cuando lo
// que se elige es una fecha de un movimiento (más natural para "¿qué día fue esto?").
export default function CalendarPicker({
  value,
  onChange,
  maxDate,
}: {
  value: string
  onChange: (v: string) => void
  maxDate?: string
}) {
  const [y0, m0] = value.split('-').map(Number)
  const [viewYear, setViewYear] = useState(y0 || new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState((m0 || 1) - 1)

  const today = new Date()
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: 'var(--text-2)' }}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-[13.5px] font-semibold font-display">{MESES[viewMonth]} {viewYear}</div>
        <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: 'var(--text-2)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px]" style={{ color: 'var(--text-3)' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = toStr(viewYear, viewMonth, day)
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr
          const isFuture = maxDate ? dateStr > maxDate : false
          return (
            <button
              key={i}
              onClick={() => !isFuture && onChange(dateStr)}
              disabled={isFuture}
              className="flex aspect-square items-center justify-center rounded-full text-[12px] disabled:opacity-25"
              style={{
                background: isSelected ? 'var(--lime)' : 'transparent',
                color: isSelected ? 'var(--lime-text)' : isToday ? 'var(--lime)' : 'var(--text-1)',
                fontWeight: isSelected || isToday ? 700 : 400,
                border: isToday && !isSelected ? '1px solid var(--lime)' : 'none',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

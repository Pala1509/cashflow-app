import { useState, type ReactNode } from 'react'
import { Delete } from 'lucide-react'
import { hasPinConfigured, isUnlockedThisSession, checkPin, markUnlocked } from '../lib/pinGate'
import Logo from './Logo'

export default function PinGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(!hasPinConfigured() || isUnlockedThisSession())
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function press(k: string) {
    setError(false)
    if (k === 'back') { setPin((p) => p.slice(0, -1)); return }
    const next = pin.length < 4 ? pin + k : pin
    setPin(next)
    if (next.length === 4) {
      if (checkPin(next)) {
        markUnlocked()
        setUnlocked(true)
      } else {
        setError(true)
        setTimeout(() => setPin(''), 400)
      }
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8" style={{ background: 'var(--bg)' }}>
      <div className="mb-5">
        <Logo size={64} rounded={18} />
      </div>
      <div className="text-base font-bold font-display">Ingresa tu PIN</div>
      <div className="mt-4 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-3.5 w-3.5 rounded-full"
            style={{ background: i < pin.length ? (error ? 'var(--coral)' : 'var(--lime)') : 'var(--card-2)' }}
          />
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-[260px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button key={n} onClick={() => press(n)} className="flex h-14 items-center justify-center rounded-2xl text-lg font-medium font-mono" style={{ background: 'var(--card)' }}>
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => press('0')} className="flex h-14 items-center justify-center rounded-2xl text-lg font-medium font-mono" style={{ background: 'var(--card)' }}>0</button>
        <button onClick={() => press('back')} className="flex h-14 items-center justify-center rounded-2xl" style={{ background: 'var(--card)' }}>
          <Delete size={18} />
        </button>
      </div>
    </div>
  )
}

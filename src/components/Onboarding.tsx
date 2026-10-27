import { useState } from 'react'
import { Wallet, SlidersHorizontal, Bug, ChevronRight } from 'lucide-react'
import Logo from './Logo'
import { supabase } from '../lib/supabase'

const SLIDES = [
  {
    icon: null,
    title: 'Bienvenido a CashFlow',
    text: 'Una aplicación de finanzas personales diseñada para que entiendas tu situación financiera de un vistazo, sin depender de hojas de cálculo.',
    accent: 'lime' as const,
  },
  {
    icon: Wallet,
    title: 'Cuentas y Deudas, por separado',
    text: 'Cuentas muestra únicamente lo que tienes. Deudas muestra lo que debes o te deben, incluidas las tarjetas de crédito. Al mantenerlos separados, tu patrimonio neto siempre refleja la realidad.',
    accent: 'lavender' as const,
  },
  {
    icon: Bug,
    title: 'Registra en el momento',
    text: 'Registrar un movimiento toma solo unos segundos. Si un mismo producto se repite con frecuencia, la aplicación te lo notifica de inmediato, sin esperar a fin de mes.',
    accent: 'coral' as const,
  },
  {
    icon: SlidersHorizontal,
    title: 'Balance y Resumen, siempre a mano',
    text: 'Consulta una proyección de cómo terminará el mes, compara tus gastos con el mes anterior, y establece límites de gasto por categoría.',
    accent: 'yellow' as const,
  },
]

const ACCENTS: Record<string, { fg: string; dim: string }> = {
  lime: { fg: 'var(--lime)', dim: 'var(--lime-dim)' },
  lavender: { fg: 'var(--lavender)', dim: 'var(--lavender-dim)' },
  coral: { fg: 'var(--coral)', dim: 'var(--coral-dim)' },
  yellow: { fg: 'var(--yellow)', dim: 'var(--yellow-dim)' },
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const accent = ACCENTS[slide.accent]
  const esUltima = i === SLIDES.length - 1
  const Icon = slide.icon

  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-6" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 justify-end">
        {!esUltima && (
          <button onClick={onDone} className="text-[12px]" style={{ color: 'var(--text-3)' }}>
            Saltar
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {Icon ? (
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: accent.dim, color: accent.fg }}>
            <Icon size={34} />
          </div>
        ) : (
          <div className="mb-6" style={{ filter: 'drop-shadow(0 0 40px rgba(198,255,77,0.35))' }}>
            <Logo size={84} rounded={22} />
          </div>
        )}
        <h1 className="mb-3 max-w-xs text-2xl font-bold font-display leading-tight">{slide.title}</h1>
        <p className="max-w-xs text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {slide.text}
        </p>
      </div>

      <div className="mb-6 flex flex-shrink-0 justify-center gap-2">
        {SLIDES.map((_, idx) => (
          <div
            key={idx}
            className="h-1.5 rounded-full transition-all"
            style={{ width: idx === i ? 22 : 7, background: idx === i ? accent.fg : 'var(--card-2)' }}
          />
        ))}
      </div>

      <button
        onClick={() => (esUltima ? onDone() : setI(i + 1))}
        className="flex flex-shrink-0 items-center justify-center gap-1.5 rounded-2xl py-4 text-sm font-bold"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
      >
        {esUltima ? 'Empezar' : 'Siguiente'}
        {!esUltima && <ChevronRight size={16} />}
      </button>
    </div>
  )
}

// Se guarda en profiles (servidor), no en localStorage — así queda
// ligado a la CUENTA, no al navegador/dispositivo. Si guardáramos esto
// solo en el teléfono, cambiar de navegador, reinstalar la app, o
// limpiar datos haría que el onboarding volviera a salir.
export async function onboardingVisto(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('cashflow_onboarding_visto').eq('id', userId).single()
  return data?.cashflow_onboarding_visto ?? false
}
export async function marcarOnboardingVisto(userId: string) {
  await supabase.from('profiles').update({ cashflow_onboarding_visto: true }).eq('id', userId)
}

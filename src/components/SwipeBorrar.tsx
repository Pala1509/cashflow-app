import { useRef, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

// Fila que se puede deslizar para borrar (como en Mail/WhatsApp):
//   - Deslizar de derecha a izquierda destapa el botón rojo de borrar.
//   - Soltar a medio camino la deja abierta; tocar el botón rojo borra.
//   - Un deslizón largo (más de ~60% del ancho) borra de una.
//   - Un toque normal (sin arrastrar) hace onTap, p. ej. abrir el detalle.
// Usa pointer events + `touch-action: pan-y`, así el scroll vertical de la
// lista sigue funcionando normal y solo el gesto horizontal se captura.

const ANCHO_BOTON = 84

export default function SwipeBorrar({
  children,
  onBorrar,
  onTap,
  etiqueta,
}: {
  children: ReactNode
  onBorrar: () => Promise<void> | void
  onTap?: () => void
  etiqueta: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; y: number; base: number } | null>(null)
  const arrastrando = useRef(false)
  const [dx, setDx] = useState(0)
  const [abierto, setAbierto] = useState<0 | -1>(0)
  const [enGesto, setEnGesto] = useState(false)
  const [borrando, setBorrando] = useState(false)

  function cerrar() {
    setAbierto(0)
    setDx(0)
  }

  async function borrar() {
    if (borrando) return
    setBorrando(true)
    const ancho = ref.current?.offsetWidth ?? 320
    setDx(-ancho)
    try {
      await onBorrar()
    } finally {
      // Si falló, la fila vuelve a su sitio; si funcionó, la lista la quita.
      setBorrando(false)
      cerrar()
    }
  }

  return (
    <div ref={ref} className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Fondo rojo con el botón, a ambos lados */}
      <div className="absolute inset-0 flex items-stretch justify-end" style={{ background: 'var(--coral)' }} aria-hidden={abierto === 0}>
        <button
          type="button"
          onClick={borrar}
          className="flex items-center justify-center gap-1.5 text-[12px] font-semibold"
          style={{ width: ANCHO_BOTON, color: '#000000', visibility: dx < 0 ? 'visible' : 'hidden' }}
        >
          <Trash2 size={15} /> {etiqueta}
        </button>
      </div>

      {/* La fila en sí */}
      <div
        className="relative"
        style={{
          background: 'var(--bg)',
          transform: `translateX(${dx}px)`,
          transition: enGesto ? 'none' : 'transform 220ms ease',
          opacity: borrando ? 0.5 : 1,
        }}
        onPointerDown={(e) => {
          inicio.current = { x: e.clientX, y: e.clientY, base: abierto * ANCHO_BOTON }
          arrastrando.current = false
        }}
        onPointerMove={(e) => {
          const ini = inicio.current
          if (!ini) return
          const mx = e.clientX - ini.x
          const my = e.clientY - ini.y
          if (!arrastrando.current) {
            if (Math.abs(mx) < 8) return
            // Si el gesto es más vertical que horizontal, es scroll: soltarlo.
            if (Math.abs(my) > Math.abs(mx)) { inicio.current = null; return }
            arrastrando.current = true
            setEnGesto(true)
            ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
          }
          const ancho = ref.current?.offsetWidth ?? 320
          setDx(Math.max(-ancho, Math.min(0, ini.base + mx)))
        }}
        onPointerUp={() => {
          const ini = inicio.current
          inicio.current = null
          setEnGesto(false)
          if (!ini) return
          if (!arrastrando.current) {
            if (abierto !== 0) cerrar()
            else onTap?.()
            return
          }
          arrastrando.current = false
          const ancho = ref.current?.offsetWidth ?? 320
          if (Math.abs(dx) > ancho * 0.6) { void borrar(); return }
          if (dx < -ANCHO_BOTON / 2) { setAbierto(-1); setDx(-ANCHO_BOTON); return }
          cerrar()
        }}
        onPointerCancel={() => {
          inicio.current = null
          arrastrando.current = false
          setEnGesto(false)
          if (abierto === 0) setDx(0)
          else setDx(abierto * ANCHO_BOTON)
        }}
      >
        {children}
      </div>
    </div>
  )
}

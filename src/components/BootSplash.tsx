import { useEffect, useState } from 'react'
import fondoLogo from '../assets/splash/cashflow_logo_background.webp'

// Frases que van rotando debajo de la barra mientras "carga" — es
// simbólico (ver duracionMs más abajo), no está esperando a nada real
// en particular, solo dando la sensación de que algo interesante está
// pasando antes de mostrar la app. Un poco de humor/personalidad para
// que no se sienta como una barra de progreso genérica de sistema.
const FRASES = [
  'Cargando tus cuentas…',
  'Analizando tus finanzas…',
  'Sincronizando tus movimientos…',
  'Calculando tu patrimonio…',
  'Revisando tasas de cambio…',
  'Preparando todo para ti…',
]

// Duración simbólica del splash — no depende de cuánto tarde de verdad
// la sesión en cargar (eso pasa en paralelo, ver App.tsx). Es puro
// diseño: se siente más pulido que un parpadeo instantáneo, y le da
// tiempo a la marca de registrarse antes de que aparezca el contenido.
const DURACION_MS = 2000

export default function BootSplash({ onDone }: { onDone?: () => void }) {
  const [progreso, setProgreso] = useState(0)
  const [fraseIdx, setFraseIdx] = useState(0)

  useEffect(() => {
    const inicio = Date.now()
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - inicio) / DURACION_MS) * 100)
      setProgreso(pct)
      if (pct >= 100) {
        clearInterval(tick)
        onDone?.()
      }
    }, 30)
    // Una frase nueva por cada ~1/N del recorrido — se reparten parejo
    // en toda la duración, terminando en la última justo antes del 100%.
    const porFrase = DURACION_MS / FRASES.length
    const rot = setInterval(() => {
      setFraseIdx((i) => Math.min(FRASES.length - 1, i + 1))
    }, porFrase)
    return () => { clearInterval(tick); clearInterval(rot) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundImage: `url(${fondoLogo})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0A0A0C' }}
    >
      <div className="mt-auto flex flex-col items-center px-10" style={{ marginBottom: '18%' }}>
        <div className="h-1 w-44 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: '#C6FF4D', transition: 'width .05s linear' }} />
        </div>
        <div className="mt-3 text-center text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {FRASES[fraseIdx]}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STEPS } from '../lib/tourSteps'
import { _registerTourActionListener } from '../lib/tourActionBus'

// Puede haber más de un elemento en el DOM con el mismo data-tour (uno en
// el rail de escritorio, otro en la barra de celular — solo uno de los
// dos está realmente visible según el tamaño de pantalla). Se recorren
// todos y se usa el primero que de verdad se ve.
function medirObjetivo(target: string): DOMRect | null {
  const candidatos = document.querySelectorAll(`[data-tour="${target}"]`)
  for (const el of candidatos) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return rect
  }
  return null
}

export default function TourOverlay({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const step = TOUR_STEPS[i]

  // Si el paso vive en otra ruta, navega solo — nunca hace falta salir
  // manualmente de una pantalla a mitad del tour. Excepción: un paso de
  // "acción" ya vive en la ruta actual a propósito — es el usuario quien
  // debe navegar solo, tocando el elemento real. Forzar la navegación
  // aquí sería saltarse el punto de que lo haga él mismo.
  useEffect(() => {
    if (!step.accion && location.pathname !== step.ruta) navigate(step.ruta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Pasos de acción: cuando el usuario navega solo (tocando el elemento
  // real) o el evento llega por el bus, esto SIEMPRE debe avanzar el
  // paso — separado a propósito de lo que hace el botón "Siguiente"
  // (ver más abajo), que en un paso de acción no avanza directo, sino
  // que primero DISPARA la acción real (navega, o toca el elemento) y
  // deja que estos mismos efectos de acá abajo hagan el avance una vez
  // la acción de verdad ocurrió.
  useEffect(() => {
    if (!step.accion) return
    if (step.accion.tipo === 'ruta') {
      if (location.pathname === step.accion.espera) avanzar()
      return
    }
  }, [location.pathname, i])

  useEffect(() => {
    if (!step.accion || step.accion.tipo !== 'evento') return
    _registerTourActionListener((accion) => {
      if (accion === step.accion?.espera) avanzar()
    })
    return () => _registerTourActionListener(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Mide el elemento objetivo — reintenta un rato por si la navegación
  // o el renderizado de la página todavía no terminaron.
  useEffect(() => {
    setRect(null)
    let intentos = 0
    const id = setInterval(() => {
      const medido = medirObjetivo(step.target)
      if (medido) {
        setRect(medido)
        clearInterval(id)
      }
      intentos++
      if (intentos > 30) clearInterval(id) // ~3s máx, si no aparece se rinde y espera al siguiente intento de render
    }, 100)
    return () => clearInterval(id)
  }, [i, location.pathname, step.target])

  // Si la ventana cambia de tamaño (o rota) mientras el tour está abierto,
  // vuelve a medir para que el spotlight no quede desalineado.
  useEffect(() => {
    function onResize() {
      const medido = medirObjetivo(step.target)
      if (medido) setRect(medido)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step.target])

  // Para pasos de tipo 'evento' (elegir un tipo de cuenta, guardar el
  // formulario) no basta con dejar la zona libre de franjas oscuras —
  // ya se comprobó 2 veces que el clic no siempre "atraviesa" bien el
  // overlay hasta el elemento real de abajo, sin poder confirmar por
  // qué sin logs de un dispositivo real. En vez de seguir cazando eso,
  // se eleva el elemento REAL por encima del overlay (z-index más alto
  // que el del tour) mientras el paso está activo — así se toca
  // literalmente el botón de verdad, sin ninguna capa de por medio, sin
  // depender de que el navegador interprete bien nada.
  useEffect(() => {
    if (!step.accion || step.accion.tipo !== 'evento') return
    const elementos = document.querySelectorAll(`[data-tour="${step.target}"]`)
    const originales: { el: HTMLElement; position: string; zIndex: string }[] = []
    elementos.forEach((el) => {
      const h = el as HTMLElement
      originales.push({ el: h, position: h.style.position, zIndex: h.style.zIndex })
      if (!h.style.position) h.style.position = 'relative'
      h.style.zIndex = '1001'
    })
    return () => {
      originales.forEach(({ el, position, zIndex }) => {
        el.style.position = position
        el.style.zIndex = zIndex
      })
    }
  }, [i, step.target, step.accion])

  // Avanza el paso — SIEMPRE incrementa (o cierra si es el último), sin
  // ninguna otra lógica. La usan los detectores automáticos de arriba
  // (cuando la acción real ya ocurrió de verdad) y también el botón
  // "Siguiente" en los pasos que no tienen acción.
  function avanzar() {
    if (i === TOUR_STEPS.length - 1) { onDone(); return }
    setI(i + 1)
  }

  // Lo que hace el botón "Siguiente" que ve el usuario — en un paso sin
  // acción, es lo mismo que avanzar(). En un paso de tipo 'ruta' (solo
  // navegar a algún lado, nada destructivo), navega de verdad por el
  // usuario. En un paso de tipo 'evento' que NO crea datos (ej. elegir
  // un tipo de cuenta — solo estado local), toca el elemento real por
  // código, disparando su onClick de verdad. En un paso de tipo
  // 'evento' que SÍ crea datos (`creaDatos: true`, ej. Guardar — inserta
  // una fila real en la base de datos), NO dispara la acción — "Siguiente"
  // no debería terminar creando algo real solo por querer avanzar el
  // cuento. Para esos, simplemente avanza el número; si el usuario de
  // verdad quiere guardar, lo hace él mismo tocando el botón real (que
  // sigue elevado por encima del overlay mientras el paso está activo).
  function tocarSiguiente() {
    if (step.accion?.tipo === 'ruta') {
      navigate(step.accion.espera)
      return
    }
    if (step.accion?.tipo === 'evento' && !step.accion.creaDatos) {
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
      el?.click()
      return
    }
    avanzar()
  }

  if (!rect) return null // esperando a que el elemento exista y sea medible

  const pad = 8
  const top = rect.top - pad
  const left = rect.left - pad
  const w = rect.width + pad * 2
  const h = rect.height + pad * 2

  // El cuadro de texto va "arriba" o "abajo" del objetivo según lo pida
  // el paso, PERO solo si de verdad hay espacio de ese lado — sin esto,
  // un objetivo cerca del borde superior (ej. el riel lateral en
  // tablet/escritorio, vs. la barra inferior en celular) empuja el
  // cuadro fuera de la pantalla por arriba. Se voltea automático al lado
  // que sí tenga espacio.
  const minEspacio = 150
  const espacioArriba = top
  const espacioAbajo = window.innerHeight - (top + h)
  let cardArriba = step.posicion === 'arriba'
  if (cardArriba && espacioArriba < minEspacio && espacioAbajo >= minEspacio) cardArriba = false
  if (!cardArriba && espacioAbajo < minEspacio && espacioArriba >= minEspacio) cardArriba = true

  // Fondo oscuro alrededor del objetivo como 4 franjas separadas
  // (arriba/abajo/izquierda/derecha) en vez de un solo div con un hueco
  // recortado por clip-path — con clip-path, que el clic atraviese la
  // parte "recortada" depende de que el navegador lo interprete bien
  // para hit-testing, y no siempre pasaba (el botón real quedaba sin
  // poder tocarse). Con 4 franjas, el área del objetivo queda
  // literalmente sin ningún elemento encima — no hay ambigüedad posible,
  // el clic SIEMPRE llega al botón real de abajo.
  const oscuro = 'rgba(0,0,0,0.72)'

  return (
    <div className="fixed inset-0" style={{ zIndex: 999 }}>
      <div className="absolute" style={{ top: 0, left: 0, right: 0, height: Math.max(0, top), background: oscuro }} />
      <div className="absolute" style={{ top: top + h, left: 0, right: 0, bottom: 0, background: oscuro }} />
      <div className="absolute" style={{ top, left: 0, width: Math.max(0, left), height: h, background: oscuro }} />
      <div className="absolute" style={{ top, left: left + w, right: 0, height: h, background: oscuro }} />
      <div
        className="absolute rounded-2xl"
        style={{ top, left, width: w, height: h, border: '2px solid var(--lime)', pointerEvents: 'none' }}
      />
      {/* Para pasos de tipo 'ruta' (solo necesitan navegar a algún lado),
      el propio recuadro resaltado dispara la navegación directo — en vez
      de confiar en que el clic "atraviese" las 4 franjas y llegue al
      botón real de abajo, que a veces no pasaba (visualmente se ve y se
      siente idéntico a tocar el botón real, porque está puesto justo
      encima). Para pasos de tipo 'evento' (elegir un tipo de cuenta,
      guardar el formulario) esto no alcanza — esos sí necesitan que el
      clic le llegue de verdad a la pantalla real de abajo, porque
      disparan lógica propia de esa pantalla que el tour no puede fingir
      desde acá. */}
      {step.accion?.tipo === 'ruta' && (
        <button
          onClick={() => navigate(step.accion!.espera)}
          className="absolute rounded-2xl"
          style={{ top, left, width: w, height: h, background: 'transparent', border: 'none' }}
        />
      )}
      <div
        className="absolute mx-4 rounded-2xl p-4"
        style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          left: 16, right: 16, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto',
          ...(cardArriba
            ? { bottom: Math.max(window.innerHeight - top + 12, 16) }
            : { top: Math.min(top + h + 12, window.innerHeight - 160) }),
        }}
      >
        <div className="font-mono text-[9px]" style={{ color: 'var(--text-3)' }}>{i + 1} / {TOUR_STEPS.length}</div>
        <div className="mt-1 text-[13px] font-bold">{step.titulo}</div>
        <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{step.texto}</div>
        <div className="mt-2.5 flex gap-1">
          {TOUR_STEPS.map((_, idx) => (
            <div key={idx} className="h-1 rounded-full transition-all" style={{ width: idx === i ? 14 : 5, background: idx === i ? 'var(--lime)' : 'var(--card-2)' }} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={onDone} className="text-[10px]" style={{ color: 'var(--text-3)' }}>Saltar tour</button>
          <button onClick={tocarSiguiente} className="rounded-xl px-4 py-2 text-[11px] font-bold" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
            {i === TOUR_STEPS.length - 1 ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

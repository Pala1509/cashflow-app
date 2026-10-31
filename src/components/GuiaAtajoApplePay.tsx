import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Search, CreditCard, ChevronDown, Check, X, Bell } from 'lucide-react'

// Paso a paso visual para armar la automatización de Apple Pay en Atajos.
// Cada paso trae un dibujito de cómo se ve esa pantalla en el iPhone (no
// son capturas: así no muestran datos de nadie y se ven bien en claro y
// oscuro). Los nombres son los que salen en iOS en español: Wallet,
// "Cuando se use Cualquier tarjeta", Transacción, Comercio, Cantidad,
// Tarjeta o pase.

// Colores de la app Atajos (siempre oscuros, como en el iPhone).
const IOS = { fondo: '#000000', bloque: '#1c1c1e', fila: '#2c2c2e', texto: '#ffffff', gris: '#8e8e93', azul: '#0a84ff', verde: '#30d158' }

function Telefono({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[28px] p-3" style={{ background: IOS.fondo, border: '6px solid #2a2a2a' }}>
      <div className="flex flex-col gap-2.5" style={{ color: IOS.texto, fontFamily: '-apple-system, system-ui, sans-serif' }}>{children}</div>
    </div>
  )
}

function Chip({ children, vacio, resaltado }: { children: ReactNode; vacio?: boolean; resaltado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium"
      style={{ background: vacio ? IOS.fila : 'rgba(10,132,255,0.18)', color: vacio ? IOS.gris : IOS.azul, outline: resaltado ? `2px solid ${IOS.azul}` : 'none' }}>
      {!vacio && <CreditCard size={11} />}{children}
    </span>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className="flex items-center rounded-full p-0.5" style={{ width: 38, height: 22, background: on ? IOS.verde : IOS.fila, justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span className="rounded-full" style={{ width: 18, height: 18, background: '#fff' }} />
    </span>
  )
}

function Dedo({ texto }: { texto: string }) {
  return <span className="mt-1 self-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: IOS.azul, color: '#fff' }}>{texto}</span>
}

const BloqueTrigger = ({ abierto }: { abierto?: boolean }) => (
  <div className="rounded-2xl p-3 text-[13px]" style={{ background: IOS.bloque }}>
    <div className="flex flex-wrap items-center gap-1">
      <CreditCard size={14} color={IOS.azul} /> Cuando se use <span style={{ color: IOS.azul }}>Cualquier tarjeta</span>
      <ChevronDown size={14} color={IOS.azul} style={{ transform: abierto ? 'none' : 'rotate(-90deg)' }} />
    </div>
  </div>
)

interface Paso { titulo: string; texto: ReactNode; dibujo: ReactNode }

const PASOS: Paso[] = [
  {
    titulo: 'Abre Atajos y toca +',
    texto: <>Abre la app <b>Atajos</b>, entra a <b>Automatización</b> y toca el <b>+</b> para crear una nueva.</>,
    dibujo: (
      <Telefono>
        <div className="flex items-center justify-between px-1 text-[17px] font-bold">Automatización <span className="flex items-center justify-center rounded-full text-[20px]" style={{ width: 30, height: 30, background: IOS.fila, color: IOS.azul, outline: `2px solid ${IOS.azul}` }}>+</span></div>
        <div className="rounded-xl px-3 py-2.5 text-[12px]" style={{ background: IOS.bloque, color: IOS.gris }}>Aquí aparecerán tus automatizaciones</div>
        <Dedo texto="Toca +" />
      </Telefono>
    ),
  },
  {
    titulo: 'Busca "Wallet"',
    texto: <>En el buscador escribe <b>Wallet</b> y toca la opción <b>"Al realizar un pago sin contacto con mi tarjeta"</b>.</>,
    dibujo: (
      <Telefono>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]" style={{ background: IOS.fila }}><Search size={14} color={IOS.gris} /> Wallet</div>
        <div className="flex items-center gap-2.5 rounded-xl p-2.5" style={{ background: IOS.bloque, outline: `2px solid ${IOS.azul}` }}>
          <span className="flex items-center justify-center rounded-md" style={{ width: 28, height: 28, background: IOS.azul }}><CreditCard size={15} color="#fff" /></span>
          <span className="flex flex-col"><span className="text-[13px] font-semibold">Wallet</span><span className="text-[11px]" style={{ color: IOS.gris }}>"Al realizar un pago sin contacto con mi tarjeta"</span></span>
        </div>
        <Dedo texto="Toca Wallet" />
      </Telefono>
    ),
  },
  {
    titulo: 'Escoge tus tarjetas',
    texto: <>Deja <b>Cualquier tarjeta</b>, o toca ahí y marca solo las tuyas. CashFlow sabe a qué cuenta va cada una.</>,
    dibujo: (
      <Telefono>
        <BloqueTrigger />
        <div className="flex flex-col rounded-xl text-[13px]" style={{ background: IOS.bloque }}>
          <div className="flex items-center justify-between px-3 py-2.5">Cualquier tarjeta <Check size={15} color={IOS.azul} /></div>
          <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${IOS.fila}`, color: IOS.gris }}>Tus tarjetas de Wallet…</div>
        </div>
      </Telefono>
    ),
  },
  {
    titulo: 'Déjalo automático',
    texto: <>Toca la <b>flechita</b> junto a "Cualquier tarjeta". Deja <b>Automatización</b> prendido, apaga <b>Notificar</b> (CashFlow ya te avisa) y deja <b>Confirmar antes de ejecutar</b> apagado.</>,
    dibujo: (
      <Telefono>
        <div className="flex flex-col rounded-2xl text-[13px]" style={{ background: IOS.bloque }}>
          <div className="p-3"><BloqueTriggerTexto /></div>
          {([['Automatización', true], ['Notificar', false], ['Confirmar antes de ejecutar', false]] as [string, boolean][]).map(([t, on]) => (
            <div key={t} className="flex items-center justify-between px-3 py-2" style={{ borderTop: `1px solid ${IOS.fila}` }}>{t} <Toggle on={on} /></div>
          ))}
        </div>
      </Telefono>
    ),
  },
  {
    titulo: 'Agrega "Registrar pago"',
    texto: <>Abajo, en <b>Buscar</b>, escribe <b>CashFlow</b> y toca <b>Registrar pago</b>.</>,
    dibujo: (
      <Telefono>
        <BloqueTrigger />
        <div className="rounded-2xl p-3 text-[13px] leading-relaxed" style={{ background: IOS.bloque, outline: `2px solid ${IOS.azul}` }}>
          <b>Registrar pago</b> en <Chip vacio>Comercio</Chip> por <Chip vacio>Importe</Chip> con <Chip vacio>Tarjeta</Chip>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]" style={{ background: IOS.fila }}><Search size={14} color={IOS.gris} /> CashFlow</div>
      </Telefono>
    ),
  },
  {
    titulo: 'Conecta los datos del pago',
    texto: (
      <>
        Toca <b>Comercio</b>, escoge el botón azul <b>Transacción</b>, tócalo otra vez y elige <b>Comercio</b>. Igual con los otros dos:
        <span className="mt-2 flex flex-col gap-1">
          <span>• Importe → Transacción → <b>Cantidad</b></span>
          <span>• Tarjeta → Transacción → <b>Tarjeta o pase</b></span>
        </span>
      </>
    ),
    dibujo: (
      <Telefono>
        <BloqueTrigger />
        <span className="-my-1 self-center rounded-md px-2 py-0.5 text-[11px]" style={{ color: IOS.azul, background: 'rgba(10,132,255,0.12)' }}>▢ Transacción</span>
        <div className="rounded-2xl p-3 text-[13px] leading-loose" style={{ background: IOS.bloque }}>
          <b>Registrar pago</b> en <Chip resaltado>Comercio</Chip> por <Chip resaltado>Cantidad</Chip> con <Chip resaltado>Tarjeta o pase</Chip>
        </div>
      </Telefono>
    ),
  },
  {
    titulo: 'Guarda y listo',
    texto: <>Toca la <b>✕</b> de arriba y luego la flecha <b>‹</b> para guardar. Desde tu próximo pago con Apple Pay te llega esto:</>,
    dibujo: (
      <Telefono>
        <div className="flex items-center justify-between px-1"><ChevronLeft size={20} color={IOS.azul} /><span className="text-[13px] font-semibold">Nuevo atajo</span><X size={18} color={IOS.gris} /></div>
        <div className="flex items-start gap-2.5 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="flex flex-shrink-0 items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: '#C6FF4D' }}><Bell size={15} color="#1A2400" /></span>
          <span className="flex flex-col text-[12px]"><b className="text-[13px]">Gasto anotado</b><span style={{ color: '#d1d1d6' }}>D1 · $8.900 · Alimentos · Nu</span></span>
        </div>
      </Telefono>
    ),
  },
]

function BloqueTriggerTexto() {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <CreditCard size={14} color={IOS.azul} /> Cuando se use <span style={{ color: IOS.azul }}>Cualquier tarjeta</span>
      <ChevronDown size={14} color={IOS.azul} style={{ outline: `2px solid ${IOS.azul}`, borderRadius: 4 }} />
    </div>
  )
}

export default function GuiaAtajoApplePay() {
  const [i, setI] = useState(0)
  const paso = PASOS[i]
  const ultimo = i === PASOS.length - 1
  return (
    <div className="flex flex-col gap-4 rounded-[22px] p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div className="flex items-center gap-1">
        {PASOS.map((_, k) => (
          <button key={k} type="button" aria-label={`Paso ${k + 1}`} onClick={() => setI(k)} className="h-1.5 flex-1 rounded-full" style={{ background: k <= i ? 'var(--lime)' : 'var(--line)' }} />
        ))}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-bold" style={{ color: 'var(--lime)' }}>Paso {i + 1} de {PASOS.length}</span>
      </div>
      <div className="-mt-2 text-[19px] font-bold leading-tight font-display" style={{ color: 'var(--text-1)' }}>{paso.titulo}</div>
      {paso.dibujo}
      <div className="text-[14px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{paso.texto}</div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0} aria-label="Paso anterior"
          className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)', opacity: i === 0 ? 0.4 : 1 }}>
          <ChevronLeft size={20} />
        </button>
        {i === 0 || ultimo ? (
          <a href="shortcuts://" className="flex flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold" style={{ height: 52, background: 'var(--lime)', color: 'var(--lime-text)' }}>
            Abrir Atajos <ExternalLink size={16} />
          </a>
        ) : (
          <button type="button" onClick={() => setI((k) => k + 1)} className="flex flex-1 items-center justify-center gap-1 rounded-2xl text-[15px] font-bold" style={{ height: 52, background: 'var(--lime)', color: 'var(--lime-text)' }}>
            Siguiente <ChevronRight size={18} />
          </button>
        )}
        {i === 0 && (
          <button type="button" onClick={() => setI(1)} aria-label="Siguiente paso" className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }}>
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  )
}

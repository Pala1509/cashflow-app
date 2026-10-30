import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ChevronLeft, Check, Target, CreditCard, BarChart3, TrendingUp, CalendarDays, Search, Info,
  Landmark, UserMinus, UserPlus, Plus, Sparkles,
} from 'lucide-react'
import {
  type DatosOnboarding, type TipoIngreso, type TipoCuentaOnb, type CuentaOnb, type FijoOnb,
  soloDigitos, num, fmt, conPuntos, conNomina, bancoPrincipalDe, resumenOnboarding, proximasFechas,
  aplicarOnboarding, marcarOnboardingSaltado, borrarPendiente,
} from '../lib/onboardingDatos'

// Onboarding guiado: en 2 minutos la persona deja la app con sus datos
// reales — objetivo, cómo le entra la plata (nómina → prima y cesantías),
// banco principal, cuentas con saldo, deudas y gastos fijos.
//
// Se usa en dos lugares:
//   - AuthScreen (registro): las preguntas van ANTES de crear la cuenta; al
//     final se pasa al formulario de registro con los datos guardados.
//   - AppShell (OnboardingFlujo): aplica datos pendientes del registro, o
//     muestra las preguntas a una cuenta nueva que no las respondió.
// Es React, así que sirve igual en iPhone y Android.
//
// Ojo: las piezas de UI (Campo, Switch, Fila…) viven FUERA del componente a
// propósito. Si se definen adentro, React las trata como un componente nuevo
// en cada render y los inputs pierden el foco con cada tecla.

const OBJETIVOS: { id: string; titulo: string; desc: string; icon: typeof Target; color: string }[] = [
  { id: 'ahorrar', titulo: 'Ahorrar para algo', desc: 'Un viaje, una moto, independizarme…', icon: Target, color: 'lime' },
  { id: 'deudas', titulo: 'Salir de deudas', desc: 'Tarjetas, créditos, lo que le debo a alguien', icon: CreditCard, color: 'coral' },
  { id: 'gastos', titulo: 'Saber en qué se me va la plata', desc: 'Controlar los gastos del mes', icon: BarChart3, color: 'yellow' },
  { id: 'invertir', titulo: 'Empezar a invertir', desc: 'CDT, fondos, acciones', icon: TrendingUp, color: 'lavender' },
  { id: 'pagos', titulo: 'Que no se me pase ningún pago', desc: 'Recordatorios de fechas', icon: CalendarDays, color: 'blue' },
]

const BANCOS: { nombre: string; sigla: string; color: string }[] = [
  { nombre: 'Bancolombia', sigla: 'BC', color: 'yellow' },
  { nombre: 'Nequi', sigla: 'NQ', color: 'pink' },
  { nombre: 'Davivienda', sigla: 'DV', color: 'coral' },
  { nombre: 'Daviplata', sigla: 'DP', color: 'coral' },
  { nombre: 'Nu', sigla: 'Nu', color: 'lavender' },
  { nombre: 'Lulo Bank', sigla: 'LB', color: 'lime' },
  { nombre: 'Banco de Bogotá', sigla: 'BB', color: 'blue' },
  { nombre: 'BBVA', sigla: 'BV', color: 'blue' },
  { nombre: 'Banco Caja Social', sigla: 'CS', color: 'blue' },
  { nombre: 'Scotiabank Colpatria', sigla: 'SC', color: 'coral' },
  { nombre: 'RappiPay', sigla: 'RP', color: 'coral' },
  { nombre: 'Banco Popular', sigla: 'BP', color: 'coral' },
]
const BILLETERAS = new Set(['Nequi', 'Daviplata', 'Nu', 'Lulo Bank', 'RappiPay', 'Movii'])

const FIJOS_BASE: FijoOnb[] = [
  { nombre: 'Arriendo', icono: 'home', marcado: false, monto: '', dia: '1' },
  { nombre: 'Servicios', icono: 'zap', marcado: false, monto: '', dia: '15' },
  { nombre: 'Celular', icono: 'device-mobile', marcado: false, monto: '', dia: '20' },
  { nombre: 'Internet', icono: 'wifi', marcado: false, monto: '', dia: '10' },
  { nombre: 'Gimnasio', icono: 'dumbbell', marcado: false, monto: '', dia: '5' },
  { nombre: 'Suscripciones', icono: 'tv', marcado: false, monto: '', dia: '12' },
  { nombre: 'Transporte', icono: 'bus', marcado: false, monto: '', dia: '1' },
  { nombre: 'Cuota moto/carro', icono: 'bike', marcado: false, monto: '', dia: '5' },
]

export const DATOS_VACIOS: DatosOnboarding = {
  objetivos: [], tipoIngreso: null, salario: '', frecuencia: 'quincenal', prestaciones: true,
  banco: null, bancoOtro: '', cuentas: [],
  tarjeta: { on: false, banco: '', cupo: '', debe: '', dia: '5' },
  prestamo: { on: false, entidad: '', debe: '', cuota: '' },
  deboA: { on: false, quien: '', monto: '' },
  meDeben: { on: false, quien: '', monto: '' },
  fijos: FIJOS_BASE,
}

const TOTAL_PASOS = 7
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const tipoDeBanco = (banco: string): TipoCuentaOnb => (BILLETERAS.has(banco) ? 'billetera_digital' : 'cuenta_bancaria')
const ETIQUETA_TIPO: Record<TipoCuentaOnb, string> = { efectivo: 'Plata física', billetera_digital: 'Billetera digital', cuenta_bancaria: 'Cuenta bancaria', monedero: 'Alcancía o bolsillo' }
const v = (c: string) => `var(--${c})`
const vd = (c: string) => `var(--${c}-dim)`
const DISPLAY = "'Space Grotesk', sans-serif"
const CARD: CSSProperties = { background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18 }

// ---- piezas de UI (fuera del componente, ver nota arriba) ----
function Encabezado({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 text-[28px] font-bold leading-tight" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>{titulo}</h1>
      <p className="m-0 text-[15px]" style={{ color: 'var(--text-2)' }}>{sub}</p>
    </div>
  )
}

function Marca({ on, cuadrado }: { on: boolean; cuadrado?: boolean }) {
  return (
    <span className="flex flex-shrink-0 items-center justify-center" style={{ width: 24, height: 24, borderRadius: cuadrado ? 7 : 12, background: on ? 'var(--lime)' : 'transparent', border: on ? 'none' : '1.5px solid var(--text-3)' }}>
      {on && <Check size={14} strokeWidth={3} color="var(--lime-text)" />}
    </span>
  )
}

function Switch({ on, color = 'lime', onClick, label }: { on: boolean; color?: string; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="flex flex-shrink-0 items-center" style={{ width: 44, height: 26, borderRadius: 13, padding: 3, background: on ? v(color) : 'var(--line)', justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 20, height: 20, borderRadius: 10, background: on ? 'var(--bg)' : 'var(--text-2)' }} />
    </button>
  )
}

function CampoPlata({ label, valor, onChange, grande, color }: { label: string; valor: string; onChange: (s: string) => void; grande?: boolean; color?: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{label}</span>
      <input inputMode="numeric" placeholder="$ 0" value={valor ? '$ ' + conPuntos(valor) : ''} onChange={(e) => onChange(soloDigitos(e.target.value))}
        className="w-full rounded-[11px] px-3 outline-none"
        style={{ height: grande ? 56 : 40, background: 'var(--card-2)', border: '1px solid var(--line)', color: color ? v(color) : 'var(--text-1)', fontWeight: 700, fontSize: grande ? 22 : 14, fontFamily: grande ? DISPLAY : undefined }} />
    </label>
  )
}

function CampoTexto({ label, valor, onChange, placeholder, numerico }: { label: string; valor: string; onChange: (s: string) => void; placeholder?: string; numerico?: boolean }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{label}</span>
      <input value={valor} placeholder={placeholder} inputMode={numerico ? 'numeric' : undefined} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[11px] px-3 outline-none" style={{ height: 40, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)', fontWeight: 600, fontSize: 14 }} />
    </label>
  )
}

export function BotonOnb({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="flex w-full items-center justify-center rounded-2xl text-[16px] font-bold"
      style={{ height: 56, background: 'var(--lime)', color: 'var(--lime-text)', opacity: disabled ? 0.5 : 1 }}>{children}</button>
  )
}

function FilaDeuda({ icon, color, titulo, desc, on, onToggle, children }: { icon: ReactNode; color: string; titulo: string; desc: string; on: boolean; onToggle: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-3.5" style={{ ...CARD, borderColor: on ? v(color) : 'var(--line)' }}>
      <div className="flex items-center gap-3">
        <span className="flex flex-shrink-0 items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, background: vd(color) }}>{icon}</span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{titulo}</span>
          {!on && <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{desc}</span>}
        </span>
        <Switch on={on} color={color} onClick={onToggle} label={titulo} />
      </div>
      {on && children}
    </div>
  )
}

function InputAgregar({ valor, onChange, onAgregar, placeholder, label }: { valor: string; onChange: (s: string) => void; onAgregar: () => void; placeholder: string; label: string }) {
  const listo = valor.trim().length > 0
  return (
    <div className="flex gap-2">
      <input value={valor} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && listo) onAgregar() }} placeholder={placeholder} aria-label={label}
        className="min-w-0 flex-1 rounded-2xl px-3.5 text-[14px] outline-none" style={{ height: 46, background: 'transparent', border: '1.5px dashed var(--line)', color: 'var(--text-1)' }} />
      <button type="button" aria-label={label} disabled={!listo} onClick={onAgregar} className="flex items-center justify-center rounded-2xl"
        style={{ width: 46, height: 46, background: 'var(--card)', border: '1px solid var(--line)', opacity: listo ? 1 : 0.5 }}><Plus size={20} color="var(--text-1)" /></button>
    </div>
  )
}

// Marco de pantalla completa con barra de progreso (pasos 1-7).
export function MarcoOnb({ paso, onAtras, children, pie }: { paso: number | null; onAtras?: () => void; children: ReactNode; pie: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-6 pb-6 pt-4">
        {paso !== null && (
          <div className="mb-5 flex flex-shrink-0 items-center gap-3.5">
            {onAtras ? (
              <button type="button" aria-label="Atrás" onClick={onAtras} className="flex items-center justify-center rounded-[14px]" style={{ width: 44, height: 44, background: 'var(--card)' }}>
                <ChevronLeft size={20} color="var(--text-1)" />
              </button>
            ) : <span style={{ width: 44 }} />}
            <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${TOTAL_PASOS}, minmax(0, 1fr))` }}>
              {Array.from({ length: TOTAL_PASOS }, (_, i) => <div key={i} style={{ height: 4, borderRadius: 2, background: i < paso ? 'var(--lime)' : 'var(--line)' }} />)}
            </div>
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{paso}/{TOTAL_PASOS}</span>
          </div>
        )}
        {/* El scroll va en este contenedor y el contenido en un hijo propio:
        si los bloques fueran hijos directos de un flex con overflow, el
        navegador los ENCOGE en vez de dejar hacer scroll (pasaba en "¿Qué
        pagas todos los meses?" y se cortaba la lista). */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex min-h-full flex-col gap-5 pb-4">{children}</div>
        </div>
        <div className="flex flex-shrink-0 flex-col pt-2">{pie}</div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Las preguntas (pasos 0 a 6). No guarda nada: entrega los datos.
// ----------------------------------------------------------------------
export default function OnboardingGuiado({ inicial, onCompletar, onSaltar, onSalirInicio, textoFinal = 'Terminar', guardando, error, pasoInicial = 0, textoSaltar = 'Lo hago después' }: {
  inicial?: DatosOnboarding
  onCompletar: (datos: DatosOnboarding) => void
  onSaltar: () => void
  onSalirInicio?: () => void
  textoFinal?: string
  guardando?: boolean
  error?: string | null
  pasoInicial?: number
  textoSaltar?: string
}) {
  const [paso, setPaso] = useState(pasoInicial)
  const [d, setD] = useState<DatosOnboarding>(inicial ?? DATOS_VACIOS)
  const [busqueda, setBusqueda] = useState('')
  const [nuevaCuenta, setNuevaCuenta] = useState('')
  const [nuevoFijo, setNuevoFijo] = useState('')
  const set = (p: Partial<DatosOnboarding>) => setD((x) => ({ ...x, ...p }))

  const nomina = conNomina(d)
  const salarioNum = num(d.salario)
  const bancoPrincipal = bancoPrincipalDe(d)
  const { tienes } = resumenOnboarding(d)
  const cuentasMarcadas = d.cuentas.filter((c) => c.marcada)
  const fijosMarcados = d.fijos.filter((f) => f.marcado)
  const totalFijos = fijosMarcados.reduce((s, f) => s + num(f.monto), 0)

  // Al pasar a "Cuentas" se arma la lista sugerida alrededor del banco
  // principal (o se actualiza si lo cambió, sin perder saldos ya escritos).
  function prepararCuentas() {
    const principal = (b: string): CuentaOnb => ({ key: 'principal', nombre: b, tipo: tipoDeBanco(b), banco: b, marcada: true, saldo: '', principal: true })
    if (d.cuentas.length) {
      const otras = d.cuentas.filter((c) => c.key !== 'principal').map((c) => ({ ...c, principal: false }))
      if (!bancoPrincipal) return set({ cuentas: otras })
      const ya = otras.find((c) => c.banco === bancoPrincipal)
      if (ya) return set({ cuentas: otras.map((c) => (c === ya ? { ...c, principal: true, marcada: true } : c)) })
      return set({ cuentas: [principal(bancoPrincipal), ...otras] })
    }
    const lista: CuentaOnb[] = []
    if (bancoPrincipal) lista.push(principal(bancoPrincipal))
    lista.push({ key: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo', banco: null, marcada: true, saldo: '' })
    for (const b of ['Nequi', 'Bancolombia', 'Daviplata', 'Nu']) {
      if (b === bancoPrincipal) continue
      lista.push({ key: b, nombre: b === 'Bancolombia' ? 'Bancolombia ahorros' : b, tipo: tipoDeBanco(b), banco: b, marcada: false, saldo: '' })
    }
    lista.push({ key: 'alcancia', nombre: 'Alcancía', tipo: 'monedero', banco: null, marcada: false, saldo: '' })
    set({ cuentas: lista })
  }

  function siguiente() {
    if (paso === 3) prepararCuentas()
    if (paso === 6) { onCompletar(d); return }
    setPaso((p) => p + 1)
  }
  function atras() {
    if (paso === 0) onSalirInicio?.()
    else setPaso((p) => p - 1)
  }

  let contenido: ReactNode = null
  let pie: ReactNode = null

  if (paso === 0) {
    const puntos: [string, string, string][] = [['1', 'Tu objetivo y cómo recibes la plata', 'lime'], ['2', 'Tu banco principal y tus cuentas', 'lavender'], ['3', 'Tus deudas y gastos fijos', 'coral']]
    contenido = (
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex items-center gap-2">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--lime)' }} />
          <span className="text-[18px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>CashFlow</span>
        </div>
        <div className="flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--lime-dim)' }}><TrendingUp size={34} color="var(--lime)" /></div>
        <h1 className="m-0 text-[36px] font-bold leading-[1.08]" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>Armemos tu CashFlow en 2 minutos</h1>
        <p className="m-0 text-[16px] leading-relaxed" style={{ color: 'var(--text-2)' }}>Te hacemos unas preguntas rápidas y la app arranca con tus cuentas, tu banco, tus deudas y hasta tu prima y cesantías ya calculadas.</p>
        <div className="mt-2 flex flex-col gap-2.5">
          {puntos.map(([n, txt, c]) => (
            <div key={n} className="flex items-center gap-3 px-4 py-3.5" style={{ ...CARD, borderWidth: 1, borderRadius: 16 }}>
              <span className="flex items-center justify-center text-[13px] font-bold" style={{ width: 28, height: 28, borderRadius: 9, background: vd(c), color: v(c) }}>{n}</span>
              <span className="text-[14px]" style={{ color: 'var(--text-1)' }}>{txt}</span>
            </div>
          ))}
        </div>
      </div>
    )
    pie = (
      <>
        <BotonOnb onClick={siguiente}>Empezar</BotonOnb>
        <button type="button" onClick={onSaltar} disabled={guardando} className="flex w-full items-center justify-center text-[14px]" style={{ height: 44, color: 'var(--text-2)' }}>{textoSaltar}</button>
        {onSalirInicio && (
          <button type="button" onClick={onSalirInicio} className="flex w-full items-center justify-center text-[13px] font-bold" style={{ height: 36, color: 'var(--lime)' }}>¿Ya tienes cuenta? Inicia sesión</button>
        )}
      </>
    )
  }

  if (paso === 1) {
    contenido = (
      <>
        <Encabezado titulo="¿Para qué quieres CashFlow?" sub="Escoge uno o varios. Así te mostramos primero lo que más te sirve." />
        <div className="flex flex-col gap-2.5">
          {OBJETIVOS.map((o) => {
            const on = d.objetivos.includes(o.id)
            const Icon = o.icon
            return (
              <button key={o.id} type="button" aria-pressed={on}
                onClick={() => set({ objetivos: on ? d.objetivos.filter((x) => x !== o.id) : [...d.objetivos, o.id] })}
                className="flex items-center gap-3.5 p-4 text-left" style={{ ...CARD, background: on ? 'var(--lime-dim)' : 'var(--card)', borderColor: on ? 'var(--lime)' : 'var(--line)' }}>
                <span className="flex flex-shrink-0 items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: vd(o.color) }}><Icon size={20} color={v(o.color)} /></span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{o.titulo}</span>
                  <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{o.desc}</span>
                </span>
                <Marca on={on} />
              </button>
            )
          })}
        </div>
      </>
    )
    pie = <BotonOnb onClick={siguiente} disabled={d.objetivos.length === 0}>Continuar</BotonOnb>
  }

  if (paso === 2) {
    const opciones: [TipoIngreso, string][] = [['nomina', 'Nómina (empleado)'], ['independiente', 'Independiente'], ['ambos', 'Las dos'], ['otro', 'Otro (pensión, mesada)']]
    contenido = (
      <>
        <Encabezado titulo="¿Cómo te entra la plata?" sub="Con esto calculamos tu flujo del mes, tu prima y tus cesantías." />
        <div className="grid grid-cols-2 gap-2">
          {opciones.map(([id, txt]) => {
            const on = d.tipoIngreso === id
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => set({ tipoIngreso: id })} className="rounded-[14px] px-2 text-[14px]"
                style={{ minHeight: 48, fontWeight: on ? 700 : 600, background: on ? 'var(--lime)' : 'var(--card)', color: on ? 'var(--lime-text)' : 'var(--text-1)', border: on ? 'none' : '1px solid var(--line)' }}>{txt}</button>
            )
          })}
        </div>
        {nomina && (
          <>
            <CampoPlata label="Salario mensual" valor={d.salario} onChange={(s) => set({ salario: s })} grande />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>¿Cada cuánto te pagan?</span>
              <div className="flex gap-2 rounded-[14px] p-1" style={{ background: 'var(--card)' }}>
                {(['quincenal', 'mensual'] as const).map((f) => {
                  const on = d.frecuencia === f
                  return (
                    <button key={f} type="button" aria-pressed={on} onClick={() => set({ frecuencia: f })} className="flex-1 rounded-[11px] text-[14px]"
                      style={{ height: 40, background: on ? 'var(--card-2)' : 'transparent', color: on ? 'var(--text-1)' : 'var(--text-2)', fontWeight: on ? 600 : 500, border: on ? '1px solid var(--line)' : 'none' }}>
                      {f === 'quincenal' ? 'Quincenal · 15 y 30' : 'Mensual · día 30'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-[18px] p-4" style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Mi empresa me paga prima y cesantías</span>
                <Switch on={d.prestaciones} onClick={() => set({ prestaciones: !d.prestaciones })} label="Recibo prima y cesantías" />
              </div>
              {d.prestaciones && salarioNum > 0 && (
                <div className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-2)' }}>Prima · 30 jun y 20 dic</span><span className="font-bold" style={{ color: 'var(--lime)' }}>≈ {fmt(salarioNum / 2)} c/u</span></div>
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-2)' }}>Intereses de cesantías · 31 ene</span><span className="font-bold" style={{ color: 'var(--lime)' }}>≈ {fmt(salarioNum * 0.12)}</span></div>
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-2)' }}>Cesantías al fondo · 14 feb</span><span className="font-bold" style={{ color: 'var(--text-1)' }}>≈ {fmt(salarioNum)}</span></div>
                </div>
              )}
            </div>
          </>
        )}
      </>
    )
    pie = <BotonOnb onClick={siguiente} disabled={!d.tipoIngreso || (nomina && salarioNum === 0)}>Continuar</BotonOnb>
  }

  if (paso === 3) {
    const q = busqueda.trim().toLowerCase()
    const lista = q ? BANCOS.filter((b) => b.nombre.toLowerCase().includes(q)) : BANCOS
    contenido = (
      <>
        <Encabezado titulo="¿Cuál es tu banco principal?" sub={nomina ? 'Donde te llega la nómina. Ahí anotamos tus ingresos por defecto.' : 'El que más usas para recibir y pagar.'} />
        <label className="flex items-center gap-2.5 rounded-[14px] px-3.5" style={{ height: 48, background: 'var(--card)', border: '1px solid var(--line)' }}>
          <Search size={18} color="var(--text-2)" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar banco" aria-label="Buscar banco" className="flex-1 bg-transparent text-[15px] outline-none" style={{ color: 'var(--text-1)' }} />
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {[...lista, { nombre: 'Otro', sigla: '+', color: '' }].map((b) => {
            const on = d.banco === b.nombre
            return (
              <button key={b.nombre} type="button" aria-pressed={on} onClick={() => set({ banco: b.nombre })} className="flex flex-col items-center gap-2 px-1.5 py-3.5"
                style={{ ...CARD, borderRadius: 16, background: on ? 'var(--lime-dim)' : 'var(--card)', borderColor: on ? 'var(--lime)' : 'var(--line)' }}>
                <span className="flex items-center justify-center text-[14px] font-bold" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card-2)', color: b.color ? v(b.color) : 'var(--text-2)' }}>{b.sigla}</span>
                <span className="text-center text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>{b.nombre}</span>
              </button>
            )
          })}
        </div>
        {d.banco === 'Otro' && <CampoTexto label="¿Cuál?" valor={d.bancoOtro} onChange={(s) => set({ bancoOtro: s })} placeholder="Nombre del banco" />}
        <div className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: 'var(--card)' }}>
          <Info size={18} color="var(--lime)" />
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>En el siguiente paso agregas tus otras cuentas.</span>
        </div>
      </>
    )
    pie = <BotonOnb onClick={siguiente} disabled={!bancoPrincipal}>{bancoPrincipal ? `Continuar con ${bancoPrincipal}` : 'Continuar'}</BotonOnb>
  }

  if (paso === 4) {
    const setCuenta = (key: string, p: Partial<CuentaOnb>) => set({ cuentas: d.cuentas.map((x) => (x.key === key ? { ...x, ...p } : x)) })
    contenido = (
      <>
        <Encabezado titulo="¿Qué cuentas usas?" sub="Marca las que tienes y ponles cuánto hay hoy. Lo puedes cambiar después." />
        <div className="flex flex-col gap-2.5">
          {d.cuentas.map((c) => (
            <div key={c.key} className="flex items-center gap-3 px-3.5 py-3" style={{ ...CARD, borderColor: c.marcada ? 'var(--lime)' : 'var(--line)', minHeight: 66 }}>
              <button type="button" aria-pressed={c.marcada} onClick={() => setCuenta(c.key, { marcada: !c.marcada })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Marca on={c.marcada} cuadrado />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>
                    {c.nombre}
                    {c.principal && <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>PRINCIPAL</span>}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{ETIQUETA_TIPO[c.tipo]}</span>
                </span>
              </button>
              {c.marcada && (
                <input inputMode="numeric" aria-label={`Saldo de ${c.nombre}`} placeholder="$ 0" value={c.saldo ? '$ ' + conPuntos(c.saldo) : ''}
                  onChange={(e) => setCuenta(c.key, { saldo: soloDigitos(e.target.value) })}
                  className="flex-shrink-0 rounded-[11px] px-2.5 text-right text-[14px] font-bold outline-none" style={{ width: 118, height: 40, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }} />
              )}
            </div>
          ))}
          <InputAgregar valor={nuevaCuenta} onChange={setNuevaCuenta} placeholder="Otra cuenta (ej. Davivienda)" label="Agregar cuenta" onAgregar={() => {
            const nombre = nuevaCuenta.trim()
            const b = BANCOS.find((x) => nombre.toLowerCase().includes(x.nombre.toLowerCase()))?.nombre ?? null
            set({ cuentas: [...d.cuentas, { key: `n${Date.now()}`, nombre, tipo: b ? tipoDeBanco(b) : 'cuenta_bancaria', banco: b, marcada: true, saldo: '' }] })
            setNuevaCuenta('')
          }} />
        </div>
      </>
    )
    pie = (
      <>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Tienes en total</span>
          <span className="text-[22px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>{fmt(tienes)}</span>
        </div>
        <BotonOnb onClick={siguiente} disabled={cuentasMarcadas.length === 0}>Continuar</BotonOnb>
      </>
    )
  }

  if (paso === 5) {
    const ninguna = !d.tarjeta.on && !d.prestamo.on && !d.deboA.on && !d.meDeben.on
    const tj = (p: Partial<DatosOnboarding['tarjeta']>) => set({ tarjeta: { ...d.tarjeta, ...p } })
    const pr = (p: Partial<DatosOnboarding['prestamo']>) => set({ prestamo: { ...d.prestamo, ...p } })
    const da = (p: Partial<DatosOnboarding['deboA']>) => set({ deboA: { ...d.deboA, ...p } })
    const md = (p: Partial<DatosOnboarding['meDeben']>) => set({ meDeben: { ...d.meDeben, ...p } })
    contenido = (
      <>
        <Encabezado titulo="¿Debes o te deben plata?" sub="Prende lo que aplique. Así tu patrimonio sale real desde el día uno." />
        <div className="flex flex-col gap-2.5">
          <FilaDeuda icon={<CreditCard size={18} color="var(--coral)" />} color="coral" titulo="Tarjeta de crédito" desc="Lo que debes hoy y el día de pago" on={d.tarjeta.on}
            onToggle={() => tj({ on: !d.tarjeta.on, banco: d.tarjeta.banco || bancoPrincipal || '' })}>
            <div className="flex gap-2">
              <CampoTexto label="Banco" valor={d.tarjeta.banco} onChange={(s) => tj({ banco: s })} />
              <CampoTexto label="Día de pago" numerico valor={d.tarjeta.dia} onChange={(s) => tj({ dia: soloDigitos(s).slice(0, 2) })} />
            </div>
            <div className="flex gap-2">
              <CampoPlata label="Cupo total" valor={d.tarjeta.cupo} onChange={(s) => tj({ cupo: s })} />
              <CampoPlata label="Debes hoy" valor={d.tarjeta.debe} onChange={(s) => tj({ debe: s })} color="coral" />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<Landmark size={18} color="var(--yellow)" />} color="yellow" titulo="Crédito o préstamo" desc="Libre inversión, vehículo, vivienda…" on={d.prestamo.on} onToggle={() => pr({ on: !d.prestamo.on })}>
            <CampoTexto label="¿Con qué entidad?" valor={d.prestamo.entidad} onChange={(s) => pr({ entidad: s })} />
            <div className="flex gap-2">
              <CampoPlata label="Debes hoy" valor={d.prestamo.debe} onChange={(s) => pr({ debe: s })} color="coral" />
              <CampoPlata label="Cuota mensual" valor={d.prestamo.cuota} onChange={(s) => pr({ cuota: s })} />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<UserMinus size={18} color="var(--lavender)" />} color="lavender" titulo="Le debo a alguien" desc="Familia, amigos" on={d.deboA.on} onToggle={() => da({ on: !d.deboA.on })}>
            <div className="flex gap-2">
              <CampoTexto label="¿A quién?" valor={d.deboA.quien} onChange={(s) => da({ quien: s })} />
              <CampoPlata label="¿Cuánto?" valor={d.deboA.monto} onChange={(s) => da({ monto: s })} color="coral" />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<UserPlus size={18} color="var(--lime)" />} color="lime" titulo="Me deben" desc="Plata que prestaste" on={d.meDeben.on} onToggle={() => md({ on: !d.meDeben.on })}>
            <div className="flex gap-2">
              <CampoTexto label="¿Quién?" valor={d.meDeben.quien} onChange={(s) => md({ quien: s })} />
              <CampoPlata label="¿Cuánto?" valor={d.meDeben.monto} onChange={(s) => md({ monto: s })} color="lime" />
            </div>
          </FilaDeuda>
        </div>
      </>
    )
    pie = <BotonOnb onClick={siguiente}>{ninguna ? 'No tengo deudas' : 'Continuar'}</BotonOnb>
  }

  if (paso === 6) {
    const libre = salarioNum - totalFijos
    const setFijo = (nombre: string, p: Partial<FijoOnb>) => set({ fijos: d.fijos.map((x) => (x.nombre === nombre ? { ...x, ...p } : x)) })
    contenido = (
      <>
        <Encabezado titulo="¿Qué pagas todos los meses?" sub="Te recordamos cada pago antes de la fecha." />
        <div className="flex flex-wrap gap-2">
          {d.fijos.map((f) => (
            <button key={f.nombre} type="button" aria-pressed={f.marcado} onClick={() => setFijo(f.nombre, { marcado: !f.marcado })} className="rounded-full px-3.5 text-[13px]"
              style={{ height: 40, background: f.marcado ? 'var(--lime)' : 'var(--card)', color: f.marcado ? 'var(--lime-text)' : 'var(--text-1)', fontWeight: f.marcado ? 700 : 600, border: f.marcado ? 'none' : '1px solid var(--line)' }}>{f.nombre}</button>
          ))}
        </div>
        <InputAgregar valor={nuevoFijo} onChange={setNuevoFijo} placeholder="Otro pago fijo" label="Agregar pago fijo" onAgregar={() => {
          const nombre = nuevoFijo.trim()
          if (!d.fijos.some((f) => f.nombre.toLowerCase() === nombre.toLowerCase())) set({ fijos: [...d.fijos, { nombre, icono: 'dots', marcado: true, monto: '', dia: '1' }] })
          setNuevoFijo('')
        }} />
        {fijosMarcados.length > 0 && (
          <div className="flex flex-col overflow-hidden" style={{ ...CARD, borderWidth: 1 }}>
            {fijosMarcados.map((f, i) => (
              <div key={f.nombre} className="flex items-center gap-2 px-4 py-3" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{f.nombre}</span>
                <label className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-2)' }}>Día
                  <input inputMode="numeric" value={f.dia} aria-label={`Día de pago de ${f.nombre}`} onChange={(e) => setFijo(f.nombre, { dia: soloDigitos(e.target.value).slice(0, 2) })}
                    className="rounded-lg text-center text-[13px] font-semibold outline-none" style={{ width: 38, height: 36, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }} />
                </label>
                <input inputMode="numeric" placeholder="$ 0" aria-label={`Valor de ${f.nombre}`} value={f.monto ? '$ ' + conPuntos(f.monto) : ''} onChange={(e) => setFijo(f.nombre, { monto: soloDigitos(e.target.value) })}
                  className="flex-shrink-0 rounded-[11px] px-2.5 text-right text-[14px] font-bold outline-none" style={{ width: 112, height: 36, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }} />
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Fijos al mes</span>
            <span className="text-[20px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--coral)' }}>{fmt(totalFijos)}</span>
          </div>
          {nomina && salarioNum > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Te quedan libres</span>
              <span className="text-[20px] font-bold" style={{ fontFamily: DISPLAY, color: libre >= 0 ? 'var(--lime)' : 'var(--coral)' }}>{fmt(libre)}</span>
            </div>
          )}
        </div>
        {error && <p className="m-0 rounded-xl p-3 text-[13px]" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>{error}</p>}
      </>
    )
    pie = <BotonOnb onClick={siguiente} disabled={guardando}>{guardando ? 'Guardando…' : textoFinal}</BotonOnb>
  }

  return (
    <MarcoOnb paso={paso >= 1 ? paso : null} onAtras={paso >= 1 ? atras : undefined} pie={pie}>
      {contenido}
    </MarcoOnb>
  )
}

// ----------------------------------------------------------------------
// Pantalla final: patrimonio neto y próximas fechas.
// ----------------------------------------------------------------------
export function OnboardingListo({ datos, onEntrar }: { datos: DatosOnboarding; onEntrar: () => void }) {
  const r = resumenOnboarding(datos)
  const proximas = proximasFechas(datos)
  const resumen: [number, string][] = [[r.nCuentas, 'cuentas'], [r.nDeudas, 'deudas'], [r.nFijos, 'pagos fijos']]
  return (
    <MarcoOnb paso={null} pie={<BotonOnb onClick={onEntrar}>Entrar a CashFlow</BotonOnb>}>
      <div className="flex flex-col gap-2 pt-6">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--lime)' }}><Sparkles size={14} /> Listo</span>
        <h1 className="m-0 text-[30px] font-bold leading-[1.1]" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>Tu CashFlow ya arrancó con tus datos</h1>
      </div>
      <div className="flex flex-col gap-3 rounded-[22px] p-[18px]" style={{ background: 'var(--card-lime)', color: 'var(--lime-text)' }}>
        <span className="text-[13px] font-semibold">Patrimonio neto</span>
        <span className="text-[34px] font-bold leading-none" style={{ fontFamily: DISPLAY }}>{fmt(r.patrimonio)}</span>
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <div className="flex flex-col gap-0.5"><span>Tienes</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-pos)' }}>{fmt(r.tienes)}</span></div>
          <div className="flex flex-col gap-0.5"><span>Te deben</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-pos)' }}>{fmt(r.teDeben)}</span></div>
          <div className="flex flex-col gap-0.5"><span>Debes</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-neg)' }}>{fmt(r.debes)}</span></div>
        </div>
      </div>
      {proximas.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Próximas fechas</span>
          <div className="flex flex-col overflow-hidden" style={{ ...CARD, borderWidth: 1 }}>
            {proximas.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span className="flex w-10 flex-col text-center">
                  <span className="text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>{p.fecha.getDate()}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{MESES[p.fecha.getMonth()]}</span>
                </span>
                <span className="flex-1 text-[14px]" style={{ color: 'var(--text-1)' }}>{p.texto}</span>
                <span className="text-[14px] font-bold" style={{ color: v(p.color) }}>{p.monto}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {resumen.map(([n, t]) => (
          <div key={t} className="flex flex-col gap-0.5 rounded-[14px] p-3" style={{ background: 'var(--card)' }}>
            <span className="text-[20px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>{n}</span>
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{t}</span>
          </div>
        ))}
      </div>
    </MarcoOnb>
  )
}

// ----------------------------------------------------------------------
// Para AppShell: si hay datos pendientes del registro los aplica; si no,
// hace las preguntas. Al final muestra la pantalla "Listo".
// ----------------------------------------------------------------------
export function OnboardingFlujo({ userId, pendiente, onDone }: { userId: string; pendiente: DatosOnboarding | null; onDone: () => void }) {
  const [datos, setDatos] = useState<DatosOnboarding | null>(pendiente)
  const [aplicado, setAplicado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function aplicar(d: DatosOnboarding) {
    setDatos(d)
    setGuardando(true)
    setError(null)
    try {
      await aplicarOnboarding(userId, d)
      borrarPendiente()
      setAplicado(true)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Datos que vienen del registro: se aplican apenas hay sesión.
  useEffect(() => {
    if (pendiente) void aplicar(pendiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (aplicado && datos) return <OnboardingListo datos={datos} onEntrar={onDone} />

  if (pendiente) {
    return (
      <MarcoOnb paso={null} pie={error ? <BotonOnb onClick={() => void aplicar(pendiente)} disabled={guardando}>{guardando ? 'Guardando…' : 'Intentar de nuevo'}</BotonOnb> : null}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--lime-dim)' }}><Sparkles size={32} color="var(--lime)" /></div>
          <h1 className="m-0 text-[24px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>{error ? 'No pudimos terminar' : 'Armando tu CashFlow…'}</h1>
          <p className="m-0 text-[14px]" style={{ color: error ? 'var(--coral)' : 'var(--text-2)' }}>{error ?? 'Creando tus cuentas, deudas y pagos fijos.'}</p>
        </div>
      </MarcoOnb>
    )
  }

  return (
    <OnboardingGuiado
      inicial={datos ?? undefined}
      onCompletar={(d) => void aplicar(d)}
      onSaltar={async () => { await marcarOnboardingSaltado(userId); onDone() }}
      guardando={guardando}
      error={error}
    />
  )
}

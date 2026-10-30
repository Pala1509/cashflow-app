import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ChevronLeft, Check, Target, CreditCard, BarChart3, TrendingUp, CalendarDays, Search, Info,
  Landmark, UserMinus, UserPlus, Plus, Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayLocal } from '../lib/date'
import { pagosPrestaciones } from '../lib/prestaciones'

// Onboarding guiado (cuentas nuevas): en 2 minutos la persona deja la app
// con sus datos reales — objetivo, cómo le entra la plata (nómina → prima y
// cesantías), banco principal, cuentas con saldo, deudas y gastos fijos. Al
// terminar se crea TODO de verdad en Supabase. Se muestra una sola vez
// (profiles.onboarding_guiado_completado); "Lo hago después" también lo
// marca, sin crear nada. Es React, así que sirve igual en iPhone y Android.
//
// Ojo: las piezas de UI (Campo, Switch, Fila…) viven FUERA del componente a
// propósito. Si se definen adentro, React las trata como un componente nuevo
// en cada render y los inputs pierden el foco con cada tecla.

type TipoIngreso = 'nomina' | 'independiente' | 'ambos' | 'otro'
type TipoCuenta = 'efectivo' | 'billetera_digital' | 'cuenta_bancaria' | 'monedero'

interface CuentaForm { key: string; nombre: string; tipo: TipoCuenta; banco: string | null; marcada: boolean; saldo: string; principal?: boolean }
interface FijoForm { nombre: string; icono: string; marcado: boolean; monto: string; dia: string }

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

const FIJOS_BASE: FijoForm[] = [
  { nombre: 'Arriendo', icono: 'home', marcado: false, monto: '', dia: '1' },
  { nombre: 'Servicios', icono: 'zap', marcado: false, monto: '', dia: '15' },
  { nombre: 'Celular', icono: 'device-mobile', marcado: false, monto: '', dia: '20' },
  { nombre: 'Internet', icono: 'wifi', marcado: false, monto: '', dia: '10' },
  { nombre: 'Gimnasio', icono: 'dumbbell', marcado: false, monto: '', dia: '5' },
  { nombre: 'Suscripciones', icono: 'tv', marcado: false, monto: '', dia: '12' },
  { nombre: 'Transporte', icono: 'bus', marcado: false, monto: '', dia: '1' },
  { nombre: 'Cuota moto/carro', icono: 'bike', marcado: false, monto: '', dia: '5' },
]

const TOTAL_PASOS = 7
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ---- utilidades ----
const soloDigitos = (s: string) => s.replace(/\D/g, '')
const num = (s: string) => Number(soloDigitos(s) || 0)
const fmt = (n: number) => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-CO')
const conPuntos = (s: string) => { const d = soloDigitos(s); return d ? Number(d).toLocaleString('es-CO') : '' }
const tipoDeBanco = (banco: string): TipoCuenta => (BILLETERAS.has(banco) ? 'billetera_digital' : 'cuenta_bancaria')
const ICONO_TIPO: Record<TipoCuenta, string> = { efectivo: 'cash', billetera_digital: 'device-mobile', cuenta_bancaria: 'building-bank', monedero: 'piggy-bank' }
const COLOR_TIPO: Record<TipoCuenta, string> = { efectivo: 'lime', billetera_digital: 'lavender', cuenta_bancaria: 'yellow', monedero: 'teal' }
const ETIQUETA_TIPO: Record<TipoCuenta, string> = { efectivo: 'Plata física', billetera_digital: 'Billetera digital', cuenta_bancaria: 'Cuenta bancaria', monedero: 'Alcancía o bolsillo' }
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

function Boton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center justify-center rounded-2xl text-[16px] font-bold"
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

export default function OnboardingGuiado({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [paso, setPaso] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [objetivos, setObjetivos] = useState<Set<string>>(new Set())
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngreso | null>(null)
  const [salario, setSalario] = useState('')
  const [frecuencia, setFrecuencia] = useState<'quincenal' | 'mensual'>('quincenal')
  const [prestaciones, setPrestaciones] = useState(true)
  const [banco, setBanco] = useState<string | null>(null)
  const [bancoOtro, setBancoOtro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cuentas, setCuentas] = useState<CuentaForm[]>([])
  const [nuevaCuenta, setNuevaCuenta] = useState('')
  const [tarjeta, setTarjeta] = useState({ on: false, banco: '', cupo: '', debe: '', dia: '5' })
  const [prestamo, setPrestamo] = useState({ on: false, entidad: '', debe: '', cuota: '' })
  const [deboA, setDeboA] = useState({ on: false, quien: '', monto: '' })
  const [meDeben, setMeDeben] = useState({ on: false, quien: '', monto: '' })
  const [fijos, setFijos] = useState<FijoForm[]>(FIJOS_BASE)
  const [nuevoFijo, setNuevoFijo] = useState('')

  const conNomina = tipoIngreso === 'nomina' || tipoIngreso === 'ambos'
  const salarioNum = num(salario)
  const bancoPrincipal = banco === 'Otro' ? bancoOtro.trim() || null : banco

  // Al pasar a "Cuentas" se arma la lista sugerida alrededor del banco
  // principal (o se actualiza si lo cambió, sin perder saldos ya escritos).
  function prepararCuentas() {
    const principal = (b: string): CuentaForm => ({ key: 'principal', nombre: b, tipo: tipoDeBanco(b), banco: b, marcada: true, saldo: '', principal: true })
    if (cuentas.length) {
      setCuentas((cs) => {
        const otras = cs.filter((c) => c.key !== 'principal').map((c) => ({ ...c, principal: false }))
        if (!bancoPrincipal) return otras
        const ya = otras.find((c) => c.banco === bancoPrincipal)
        if (ya) return otras.map((c) => (c === ya ? { ...c, principal: true, marcada: true } : c))
        return [principal(bancoPrincipal), ...otras]
      })
      return
    }
    const lista: CuentaForm[] = []
    if (bancoPrincipal) lista.push(principal(bancoPrincipal))
    lista.push({ key: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo', banco: null, marcada: true, saldo: '' })
    for (const b of ['Nequi', 'Bancolombia', 'Daviplata', 'Nu']) {
      if (b === bancoPrincipal) continue
      lista.push({ key: b, nombre: b === 'Bancolombia' ? 'Bancolombia ahorros' : b, tipo: tipoDeBanco(b), banco: b, marcada: false, saldo: '' })
    }
    lista.push({ key: 'alcancia', nombre: 'Alcancía', tipo: 'monedero', banco: null, marcada: false, saldo: '' })
    setCuentas(lista)
  }

  const cuentasMarcadas = cuentas.filter((c) => c.marcada)
  const tienes = cuentasMarcadas.reduce((s, c) => s + num(c.saldo), 0)
  const debes = (tarjeta.on ? num(tarjeta.debe) : 0) + (prestamo.on ? num(prestamo.debe) : 0) + (deboA.on ? num(deboA.monto) : 0)
  const teDeben = meDeben.on ? num(meDeben.monto) : 0
  const fijosMarcados = fijos.filter((f) => f.marcado)
  const totalFijos = fijosMarcados.reduce((s, f) => s + num(f.monto), 0)

  const proximas = useMemo(() => {
    const hoy = new Date()
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    const enMes = (dia: number) => {
      const d = new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(dia, 1), 28))
      if (d < base) d.setMonth(d.getMonth() + 1)
      return d
    }
    const out: { fecha: Date; texto: string; monto: string; color: string }[] = []
    for (const f of fijos) if (f.marcado && num(f.monto) > 0) out.push({ fecha: enMes(Number(f.dia) || 1), texto: f.nombre, monto: '−' + fmt(num(f.monto)), color: 'coral' })
    if (tarjeta.on && num(tarjeta.debe) > 0) out.push({ fecha: enMes(Number(tarjeta.dia) || 5), texto: `Pago tarjeta ${tarjeta.banco}`.trim(), monto: 'Pendiente', color: 'coral' })
    if (conNomina && salarioNum > 0) {
      const pago = frecuencia === 'quincenal' ? salarioNum / 2 : salarioNum
      out.push({ fecha: enMes(frecuencia === 'quincenal' ? 15 : 30), texto: frecuencia === 'quincenal' ? 'Quincena' : 'Nómina', monto: '+' + fmt(pago), color: 'lime' })
      if (prestaciones) {
        const p = pagosPrestaciones(salarioNum, base, new Date(base.getFullYear() + 1, base.getMonth(), base.getDate()))[0]
        if (p) {
          const [y, m, d] = p.fecha.split('-').map(Number)
          const nombre = p.tipo === 'intereses_cesantias' ? 'Intereses de cesantías' : p.tipo === 'prima_junio' ? 'Prima de junio' : 'Prima de diciembre'
          out.push({ fecha: new Date(y, m - 1, d), texto: nombre, monto: '≈ +' + fmt(p.monto), color: 'lime' })
        }
      }
    }
    return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(0, 4)
  }, [fijos, tarjeta, conNomina, salarioNum, frecuencia, prestaciones])

  async function saltar() {
    setGuardando(true)
    await supabase.from('profiles').update({ onboarding_guiado_completado: true }).eq('id', userId)
    setGuardando(false)
    onDone()
  }

  async function guardarTodo() {
    setGuardando(true)
    setError(null)
    try {
      const hoy = todayLocal()
      const nuevasCuentas: Record<string, unknown>[] = cuentasMarcadas.map((c) => ({
        user_id: userId, tipo: c.tipo, nombre: c.nombre.trim() || 'Cuenta', saldo: num(c.saldo),
        icono: ICONO_TIPO[c.tipo], color: COLOR_TIPO[c.tipo], four_x_mil: false, activa: true,
        es_ahorro: c.tipo === 'monedero', banco: c.banco, moneda: 'COP',
      }))
      if (tarjeta.on) {
        // En CashFlow la tarjeta guarda el cupo DISPONIBLE en `saldo`:
        // lo que debes = cupo_total − saldo.
        const debe = num(tarjeta.debe)
        const cupo = Math.max(num(tarjeta.cupo), debe)
        nuevasCuentas.push({
          user_id: userId, tipo: 'tarjeta_credito', nombre: tarjeta.banco.trim() ? `Tarjeta ${tarjeta.banco.trim()}` : 'Tarjeta de crédito',
          saldo: cupo - debe, cupo_total: cupo, icono: 'credit-card', color: 'coral', four_x_mil: false, activa: true,
          banco: tarjeta.banco.trim() || null, dia_pago: Number(tarjeta.dia) || null, moneda: 'COP',
        })
      }
      if (nuevasCuentas.length) {
        const r = await supabase.from('cuentas').insert(nuevasCuentas)
        if (r.error) throw r.error
      }

      const deudas: Record<string, unknown>[] = []
      if (prestamo.on && num(prestamo.debe) > 0) deudas.push({
        user_id: userId, tipo: 'deuda', subtipo: 'Préstamo bancario', nombre: prestamo.entidad.trim() ? `Crédito ${prestamo.entidad.trim()}` : 'Crédito',
        entidad: prestamo.entidad.trim() || null, capital: num(prestamo.debe), tipo_interes: 'sin_interes', cuota_mensual: num(prestamo.cuota) || null,
        fecha_inicio: hoy, estado: 'activa',
      })
      if (deboA.on && num(deboA.monto) > 0) deudas.push({
        user_id: userId, tipo: 'deuda', subtipo: 'Préstamo con un tercero', nombre: deboA.quien.trim() ? `Le debo a ${deboA.quien.trim()}` : 'Deuda personal',
        capital: num(deboA.monto), tipo_interes: 'sin_interes', fecha_inicio: hoy, estado: 'activa',
      })
      if (meDeben.on && num(meDeben.monto) > 0) deudas.push({
        user_id: userId, tipo: 'credito', subtipo: 'Préstamo a un amigo o familiar', nombre: meDeben.quien.trim() ? `Me debe ${meDeben.quien.trim()}` : 'Me deben',
        capital: num(meDeben.monto), tipo_interes: 'sin_interes', fecha_inicio: hoy, estado: 'activa',
      })
      if (deudas.length) {
        const r = await supabase.from('deudas_creditos').insert(deudas)
        if (r.error) throw r.error
      }

      const gastos = fijosMarcados.filter((f) => num(f.monto) > 0).map((f) => ({
        user_id: userId, nombre: f.nombre, monto: num(f.monto), dia_mes: Math.min(Math.max(Number(f.dia) || 1, 1), 31),
        frecuencia: 'mensual', icono: f.icono, activo: true, notif_dias_antes: 2,
      }))
      if (gastos.length) {
        const r = await supabase.from('gastos_fijos').insert(gastos)
        if (r.error) throw r.error
      }

      // "Nómina" como ingreso fijo: así lo detecta el motor de prima y
      // cesantías (detectarSalarioMensual) y entra al flujo de caja.
      if (conNomina && salarioNum > 0) {
        const r = await supabase.from('ingresos_fijos').insert({
          user_id: userId, nombre: 'Nómina', monto: frecuencia === 'quincenal' ? Math.round(salarioNum / 2) : salarioNum,
          dia_mes: frecuencia === 'quincenal' ? 15 : 30, frecuencia, icono: 'cash', activo: true,
        })
        if (r.error) throw r.error
      }

      const r = await supabase.from('profiles').update({
        objetivos: [...objetivos], tipo_ingreso: tipoIngreso, banco_principal: bancoPrincipal,
        salario_mensual: conNomina && salarioNum > 0 ? salarioNum : null,
        recibe_prestaciones: conNomina ? prestaciones : false,
        onboarding_guiado_completado: true,
      }).eq('id', userId)
      if (r.error) throw r.error
      setPaso(7)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function siguiente() {
    if (paso === 3) prepararCuentas()
    if (paso === 6) { void guardarTodo(); return }
    setPaso((p) => p + 1)
  }

  // ---------- pantallas ----------
  let contenido: ReactNode = null
  let pie: ReactNode = null

  if (paso === 0) {
    const puntos: [string, string, string][] = [['1', 'Tu objetivo y cómo recibes la plata', 'lime'], ['2', 'Tu banco principal y tus cuentas', 'lavender'], ['3', 'Tus deudas y gastos fijos', 'coral']]
    contenido = (
      <div className="flex flex-1 flex-col justify-center gap-5">
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
        <Boton onClick={siguiente}>Empezar</Boton>
        <button type="button" onClick={saltar} disabled={guardando} className="flex w-full items-center justify-center text-[14px]" style={{ height: 44, color: 'var(--text-2)' }}>Lo hago después</button>
      </>
    )
  }

  if (paso === 1) {
    contenido = (
      <>
        <Encabezado titulo="¿Para qué quieres CashFlow?" sub="Escoge uno o varios. Así te mostramos primero lo que más te sirve." />
        <div className="flex flex-col gap-2.5">
          {OBJETIVOS.map((o) => {
            const on = objetivos.has(o.id)
            const Icon = o.icon
            return (
              <button key={o.id} type="button" aria-pressed={on}
                onClick={() => setObjetivos((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n })}
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
    pie = <Boton onClick={siguiente} disabled={objetivos.size === 0}>Continuar</Boton>
  }

  if (paso === 2) {
    const opciones: [TipoIngreso, string][] = [['nomina', 'Nómina (empleado)'], ['independiente', 'Independiente'], ['ambos', 'Las dos'], ['otro', 'Otro (pensión, mesada)']]
    contenido = (
      <>
        <Encabezado titulo="¿Cómo te entra la plata?" sub="Con esto calculamos tu flujo del mes, tu prima y tus cesantías." />
        <div className="grid grid-cols-2 gap-2">
          {opciones.map(([id, txt]) => {
            const on = tipoIngreso === id
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => setTipoIngreso(id)} className="rounded-[14px] px-2 text-[14px]"
                style={{ minHeight: 48, fontWeight: on ? 700 : 600, background: on ? 'var(--lime)' : 'var(--card)', color: on ? 'var(--lime-text)' : 'var(--text-1)', border: on ? 'none' : '1px solid var(--line)' }}>{txt}</button>
            )
          })}
        </div>
        {conNomina && (
          <>
            <CampoPlata label="Salario mensual" valor={salario} onChange={setSalario} grande />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>¿Cada cuánto te pagan?</span>
              <div className="flex gap-2 rounded-[14px] p-1" style={{ background: 'var(--card)' }}>
                {(['quincenal', 'mensual'] as const).map((f) => {
                  const on = frecuencia === f
                  return (
                    <button key={f} type="button" aria-pressed={on} onClick={() => setFrecuencia(f)} className="flex-1 rounded-[11px] text-[14px]"
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
                <Switch on={prestaciones} onClick={() => setPrestaciones((p) => !p)} label="Recibo prima y cesantías" />
              </div>
              {prestaciones && salarioNum > 0 && (
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
    pie = <Boton onClick={siguiente} disabled={!tipoIngreso || (conNomina && salarioNum === 0)}>Continuar</Boton>
  }

  if (paso === 3) {
    const q = busqueda.trim().toLowerCase()
    const lista = q ? BANCOS.filter((b) => b.nombre.toLowerCase().includes(q)) : BANCOS
    contenido = (
      <>
        <Encabezado titulo="¿Cuál es tu banco principal?" sub={conNomina ? 'Donde te llega la nómina. Ahí anotamos tus ingresos por defecto.' : 'El que más usas para recibir y pagar.'} />
        <label className="flex items-center gap-2.5 rounded-[14px] px-3.5" style={{ height: 48, background: 'var(--card)', border: '1px solid var(--line)' }}>
          <Search size={18} color="var(--text-2)" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar banco" aria-label="Buscar banco" className="flex-1 bg-transparent text-[15px] outline-none" style={{ color: 'var(--text-1)' }} />
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {[...lista, { nombre: 'Otro', sigla: '+', color: '' }].map((b) => {
            const on = banco === b.nombre
            return (
              <button key={b.nombre} type="button" aria-pressed={on} onClick={() => setBanco(b.nombre)} className="flex flex-col items-center gap-2 px-1.5 py-3.5"
                style={{ ...CARD, borderRadius: 16, background: on ? 'var(--lime-dim)' : 'var(--card)', borderColor: on ? 'var(--lime)' : 'var(--line)' }}>
                <span className="flex items-center justify-center text-[14px] font-bold" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card-2)', color: b.color ? v(b.color) : 'var(--text-2)' }}>{b.sigla}</span>
                <span className="text-center text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>{b.nombre}</span>
              </button>
            )
          })}
        </div>
        {banco === 'Otro' && <CampoTexto label="¿Cuál?" valor={bancoOtro} onChange={setBancoOtro} placeholder="Nombre del banco" />}
        <div className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: 'var(--card)' }}>
          <Info size={18} color="var(--lime)" />
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>En el siguiente paso agregas tus otras cuentas.</span>
        </div>
      </>
    )
    pie = <Boton onClick={siguiente} disabled={!bancoPrincipal}>{bancoPrincipal ? `Continuar con ${bancoPrincipal}` : 'Continuar'}</Boton>
  }

  if (paso === 4) {
    contenido = (
      <>
        <Encabezado titulo="¿Qué cuentas usas?" sub="Marca las que tienes y ponles cuánto hay hoy. Lo puedes cambiar después." />
        <div className="flex flex-col gap-2.5">
          {cuentas.map((c) => (
            <div key={c.key} className="flex items-center gap-3 px-3.5 py-3" style={{ ...CARD, borderColor: c.marcada ? 'var(--lime)' : 'var(--line)', minHeight: 66 }}>
              <button type="button" aria-pressed={c.marcada} onClick={() => setCuentas((cs) => cs.map((x) => (x.key === c.key ? { ...x, marcada: !x.marcada } : x)))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
                  onChange={(e) => { const s = soloDigitos(e.target.value); setCuentas((cs) => cs.map((x) => (x.key === c.key ? { ...x, saldo: s } : x))) }}
                  className="flex-shrink-0 rounded-[11px] px-2.5 text-right text-[14px] font-bold outline-none" style={{ width: 118, height: 40, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }} />
              )}
            </div>
          ))}
          <InputAgregar valor={nuevaCuenta} onChange={setNuevaCuenta} placeholder="Otra cuenta (ej. Davivienda)" label="Agregar cuenta" onAgregar={() => {
            const nombre = nuevaCuenta.trim()
            const b = BANCOS.find((x) => nombre.toLowerCase().includes(x.nombre.toLowerCase()))?.nombre ?? null
            setCuentas((cs) => [...cs, { key: `n${Date.now()}`, nombre, tipo: b ? tipoDeBanco(b) : 'cuenta_bancaria', banco: b, marcada: true, saldo: '' }])
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
        <Boton onClick={siguiente} disabled={cuentasMarcadas.length === 0}>Continuar</Boton>
      </>
    )
  }

  if (paso === 5) {
    const ninguna = !tarjeta.on && !prestamo.on && !deboA.on && !meDeben.on
    contenido = (
      <>
        <Encabezado titulo="¿Debes o te deben plata?" sub="Prende lo que aplique. Así tu patrimonio sale real desde el día uno." />
        <div className="flex flex-col gap-2.5">
          <FilaDeuda icon={<CreditCard size={18} color="var(--coral)" />} color="coral" titulo="Tarjeta de crédito" desc="Lo que debes hoy y el día de pago" on={tarjeta.on}
            onToggle={() => setTarjeta((t) => ({ ...t, on: !t.on, banco: t.banco || bancoPrincipal || '' }))}>
            <div className="flex gap-2">
              <CampoTexto label="Banco" valor={tarjeta.banco} onChange={(s) => setTarjeta((t) => ({ ...t, banco: s }))} />
              <CampoTexto label="Día de pago" numerico valor={tarjeta.dia} onChange={(s) => setTarjeta((t) => ({ ...t, dia: soloDigitos(s).slice(0, 2) }))} />
            </div>
            <div className="flex gap-2">
              <CampoPlata label="Cupo total" valor={tarjeta.cupo} onChange={(s) => setTarjeta((t) => ({ ...t, cupo: s }))} />
              <CampoPlata label="Debes hoy" valor={tarjeta.debe} onChange={(s) => setTarjeta((t) => ({ ...t, debe: s }))} color="coral" />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<Landmark size={18} color="var(--yellow)" />} color="yellow" titulo="Crédito o préstamo" desc="Libre inversión, vehículo, vivienda…" on={prestamo.on} onToggle={() => setPrestamo((p) => ({ ...p, on: !p.on }))}>
            <CampoTexto label="¿Con qué entidad?" valor={prestamo.entidad} onChange={(s) => setPrestamo((p) => ({ ...p, entidad: s }))} />
            <div className="flex gap-2">
              <CampoPlata label="Debes hoy" valor={prestamo.debe} onChange={(s) => setPrestamo((p) => ({ ...p, debe: s }))} color="coral" />
              <CampoPlata label="Cuota mensual" valor={prestamo.cuota} onChange={(s) => setPrestamo((p) => ({ ...p, cuota: s }))} />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<UserMinus size={18} color="var(--lavender)" />} color="lavender" titulo="Le debo a alguien" desc="Familia, amigos" on={deboA.on} onToggle={() => setDeboA((d) => ({ ...d, on: !d.on }))}>
            <div className="flex gap-2">
              <CampoTexto label="¿A quién?" valor={deboA.quien} onChange={(s) => setDeboA((d) => ({ ...d, quien: s }))} />
              <CampoPlata label="¿Cuánto?" valor={deboA.monto} onChange={(s) => setDeboA((d) => ({ ...d, monto: s }))} color="coral" />
            </div>
          </FilaDeuda>
          <FilaDeuda icon={<UserPlus size={18} color="var(--lime)" />} color="lime" titulo="Me deben" desc="Plata que prestaste" on={meDeben.on} onToggle={() => setMeDeben((d) => ({ ...d, on: !d.on }))}>
            <div className="flex gap-2">
              <CampoTexto label="¿Quién?" valor={meDeben.quien} onChange={(s) => setMeDeben((d) => ({ ...d, quien: s }))} />
              <CampoPlata label="¿Cuánto?" valor={meDeben.monto} onChange={(s) => setMeDeben((d) => ({ ...d, monto: s }))} color="lime" />
            </div>
          </FilaDeuda>
        </div>
      </>
    )
    pie = <Boton onClick={siguiente}>{ninguna ? 'No tengo deudas' : 'Continuar'}</Boton>
  }

  if (paso === 6) {
    const libre = salarioNum - totalFijos
    contenido = (
      <>
        <Encabezado titulo="¿Qué pagas todos los meses?" sub="Te recordamos cada pago antes de la fecha." />
        <div className="flex flex-wrap gap-2">
          {fijos.map((f, i) => (
            <button key={f.nombre} type="button" aria-pressed={f.marcado} onClick={() => setFijos((fs) => fs.map((x, j) => (j === i ? { ...x, marcado: !x.marcado } : x)))} className="rounded-full px-3.5 text-[13px]"
              style={{ height: 40, background: f.marcado ? 'var(--lime)' : 'var(--card)', color: f.marcado ? 'var(--lime-text)' : 'var(--text-1)', fontWeight: f.marcado ? 700 : 600, border: f.marcado ? 'none' : '1px solid var(--line)' }}>{f.nombre}</button>
          ))}
        </div>
        <InputAgregar valor={nuevoFijo} onChange={setNuevoFijo} placeholder="Otro pago fijo" label="Agregar pago fijo" onAgregar={() => {
          const nombre = nuevoFijo.trim()
          if (!fijos.some((f) => f.nombre.toLowerCase() === nombre.toLowerCase())) setFijos((fs) => [...fs, { nombre, icono: 'dots', marcado: true, monto: '', dia: '1' }])
          setNuevoFijo('')
        }} />
        {fijosMarcados.length > 0 && (
          <div className="flex flex-col overflow-hidden" style={{ ...CARD, borderWidth: 1 }}>
            {fijosMarcados.map((f, i) => (
              <div key={f.nombre} className="flex items-center gap-2 px-4 py-3" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{f.nombre}</span>
                <label className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-2)' }}>Día
                  <input inputMode="numeric" value={f.dia} aria-label={`Día de pago de ${f.nombre}`}
                    onChange={(e) => { const d = soloDigitos(e.target.value).slice(0, 2); setFijos((fs) => fs.map((x) => (x.nombre === f.nombre ? { ...x, dia: d } : x))) }}
                    className="rounded-lg text-center text-[13px] font-semibold outline-none" style={{ width: 38, height: 36, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }} />
                </label>
                <input inputMode="numeric" placeholder="$ 0" aria-label={`Valor de ${f.nombre}`} value={f.monto ? '$ ' + conPuntos(f.monto) : ''}
                  onChange={(e) => { const s = soloDigitos(e.target.value); setFijos((fs) => fs.map((x) => (x.nombre === f.nombre ? { ...x, monto: s } : x))) }}
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
          {conNomina && salarioNum > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Te quedan libres</span>
              <span className="text-[20px] font-bold" style={{ fontFamily: DISPLAY, color: libre >= 0 ? 'var(--lime)' : 'var(--coral)' }}>{fmt(libre)}</span>
            </div>
          )}
        </div>
        {error && <p className="m-0 rounded-xl p-3 text-[13px]" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>{error}</p>}
      </>
    )
    pie = <Boton onClick={siguiente} disabled={guardando}>{guardando ? 'Guardando…' : 'Terminar'}</Boton>
  }

  if (paso === 7) {
    const patrimonio = tienes + teDeben - debes
    const nDeudas = [tarjeta.on, prestamo.on, deboA.on, meDeben.on].filter(Boolean).length
    const resumen: [number, string][] = [[cuentasMarcadas.length, 'cuentas'], [nDeudas, 'deudas'], [fijosMarcados.filter((f) => num(f.monto) > 0).length, 'pagos fijos']]
    contenido = (
      <>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--lime)' }}><Sparkles size={14} /> Listo</span>
          <h1 className="m-0 text-[30px] font-bold leading-[1.1]" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>Tu CashFlow ya arrancó con tus datos</h1>
        </div>
        <div className="flex flex-col gap-3 rounded-[22px] p-[18px]" style={{ background: 'var(--card-lime)', color: 'var(--lime-text)' }}>
          <span className="text-[13px] font-semibold">Patrimonio neto</span>
          <span className="text-[34px] font-bold leading-none" style={{ fontFamily: DISPLAY }}>{fmt(patrimonio)}</span>
          <div className="grid grid-cols-3 gap-2 text-[12px]">
            <div className="flex flex-col gap-0.5"><span>Tienes</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-pos)' }}>{fmt(tienes)}</span></div>
            <div className="flex flex-col gap-0.5"><span>Te deben</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-pos)' }}>{fmt(teDeben)}</span></div>
            <div className="flex flex-col gap-0.5"><span>Debes</span><span className="text-[14px] font-bold" style={{ color: 'var(--lime-neg)' }}>{fmt(debes)}</span></div>
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
      </>
    )
    pie = <Boton onClick={onDone}>Entrar a CashFlow</Boton>
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-6 pb-6 pt-4">
        {paso >= 1 && paso <= 6 && (
          <div className="mb-5 flex flex-shrink-0 items-center gap-3.5">
            <button type="button" aria-label="Atrás" onClick={() => setPaso((p) => p - 1)} className="flex items-center justify-center rounded-[14px]" style={{ width: 44, height: 44, background: 'var(--card)' }}>
              <ChevronLeft size={20} color="var(--text-1)" />
            </button>
            <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${TOTAL_PASOS}, minmax(0, 1fr))` }}>
              {Array.from({ length: TOTAL_PASOS }, (_, i) => <div key={i} style={{ height: 4, borderRadius: 2, background: i < paso ? 'var(--lime)' : 'var(--line)' }} />)}
            </div>
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{paso}/{TOTAL_PASOS}</span>
          </div>
        )}
        {paso === 0 && (
          <div className="flex flex-shrink-0 items-center gap-2 pt-6">
            <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--lime)' }} />
            <span className="text-[18px] font-bold" style={{ fontFamily: DISPLAY, color: 'var(--text-1)' }}>CashFlow</span>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4">{contenido}</div>
        <div className="flex flex-shrink-0 flex-col pt-2">{pie}</div>
      </div>
    </div>
  )
}

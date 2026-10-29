// Flujo de caja: proyecta, día por día, cuánta plata líquida vas a tener en
// los próximos N días, a partir de lo que la app YA sabe (sin que el usuario
// configure nada nuevo):
//   - saldo de efectivo / débito / bancos / billeteras (NO ahorros, NO CDT,
//     NO tarjetas de crédito: eso es reserva, no plata para el día a día)
//   - ingresos y gastos fijos (con su frecuencia)
//   - cuotas de deudas que no están ya ligadas a un gasto fijo
//   - pago de las tarjetas de crédito en su día de pago (lo que se debe hoy)
//   - un gasto diario estimado con el promedio real de los últimos 30 días
//
// Es una función PURA (no toca la red ni React) para poder probarla fácil.
//
// Lo que NO hace a propósito (para no inventar): no suma "te deben" como
// ingreso seguro, no proyecta intereses de deudas, y los aportes a metas
// de ahorro no entran porque no tienen un día de pago definido.

import { parseLocalDate } from './date'
import type { Cuenta, IngresoFijo, GastoFijo, DeudaCredito, Transaccion, FrecuenciaFija } from './database.types'
import { pagosPrestaciones, type TipoPrestacion } from './prestaciones'

export type TipoEventoFlujo = 'ingreso' | 'gasto' | 'deuda' | 'tarjeta'

export interface EventoFlujo {
  fecha: string // YYYY-MM-DD (local)
  nombre: string
  monto: number // con signo: + entra, − sale
  tipo: TipoEventoFlujo
  saldoDespues: number // saldo al cierre de ese día
}

export interface DiaFlujo {
  fecha: string
  saldo: number
}

export interface ResultadoFlujo {
  saldoInicial: number
  saldoFinal: number
  serie: DiaFlujo[] // incluye hoy (día 0) hasta hoy + dias
  eventos: EventoFlujo[]
  gastoDiario: number // promedio estimado de gastos "chiquitos" por día
  reservas: number // ahorros + CDT: no cuentan como disponible
  minimo: DiaFlujo
  // `desde`: primer día en rojo · `fecha`/`falta`: el punto más bajo de ese tramo
  // (null si nunca baja de cero).
  hueco: { desde: string; fecha: string; falta: number; diasFaltan: number } | null
}

export interface EntradaFlujo {
  cuentas: Cuenta[]
  ingresosFijos: IngresoFijo[]
  gastosFijos: GastoFijo[]
  deudas: DeudaCredito[]
  transacciones: Transaccion[]
  convertirCOP: (monto: number, moneda: string) => number
  dias?: number
  hoy?: Date
  // Prima e intereses de cesantías (solo si el usuario confirmó que es
  // empleo formal — ver lib/prestaciones.ts). Montos estimados.
  prestaciones?: { salarioMensual: number; nombres: Record<TipoPrestacion, string> } | null
}

const MS_DIA = 24 * 60 * 60 * 1000

export function claveFecha(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function sumarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function diasDelMes(anio: number, mes0: number): number {
  return new Date(anio, mes0 + 1, 0).getDate()
}

// Día "dia" del mes, recortado al último día si el mes es más corto
// (un gasto del 31 en febrero cae el 28).
function fechaEnMes(anio: number, mes0: number, dia: number): Date {
  return new Date(anio, mes0, Math.min(Math.max(dia, 1), diasDelMes(anio, mes0)))
}

const PASO_MESES: Partial<Record<FrecuenciaFija, number>> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }
const PERIODO_DIAS: Record<FrecuenciaFija, number> = { quincenal: 15, mensual: 30, trimestral: 91, semestral: 182, anual: 365 }

// Todas las fechas en las que cae un ingreso/gasto fijo dentro de [desde, hasta].
export function ocurrenciasFijo(frecuencia: FrecuenciaFija, diaMes: number, creadoEn: string, desde: Date, hasta: Date): Date[] {
  const out: Date[] = []
  const anclaMes = parseLocalDate(creadoEn.slice(0, 10)).getMonth()
  const anclaAnio = parseLocalDate(creadoEn.slice(0, 10)).getFullYear()
  // Un mes de margen a cada lado para no perder fechas en los bordes.
  let y = desde.getFullYear(), m = desde.getMonth() - 1
  const finY = hasta.getFullYear(), finM = hasta.getMonth() + 1
  while (y < finY || (y === finY && m <= finM)) {
    const yy = y + Math.floor(m / 12)
    const mm = ((m % 12) + 12) % 12
    if (frecuencia === 'quincenal') {
      // Cada 15 días: el día configurado y su "pareja" (el 30 → 30 y 15;
      // el 10 → 10 y 25). En meses cortos el día se recorta al último.
      const d2 = diaMes <= 15 ? diaMes + 15 : diaMes - 15
      out.push(fechaEnMes(yy, mm, diaMes), fechaEnMes(yy, mm, d2))
    } else {
      const paso = PASO_MESES[frecuencia] ?? 1
      const indice = (yy - anclaAnio) * 12 + (mm - anclaMes)
      if (indice % paso === 0) out.push(fechaEnMes(yy, mm, diaMes))
    }
    m++
    if (m > 11) { m = 0; y++ }
  }
  return out.filter((f) => f >= desde && f <= hasta).sort((a, b) => a.getTime() - b.getTime())
}

// ¿Ese gasto/ingreso fijo ya se registró cerca de esa fecha? Si sí, no lo
// contamos otra vez (ya salió de tu saldo, o ya entró).
function yaRegistrado(txs: Transaccion[], campo: 'gasto_fijo_id' | 'ingreso_fijo_id', id: string, fecha: Date, frecuencia: FrecuenciaFija): boolean {
  const tolerancia = Math.floor(PERIODO_DIAS[frecuencia] / 2)
  return txs.some((t) => {
    if (t[campo] !== id) return false
    const dif = Math.abs(parseLocalDate(t.fecha).getTime() - fecha.getTime()) / MS_DIA
    return dif <= tolerancia
  })
}

// Promedio diario de gastos "del día a día": últimos 30 días, sin lo que ya
// es un gasto fijo, y descartando compras gigantes (un televisor no es tu
// ritmo normal) con la regla de valores atípicos de Tukey (Q3 + 3×IQR).
export function gastoDiarioEstimado(txs: Transaccion[], hoy: Date): number {
  const desde = sumarDias(hoy, -30)
  const egresos = txs.filter((t) => {
    if (t.tipo !== 'egreso' || t.gasto_fijo_id) return false
    const f = parseLocalDate(t.fecha)
    return f >= desde && f <= hoy
  })
  if (egresos.length < 3) return 0
  const montos = egresos.map((t) => t.monto + (t.monto_4x1000 || 0)).sort((a, b) => a - b)
  const q = (p: number) => montos[Math.min(montos.length - 1, Math.floor(p * (montos.length - 1)))]
  const q1 = q(0.25), q3 = q(0.75)
  const tope = q3 + 3 * (q3 - q1)
  const normales = egresos.filter((t) => t.monto + (t.monto_4x1000 || 0) <= tope)
  if (normales.length === 0) return 0
  const total = normales.reduce((s, t) => s + t.monto + (t.monto_4x1000 || 0), 0)
  // Si el historial es corto (usuario nuevo, o Pro con solo los últimos 50
  // movimientos), se divide por los días que realmente cubre.
  const primero = Math.min(...egresos.map((t) => parseLocalDate(t.fecha).getTime()))
  const diasCubiertos = Math.min(30, Math.max(7, Math.round((hoy.getTime() - primero) / MS_DIA) + 1))
  return Math.round(total / diasCubiertos)
}

const TIPOS_LIQUIDOS = new Set(['efectivo', 'billetera_digital', 'cuenta_bancaria', 'monedero', 'tarjeta_debito'])

export function proyectarFlujo(e: EntradaFlujo): ResultadoFlujo {
  const dias = e.dias ?? 30
  const hoy = inicioDelDia(e.hoy ?? new Date())
  const fin = sumarDias(hoy, dias)

  // ---- Saldo inicial: solo lo que se puede gastar hoy ----
  const activas = e.cuentas.filter((c) => c.activa !== false && !c.congelada)
  const liquidas = activas.filter((c) => TIPOS_LIQUIDOS.has(c.tipo) && !c.es_ahorro)
  const saldoInicial = liquidas.reduce((s, c) => s + e.convertirCOP(c.saldo, c.moneda), 0)
  const reservas = activas
    .filter((c) => c.tipo === 'cdt' || (c.es_ahorro && c.tipo !== 'tarjeta_credito'))
    .reduce((s, c) => s + e.convertirCOP(c.saldo, c.moneda), 0)

  // ---- Eventos con fecha ----
  type Ev = { fecha: Date; nombre: string; monto: number; tipo: TipoEventoFlujo }
  const evs: Ev[] = []

  for (const ing of e.ingresosFijos.filter((i) => i.activo)) {
    for (const f of ocurrenciasFijo(ing.frecuencia, ing.dia_mes, ing.created_at, hoy, fin)) {
      if (yaRegistrado(e.transacciones, 'ingreso_fijo_id', ing.id, f, ing.frecuencia)) continue
      evs.push({ fecha: f, nombre: ing.nombre, monto: ing.monto, tipo: 'ingreso' })
    }
  }

  for (const g of e.gastosFijos.filter((x) => x.activo)) {
    for (const f of ocurrenciasFijo(g.frecuencia, g.dia_mes, g.created_at, hoy, fin)) {
      if (yaRegistrado(e.transacciones, 'gasto_fijo_id', g.id, f, g.frecuencia)) continue
      evs.push({ fecha: f, nombre: g.nombre, monto: -g.monto, tipo: 'gasto' })
    }
  }

  // Deudas: si ya están ligadas a un gasto fijo, ese gasto fijo ya las cuenta.
  for (const d of e.deudas) {
    if (d.estado !== 'activa' || d.tipo !== 'deuda' || d.gasto_fijo_id) continue
    let restante = d.capital - d.capital_pagado
    if (restante <= 0) continue
    if (d.cuota_mensual && d.cuota_mensual > 0) {
      const diaCuota = parseLocalDate(d.fecha_inicio).getDate()
      const limite = d.fecha_limite ? parseLocalDate(d.fecha_limite) : null
      // Las cuotas siguen el día en que arrancó la deuda, cada mes.
      for (const f of ocurrenciasFijo('mensual', diaCuota, d.fecha_inicio, hoy, fin)) {
        if (limite && f > limite) break
        if (restante <= 0) break
        const cuota = Math.min(d.cuota_mensual, restante)
        evs.push({ fecha: f, nombre: d.nombre, monto: -cuota, tipo: 'deuda' })
        restante -= cuota
      }
    } else if (d.fecha_limite) {
      const lim = parseLocalDate(d.fecha_limite)
      if (lim >= hoy && lim <= fin) evs.push({ fecha: lim, nombre: d.nombre, monto: -restante, tipo: 'deuda' })
    }
  }

  if (e.prestaciones) {
    for (const p of pagosPrestaciones(e.prestaciones.salarioMensual, hoy, fin, e.transacciones)) {
      evs.push({ fecha: parseLocalDate(p.fecha), nombre: e.prestaciones.nombres[p.tipo], monto: p.monto, tipo: 'ingreso' })
    }
  }

  // Tarjetas de crédito: lo que se debe hoy se paga en el próximo día de pago.
  // (`saldo` en una tarjeta de crédito es el cupo DISPONIBLE, no lo gastado.)
  for (const c of activas.filter((x) => x.tipo === 'tarjeta_credito' && x.dia_pago)) {
    const usado = Math.max(0, (c.cupo_total ?? 0) - c.saldo)
    if (usado <= 0) continue
    let f = fechaEnMes(hoy.getFullYear(), hoy.getMonth(), c.dia_pago!)
    if (f < hoy) f = fechaEnMes(hoy.getFullYear(), hoy.getMonth() + 1, c.dia_pago!)
    if (f > fin) continue
    evs.push({ fecha: f, nombre: `Pago ${c.nombre}`, monto: -e.convertirCOP(usado, c.moneda), tipo: 'tarjeta' })
  }

  evs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  // ---- Serie día a día ----
  const gastoDiario = gastoDiarioEstimado(e.transacciones, hoy)
  const serie: DiaFlujo[] = []
  const eventos: EventoFlujo[] = []
  let saldo = saldoInicial
  for (let i = 0; i <= dias; i++) {
    const dia = sumarDias(hoy, i)
    const clave = claveFecha(dia)
    if (i > 0) saldo -= gastoDiario
    for (const ev of evs.filter((x) => claveFecha(x.fecha) === clave)) {
      saldo += ev.monto
      eventos.push({ fecha: clave, nombre: ev.nombre, monto: ev.monto, tipo: ev.tipo, saldoDespues: Math.round(saldo) })
    }
    serie.push({ fecha: clave, saldo: Math.round(saldo) })
  }

  const minimo = serie.reduce((m, d) => (d.saldo < m.saldo ? d : m), serie[0])
  const primerNegativo = serie.findIndex((d) => d.saldo < 0)
  let hueco: ResultadoFlujo['hueco'] = null
  if (primerNegativo >= 0) {
    // Se avisa el punto más bajo de ese tramo en rojo (cuánta plata falta de verdad).
    let fin2 = primerNegativo
    while (fin2 + 1 < serie.length && serie[fin2 + 1].saldo < 0) fin2++
    const tramo = serie.slice(primerNegativo, fin2 + 1)
    const peor = tramo.reduce((m, d) => (d.saldo < m.saldo ? d : m), tramo[0])
    hueco = { desde: serie[primerNegativo].fecha, fecha: peor.fecha, falta: Math.abs(peor.saldo), diasFaltan: primerNegativo }
  }

  return { saldoInicial: Math.round(saldoInicial), saldoFinal: serie[serie.length - 1].saldo, serie, eventos, gastoDiario, reservas: Math.round(reservas), minimo, hueco }
}

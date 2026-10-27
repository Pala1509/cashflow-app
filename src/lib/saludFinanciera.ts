// Salud financiera: un puntaje de 0 a 100 que resume cómo estás hoy, con
// lo que la app YA sabe (sin preguntar nada). Es una función pura.
//
// Cinco piezas (100 puntos en total):
//   - Colchón (30): cuántos meses de gastos cubren tus ahorros y CDT. Meta: 6 meses.
//   - Ahorro del mes (25): qué parte de tus ingresos NO te gastas. Meta: 20 %.
//   - Deudas (25): cuánto de tu ingreso se va en cuotas (sano ≤ 20 %, preocupante
//     ≥ 50 %) y qué tanto de tu cupo de tarjetas usas (sano ≤ 30 %, ≥ 80 % malo).
//   - Flujo de caja (10): si tu plata alcanza los próximos 30 días.
//   - Gastos hormiga (10): cuánto de tu ingreso se va en compras chiquitas repetidas.
//
// Si una pieza no se puede calcular (por ejemplo, no hay ingresos para medir
// el ahorro), no cuenta: el puntaje se reescala con las que sí. Si no hay ni
// ingresos, no se inventa un puntaje.
//
// Es una guía educativa, no asesoría financiera.

import { parseLocalDate } from './date'
import type { Cuenta, IngresoFijo, GastoFijo, DeudaCredito, Transaccion, FrecuenciaFija } from './database.types'

export type ClaveComponente = 'colchon' | 'ahorro' | 'deuda' | 'flujo' | 'hormiga'
export type NivelSalud = 'bajo' | 'medio' | 'bien' | 'excelente'

export interface ComponenteSalud {
  clave: ClaveComponente
  puntos: number // redondeado
  maximo: number
  /** Dato legible para mostrar (meses, %, etc.) — null si no se pudo calcular. */
  valor: number | null
}

export interface ResultadoSalud {
  puntaje: number | null
  nivel: NivelSalud | null
  componentes: ComponenteSalud[] // solo los que se pudieron calcular
  /** La pieza donde más puntos se están perdiendo (donde más puedes mejorar). */
  palanca: ClaveComponente | null
  ingresoMensual: number
  gastoMensual: number
}

export interface EntradaSalud {
  cuentas: Cuenta[]
  ingresosFijos: IngresoFijo[]
  gastosFijos: GastoFijo[]
  deudas: DeudaCredito[]
  transacciones: Transaccion[]
  convertirCOP: (monto: number, moneda: string) => number
  /** Del motor de flujo de caja a 30 días: null = no hay hueco; número = lo que falta. */
  huecoFalta: number | null
  /** ¿El flujo de caja tiene base (fijos, deudas o tarjetas) para ser confiable? */
  flujoConBase: boolean
  /** Total de gastos hormiga de los últimos 15 días. */
  hormigaQuincena: number
  hoy?: Date
}

const VECES_POR_MES: Record<FrecuenciaFija, number> = { quincenal: 2, mensual: 1, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }
const MS_DIA = 24 * 60 * 60 * 1000

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))

export function mensualizar(monto: number, frecuencia: FrecuenciaFija): number {
  return monto * (VECES_POR_MES[frecuencia] ?? 1)
}

export function nivelDe(puntaje: number): NivelSalud {
  if (puntaje >= 80) return 'excelente'
  if (puntaje >= 60) return 'bien'
  if (puntaje >= 40) return 'medio'
  return 'bajo'
}

export function calcularSalud(e: EntradaSalud): ResultadoSalud {
  const hoy = new Date((e.hoy ?? new Date()).getFullYear(), (e.hoy ?? new Date()).getMonth(), (e.hoy ?? new Date()).getDate())
  const desde = new Date(hoy.getTime() - 30 * MS_DIA)

  // Últimos 30 días reales (transferencias entre tus cuentas no cuentan).
  const ult30 = e.transacciones.filter((t) => {
    if (t.tipo === 'transferencia') return false
    const f = parseLocalDate(t.fecha)
    return f >= desde && f <= hoy
  })
  const ingresos30 = ult30.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egresos30 = ult30.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + (t.monto_4x1000 || 0), 0)

  const ingresoFijoMensual = e.ingresosFijos.filter((i) => i.activo).reduce((s, i) => s + mensualizar(i.monto, i.frecuencia), 0)
  const gastoFijoMensual = e.gastosFijos.filter((g) => g.activo).reduce((s, g) => s + mensualizar(g.monto, g.frecuencia), 0)

  // Ingreso mensual de referencia: lo que dices que ganas; si no lo has
  // configurado, lo que realmente entró en 30 días.
  const ingresoMensual = ingresoFijoMensual > 0 ? ingresoFijoMensual : ingresos30
  // Gasto mensual de referencia: el mayor entre tus gastos fijos y lo que
  // realmente saliste a gastar (para no inflar el colchón).
  const gastoMensual = Math.max(gastoFijoMensual, egresos30)

  const activas = e.cuentas.filter((c) => c.activa !== false && !c.congelada)
  const componentes: ComponenteSalud[] = []

  // ---- Colchón (30) ----
  const reservas = activas
    .filter((c) => c.tipo === 'cdt' || (c.es_ahorro && c.tipo !== 'tarjeta_credito'))
    .reduce((s, c) => s + e.convertirCOP(c.saldo, c.moneda), 0)
  if (gastoMensual > 0) {
    const meses = reservas / gastoMensual
    componentes.push({ clave: 'colchon', puntos: 30 * clamp(meses / 6), maximo: 30, valor: meses })
  }

  // ---- Ahorro del mes (25) ----
  if (ingresoMensual > 0) {
    // Con ingresos reales en 30 días se usa lo real; si no, el ingreso fijo menos lo gastado.
    const base = ingresos30 > 0 ? ingresos30 : ingresoMensual
    const tasa = (base - egresos30) / base
    componentes.push({ clave: 'ahorro', puntos: 25 * clamp(tasa / 0.2), maximo: 25, valor: tasa })
  }

  // ---- Deudas (25) ----
  if (ingresoMensual > 0) {
    const cuotas = e.deudas
      .filter((d) => d.estado === 'activa' && d.tipo === 'deuda' && (d.cuota_mensual ?? 0) > 0)
      .reduce((s, d) => s + (d.cuota_mensual ?? 0), 0)
    const tarjetas = activas.filter((c) => c.tipo === 'tarjeta_credito' && (c.cupo_total ?? 0) > 0)
    const cupo = tarjetas.reduce((s, c) => s + e.convertirCOP(c.cupo_total ?? 0, c.moneda), 0)
    const usado = tarjetas.reduce((s, c) => s + e.convertirCOP(Math.max(0, (c.cupo_total ?? 0) - c.saldo), c.moneda), 0)

    const factores: number[] = []
    const ratio = cuotas / ingresoMensual
    if (cuotas > 0) factores.push(clamp((0.5 - ratio) / 0.3))
    const util = cupo > 0 ? usado / cupo : 0
    if (cupo > 0 && usado > 0) factores.push(clamp((0.8 - util) / 0.5))
    const factor = factores.length > 0 ? factores.reduce((a, b) => a + b, 0) / factores.length : 1
    // `valor`: el porcentaje del ingreso que se va en cuotas (lo más fácil de entender).
    componentes.push({ clave: 'deuda', puntos: 25 * factor, maximo: 25, valor: ratio })
  }

  // ---- Flujo de caja (10) ----
  if (e.flujoConBase) {
    const factor = e.huecoFalta === null ? 1 : ingresoMensual > 0 ? clamp(1 - e.huecoFalta / (0.2 * ingresoMensual)) : 0
    componentes.push({ clave: 'flujo', puntos: 10 * factor, maximo: 10, valor: e.huecoFalta })
  }

  // ---- Gastos hormiga (10) ----
  if (ingresoMensual > 0) {
    const share = (e.hormigaQuincena * 2) / ingresoMensual
    componentes.push({ clave: 'hormiga', puntos: 10 * clamp((0.1 - share) / 0.07), maximo: 10, valor: share })
  }

  const maxTotal = componentes.reduce((s, c) => s + c.maximo, 0)
  // Sin ingresos no hay forma honesta de medir ahorro ni deudas: no se da puntaje.
  if (ingresoMensual <= 0 || maxTotal <= 0) {
    return { puntaje: null, nivel: null, componentes: componentes.map((c) => ({ ...c, puntos: Math.round(c.puntos) })), palanca: null, ingresoMensual, gastoMensual }
  }

  const puntaje = Math.round((componentes.reduce((s, c) => s + c.puntos, 0) / maxTotal) * 100)
  const palanca = componentes.reduce((mejor, c) => ((c.maximo - c.puntos) > (mejor.maximo - mejor.puntos) ? c : mejor), componentes[0])
  const hayQueMejorar = palanca.maximo - palanca.puntos >= 1

  return {
    puntaje,
    nivel: nivelDe(puntaje),
    componentes: componentes.map((c) => ({ ...c, puntos: Math.round(c.puntos) })),
    palanca: hayQueMejorar ? palanca.clave : null,
    ingresoMensual,
    gastoMensual,
  }
}

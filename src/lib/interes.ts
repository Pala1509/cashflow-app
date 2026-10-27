// Matemática de tasa EA (Efectiva Anual) — el número que anuncian los
// bancos ("Nu te da 12.5% EA"). Todo se deriva de ahí: la tasa diaria, la
// proyección de un bolsillo, y cuánto recibes al final de un CDT.

// Tasa diaria equivalente a una tasa EA — fórmula financiera estándar,
// no una aproximación (dividir EA/365 sería incorrecto).
export function tasaDiaria(ea: number): number {
  return Math.pow(1 + ea / 100, 1 / 365) - 1
}

// Cuánto ganarías en `dias` si el saldo se queda quieto a esa tasa. Sirve
// tanto para la proyección de un bolsillo como para validar el cálculo
// de un CDT.
export function proyeccionInteres(saldo: number, ea: number, dias: number): number {
  if (ea <= 0 || saldo <= 0) return 0
  return saldo * (Math.pow(1 + tasaDiaria(ea), dias) - 1)
}

// Capital + interés que recibes al vencimiento de un CDT — mismo cálculo
// de arriba, solo que se suele mostrar como el monto total, no como la
// ganancia sola.
export function montoFinalCDT(capital: number, ea: number, plazoDias: number): number {
  return capital + proyeccionInteres(capital, ea, plazoDias)
}

// Días que faltan para el vencimiento (puede dar negativo si ya venció).
export function diasParaVencer(fechaApertura: string, plazoDias: number): number {
  const apertura = new Date(fechaApertura + 'T00:00:00')
  const vence = new Date(apertura)
  vence.setDate(vence.getDate() + plazoDias)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((vence.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000))
}

export function fechaVencimiento(fechaApertura: string, plazoDias: number): Date {
  const apertura = new Date(fechaApertura + 'T00:00:00')
  const vence = new Date(apertura)
  vence.setDate(vence.getDate() + plazoDias)
  return vence
}

// ── Simulador "¿Qué pasaría si...?" ──────────────────────────────────
// Cuántos meses le faltan a una deuda para llegar a $0, dado un pago
// mensual fijo. Es una aproximación razonable para el simulador, no un
// amortizador contable exacto: convierte la tasa del periodo declarado
// (periodo_interes: Quincenal/Mensual/Trimestral/Semestral/Anual) a un
// equivalente mensual simple (no compuesto) para poder proyectar mes a
// mes con una sola tasa. Devuelve null si el pago ni siquiera alcanza a
// cubrir el interés (nunca se pagaría) o si se pasa de maxMeses.
const VECES_POR_MES: Record<string, number> = {
  Quincenal: 2, Mensual: 1, Trimestral: 1 / 3, Semestral: 1 / 6, Anual: 1 / 12,
}

export function mesesParaPagarDeuda(
  capitalPendiente: number,
  capitalOriginal: number,
  tipoInteres: 'sobre_saldo' | 'fijo_capital' | 'sin_interes',
  tasaInteres: number,
  periodoInteres: string,
  pagoMensual: number,
  maxMeses = 600
): number | null {
  if (capitalPendiente <= 0) return 0
  if (pagoMensual <= 0) return null
  const vecesPorMes = VECES_POR_MES[periodoInteres] ?? 1
  let pendiente = capitalPendiente
  for (let mes = 1; mes <= maxMeses; mes++) {
    const interesMes = tipoInteres === 'sin_interes' ? 0
      : tipoInteres === 'fijo_capital' ? capitalOriginal * (tasaInteres / 100) * vecesPorMes
      : pendiente * (tasaInteres / 100) * vecesPorMes
    const aCapital = pagoMensual - interesMes
    if (aCapital <= 0) return null
    pendiente -= aCapital
    if (pendiente <= 0) return mes
  }
  return null
}

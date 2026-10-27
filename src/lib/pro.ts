import type { Cuenta } from './database.types'

export const FREE_LIMITS = {
  maxEfectivo: 1,
  maxCuentasDebito: 2,
  maxTarjetasDebito: 2,
  maxAhorros: 2,
  maxTarjetasCredito: 2,
  maxDeudas: 3,
  maxCuentasPorCobrar: 3,
  maxMetasActivas: 1,
  maxIngresosFijos: 2,
  maxGastosFijos: 3,
}

// A qué "sección" de Cuentas pertenece un tipo — el mismo agrupamiento
// que ya usa Cuentas.tsx para mostrar las secciones (Efectivo, Cuentas
// débito, Tarjetas débito, Ahorros, Tarjetas de crédito). El orden de
// los "if" importa: ahorro manda sobre todo lo demás excepto tarjeta de
// crédito (que nunca se puede marcar como ahorro).
export function seccionCuenta(tipo: string, esAhorro: boolean): keyof typeof FREE_LIMITS | 'cdt' | null {
  if (tipo === 'cdt') return 'cdt' // Pro-only entero, no tiene número de límite — se bloquea aparte
  if (tipo === 'tarjeta_credito') return 'maxTarjetasCredito'
  if (esAhorro) return 'maxAhorros'
  if (tipo === 'tarjeta_debito') return 'maxTarjetasDebito'
  if (tipo === 'efectivo' || tipo === 'monedero') return 'maxEfectivo'
  if (tipo === 'billetera_digital' || tipo === 'cuenta_bancaria') return 'maxCuentasDebito'
  return null
}

// Cuenta cuántas cuentas YA existen en esa misma sección — para comparar
// contra el límite de FREE_LIMITS antes de dejar crear una más.
export function contarSeccion(cuentas: Cuenta[], seccion: keyof typeof FREE_LIMITS | 'cdt' | null): number {
  if (!seccion || seccion === 'cdt') return 0
  return cuentas.filter((c) => seccionCuenta(c.tipo, c.es_ahorro) === seccion).length
}

export const SECCION_LABEL: Record<string, string> = {
  maxEfectivo: 'cuenta de Efectivo',
  maxCuentasDebito: 'cuentas débito',
  maxTarjetasDebito: 'tarjetas débito',
  maxAhorros: 'cuentas de Ahorros',
  maxTarjetasCredito: 'tarjetas de crédito',
}

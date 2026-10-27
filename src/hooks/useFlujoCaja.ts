import { useMemo } from 'react'
import { useFinanzas } from './useFinanzas'
import { useTasasCambio } from './useTasasCambio'
import { proyectarFlujo } from '../lib/flujoCaja'

// Envuelve el motor de proyección con los datos reales del usuario. Se
// recalcula solo cuando cambian cuentas, fijos, deudas o movimientos.
export function useFlujoCaja(dias = 30) {
  const { cuentas, ingresosFijos, gastosFijos, deudas, transacciones, loading, esPro } = useFinanzas()
  const { convertirCOP } = useTasasCambio()

  const resultado = useMemo(
    () => proyectarFlujo({ cuentas, ingresosFijos, gastosFijos, deudas, transacciones, convertirCOP, dias }),
    [cuentas, ingresosFijos, gastosFijos, deudas, transacciones, convertirCOP, dias],
  )

  // Sin ingresos/gastos fijos, deudas ni tarjetas con pago, la proyección
  // solo sería "tu gasto diario" — poco útil. Lo usamos para sugerir
  // configurarlos en vez de mostrar una línea que baja sin explicación.
  const tieneBase =
    ingresosFijos.some((i) => i.activo) ||
    gastosFijos.some((g) => g.activo) ||
    deudas.some((d) => d.estado === 'activa' && d.tipo === 'deuda') ||
    cuentas.some((c) => c.tipo === 'tarjeta_credito' && c.dia_pago)

  return { resultado, loading, esPro, tieneBase }
}

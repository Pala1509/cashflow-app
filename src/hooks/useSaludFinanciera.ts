import { useMemo } from 'react'
import { useFinanzas } from './useFinanzas'
import { useTasasCambio } from './useTasasCambio'
import { useFlujoCaja } from './useFlujoCaja'
import { calcularSalud } from '../lib/saludFinanciera'
import { calcularGastosHormigaProducto } from '../lib/gastosHormiga'

// Puntaje de salud financiera con los datos reales del usuario. Reutiliza el
// motor de flujo de caja (para saber si se viene un hueco) y el detector de
// gastos hormiga, así no se calcula nada dos veces con reglas distintas.
export function useSaludFinanciera() {
  const { cuentas, ingresosFijos, gastosFijos, deudas, transacciones, loading } = useFinanzas()
  const { convertirCOP } = useTasasCambio()
  const { resultado: flujo, tieneBase } = useFlujoCaja(30)

  const salud = useMemo(
    () =>
      calcularSalud({
        cuentas, ingresosFijos, gastosFijos, deudas, transacciones, convertirCOP,
        huecoFalta: flujo.hueco ? flujo.hueco.falta : null,
        flujoConBase: tieneBase,
        hormigaQuincena: calcularGastosHormigaProducto(transacciones).total,
      }),
    [cuentas, ingresosFijos, gastosFijos, deudas, transacciones, convertirCOP, flujo, tieneBase],
  )

  return { salud, loading }
}

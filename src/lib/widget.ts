import { registerPlugin } from '@capacitor/core'

interface CashFlowWidgetPlugin {
  updateBalance(options: { balanceText: string }): Promise<void>
  updateRecientes(options: { lineas: string }): Promise<void>
  updateResumenMes(options: { ingresos: string; egresos: string }): Promise<void>
  getLaunchAction(): Promise<{ action: 'ingreso' | 'egreso' | 'none' }>
  cerrarVentanaRapida(): Promise<void>
}

// El plugin nativo (Java) solo existe en Android — en el navegador esto
// hace nada, silenciosamente, para no romper `npm run dev`.
const CashFlowWidget = registerPlugin<CashFlowWidgetPlugin>('CashFlowWidget')

export async function actualizarWidget(balanceTotal: number) {
  try {
    const texto = '$' + Math.round(balanceTotal).toLocaleString('es-CO')
    await CashFlowWidget.updateBalance({ balanceText: texto })
  } catch {
    // No pasa nada si falla (navegador, plugin no disponible, etc.)
  }
}

// Hasta 4 líneas ya formateadas ("Mercado · -$45.000") para el widget
// grande — se arma acá, no en Java, porque ahí ya tenemos fmt() y las
// categorías/cuentas a mano. Ver useNotificacionesEngine.ts para quién
// llama esto y cuándo.
export async function actualizarWidgetRecientes(lineas: string[]) {
  try {
    await CashFlowWidget.updateRecientes({ lineas: lineas.join('\n') })
  } catch {
    // No pasa nada si falla
  }
}

// Ingresos y egresos del mes, ya formateados ("$450.000") — para la
// franja de resumen del widget grande, debajo de los botones rápidos.
export async function actualizarWidgetResumenMes(ingresos: string, egresos: string) {
  try {
    await CashFlowWidget.updateResumenMes({ ingresos, egresos })
  } catch {
    // No pasa nada si falla
  }
}

// Pregunta si la app (o la ventanita rápida) se abrió por un botón del
// widget — 'ingreso' | 'egreso' | 'none'.
export async function leerAccionWidget(): Promise<'ingreso' | 'egreso' | 'none'> {
  try {
    const { action } = await CashFlowWidget.getLaunchAction()
    return action
  } catch {
    return 'none'
  }
}

// Solo tiene efecto real dentro de QuickAddActivity (la ventanita
// flotante) — cierra esa Activity apenas se guarda el movimiento, sin
// pasar por ninguna navegación de la app completa. En cualquier otro
// contexto (navegador, MainActivity) esto no hace nada.
export async function cerrarVentanaRapida() {
  try {
    await CashFlowWidget.cerrarVentanaRapida()
  } catch {
    // No pasa nada si falla
  }
}

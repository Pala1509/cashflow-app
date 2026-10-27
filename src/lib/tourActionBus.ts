// Puente para el tour "interactivo": a diferencia de TOUR_STEPS normales
// (que solo señalan algo y avanzan con el botón "Siguiente"), un paso de
// tipo acción espera a que el usuario haga de VERDAD lo que se le pide
// (elegir un tipo de cuenta, guardar el formulario...) antes de avanzar.
// Las pantallas reales (CuentaNueva.tsx, etc.) llaman a signalTourAction()
// en el momento justo — si el tour no está corriendo, esto no hace nada,
// así que es seguro dejarlo en el código de esas pantallas siempre.

let listener: ((accion: string) => void) | null = null

export function _registerTourActionListener(fn: ((accion: string) => void) | null) {
  listener = fn
}

export function signalTourAction(accion: string) {
  listener?.(accion)
}

let disparar: (() => void) | null = null

export function _registerTourTrigger(fn: (() => void) | null) {
  disparar = fn
}

export function iniciarTour() {
  disparar?.()
}

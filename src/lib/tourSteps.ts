export interface TourStep {
  ruta: string
  target: string // debe coincidir con un data-tour="..." en algún lado de esa ruta
  titulo: string
  texto: string
  posicion: 'arriba' | 'abajo'
  // Si está presente, este paso NO avanza con el botón "Siguiente" — el
  // tour espera a que el usuario haga de verdad la acción (tocar el
  // elemento resaltado, que dispara una navegación real o una señal
  // desde la pantalla). Así el tour deja de ser solo "mira, esto existe"
  // y pasa a ser "hazlo tú mismo, guiado".
  //
  // Para pasos de tipo 'evento': `creaDatos` marca si la acción real de
  // ese paso escribe algo de verdad en la base de datos (ej. Guardar
  // crea una cuenta real) — para esos, el botón "Siguiente" NO dispara
  // la acción por código, solo avanza el número, para no terminar
  // creando datos reales solo por querer avanzar el tour. Para los que
  // no crean nada (ej. solo elegir un tipo, que es estado local nomás),
  // "Siguiente" sí puede disparar la acción real sin ningún riesgo.
  accion?: { tipo: 'ruta'; espera: string } | { tipo: 'evento'; espera: string; creaDatos?: boolean }
}

export const TOUR_STEPS: TourStep[] = [
  {
    ruta: '/inicio',
    target: 'balance-total',
    titulo: 'Tu balance, siempre arriba',
    texto: 'Suma todo lo que tienes en efectivo y cuentas — no incluye tarjetas de crédito ni deudas.',
    posicion: 'abajo',
  },
  {
    ruta: '/inicio',
    target: 'tab-cuentas',
    titulo: 'Vamos a crear tu primera cuenta',
    texto: 'Toca aquí para ir a Cuentas — de ahí en adelante te voy guiando paso a paso.',
    posicion: 'arriba',
    accion: { tipo: 'ruta', espera: '/cuentas' },
  },
  {
    ruta: '/cuentas',
    target: 'cuentas-agregar',
    titulo: 'Efectivo, cuentas débito, tarjetas, ahorros...',
    texto: 'Toca "Agregar" para crear la primera — puede ser cualquier cosa que sea tuya de verdad.',
    posicion: 'abajo',
    accion: { tipo: 'ruta', espera: '/cuentas/nueva' },
  },
  {
    ruta: '/cuentas/nueva',
    target: 'cn-tipo-efectivo',
    titulo: 'Elige un tipo',
    texto: 'Efectivo es la más sencilla para empezar — solo dile cuánto tienes ahí.',
    posicion: 'abajo',
    accion: { tipo: 'evento', espera: 'cuenta-tipo-elegido' },
  },
  {
    ruta: '/cuentas/nueva',
    target: 'cn-guardar',
    titulo: 'Ponle un nombre y guarda',
    texto: 'Escríbele un nombre (ej: "Efectivo") y toca Guardar — así de fácil.',
    posicion: 'arriba',
    accion: { tipo: 'evento', espera: 'cuenta-guardada', creaDatos: true },
  },
  {
    ruta: '/cuentas',
    target: 'tab-deudas',
    titulo: '¡Ya tienes tu primera cuenta!',
    texto: 'Deudas funciona igual — tarjetas de crédito, préstamos y cuentas por cobrar, nunca mezcladas con Cuentas.',
    posicion: 'arriba',
  },
  {
    ruta: '/inicio',
    target: 'fab-agregar',
    titulo: 'Registra en segundos',
    texto: 'Este botón está siempre a la mano, sin importar en qué pantalla estés.',
    posicion: 'arriba',
  },
  {
    ruta: '/balance',
    target: 'balance-donut',
    titulo: 'La estructura de tu plata fija',
    texto: 'Cuánto de tus ingresos fijos se va en gastos fijos, cuánto en ahorro, y cuánto te queda libre.',
    posicion: 'abajo',
  },
  {
    ruta: '/resumen',
    target: 'control-total',
    titulo: 'Proyecta cómo vas a terminar el mes',
    texto: 'Antes de que termine, no después — compara con el mes anterior y detecta gastos que se repiten.',
    posicion: 'abajo',
  },
]

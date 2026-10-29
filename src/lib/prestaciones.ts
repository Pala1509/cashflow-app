// Prima y cesantías (Colombia): la app las mete sola en el flujo de caja y
// avisa antes de que lleguen, a partir del salario que el usuario ya tiene
// como ingreso fijo. No hay que configurar nada: CashFlow detecta el
// salario y solo pregunta UNA vez, con un toque, si es empleo formal (los
// independientes no reciben prima).
//
// Reglas de ley que se usan (Código Sustantivo del Trabajo):
//   - Prima de servicios: 30 días de salario al año, en dos pagos: la
//     mitad a más tardar el 30 de junio y la otra mitad a más tardar el
//     20 de diciembre.
//   - Cesantías: un mes de salario por año, pero NO llegan a la mano: el
//     empleador las consigna al fondo a más tardar el 14 de febrero.
//   - Intereses de cesantías: 12 % anual sobre las cesantías, pagados
//     directamente al trabajador a más tardar el 31 de enero.
// Los montos son ESTIMADOS (año completo trabajado, sin auxilio de
// transporte ni horas extra) y así se le dice al usuario.
//
// Función PURA (sin red ni React) para poder probarla fácil.

import type { IngresoFijo, Transaccion, Categoria } from './database.types'

export type TipoPrestacion = 'prima_junio' | 'prima_diciembre' | 'intereses_cesantias'

export interface PagoPrestacion {
  tipo: TipoPrestacion
  fecha: string // YYYY-MM-DD, la fecha límite legal
  monto: number // estimado, en COP
}

const PALABRAS_SALARIO = /\b(salario|sueldo|nomina|quincena|pago (del )?trabajo|mi trabajo|trabajo)\b/

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function clave(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Salario mensual a partir de los ingresos fijos: el ingreso fijo mensual o
// quincenal cuyo nombre o categoría suena a salario. Si hay varios, el mayor.
// Devuelve null si no hay nada que parezca un salario.
export function detectarSalarioMensual(ingresosFijos: IngresoFijo[], categorias: Categoria[] = []): number | null {
  let mejor: number | null = null
  for (const i of ingresosFijos) {
    if (!i.activo) continue
    if (i.frecuencia !== 'mensual' && i.frecuencia !== 'quincenal') continue
    const cat = i.categoria_id ? categorias.find((c) => c.id === i.categoria_id) : undefined
    const texto = normalizar(`${i.nombre} ${cat?.nombre ?? ''}`)
    if (!PALABRAS_SALARIO.test(texto)) continue
    const mensual = i.frecuencia === 'quincenal' ? i.monto * 2 : i.monto
    if (mensual > 0 && (mejor === null || mensual > mejor)) mejor = mensual
  }
  return mejor
}

const PALABRAS_PRIMA = /\bprima\b/
const PALABRAS_CESANTIAS = /\bcesantia/

// ¿Ya registró ese pago cerca de su fecha? (±40 días, porque muchas empresas
// pagan la prima a mitad de mes o antes). Si sí, no lo proyectamos otra vez.
function yaLlego(txs: Transaccion[], tipo: TipoPrestacion, fecha: Date): boolean {
  const re = tipo === 'intereses_cesantias' ? PALABRAS_CESANTIAS : PALABRAS_PRIMA
  return txs.some((t) => {
    if (t.tipo !== 'ingreso') return false
    const texto = normalizar(`${t.descripcion ?? ''} ${t.lugar ?? ''}`)
    if (!re.test(texto)) return false
    const [y, m, d] = t.fecha.split('-').map(Number)
    const dif = Math.abs(new Date(y, m - 1, d).getTime() - fecha.getTime()) / 86_400_000
    return dif <= 40
  })
}

// Pagos de prima e intereses de cesantías que caen entre `desde` y `hasta`
// (fechas locales), con su monto estimado.
export function pagosPrestaciones(salarioMensual: number, desde: Date, hasta: Date, txs: Transaccion[] = []): PagoPrestacion[] {
  const out: PagoPrestacion[] = []
  const media = Math.round(salarioMensual / 2)
  const intereses = Math.round(salarioMensual * 0.12)
  for (let y = desde.getFullYear(); y <= hasta.getFullYear(); y++) {
    const candidatos: { tipo: TipoPrestacion; fecha: Date; monto: number }[] = [
      { tipo: 'intereses_cesantias', fecha: new Date(y, 0, 31), monto: intereses },
      { tipo: 'prima_junio', fecha: new Date(y, 5, 30), monto: media },
      { tipo: 'prima_diciembre', fecha: new Date(y, 11, 20), monto: media },
    ]
    for (const c of candidatos) {
      if (c.fecha < desde || c.fecha > hasta) continue
      if (yaLlego(txs, c.tipo, c.fecha)) continue
      out.push({ tipo: c.tipo, fecha: clave(c.fecha.getFullYear(), c.fecha.getMonth(), c.fecha.getDate()), monto: c.monto })
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// El próximo pago (para la tarjeta de Inicio y la notificación).
export function proximoPagoPrestacion(salarioMensual: number, hoy: Date, txs: Transaccion[] = []): PagoPrestacion | null {
  const hasta = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate())
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return pagosPrestaciones(salarioMensual, inicio, hasta, txs)[0] ?? null
}

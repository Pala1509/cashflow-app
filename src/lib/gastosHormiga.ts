import { parseLocalDate } from './date'
import type { Transaccion } from './database.types'

export interface GastoHormigaProducto {
  /** Nombre del producto ya limpio y bonito para mostrar, ej "Monster" */
  nombre: string
  categoriaId: string | null
  cantidad: number
  total: number
  promedio: number
  ultimaFecha: string
}

export interface ResumenGastosHormiga {
  items: GastoHormigaProducto[]
  total: number
  /** Frase de regaño/consejo — cambia según lo que más se repite en los
   * últimos 15 días. Es null si no hay nada que valga la pena señalar. */
  consejo: string | null
}

const DIAS_VENTANA = 15

const STOPWORDS = new Set(['y', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'con', 'para', 'al'])

// Palabras que aparecen pegadas al nombre real del producto pero no lo
// cambian — tamaños, presentaciones, variantes de sabor genéricas. Sin
// esto, "Monster mango" y "Monster ultra" contarían como productos
// distintos, cuando en la práctica es el mismo hábito repitiéndose.
const PALABRAS_RELLENO = new Set([
  'energy', 'energia', 'ultra', 'zero', 'light', 'lite', 'original', 'clasica', 'clasico',
  'grande', 'mediano', 'mediana', 'pequeno', 'pequena', 'personal', 'familiar',
  'lata', 'botella', 'bolsa', 'paquete', 'sixpack', 'six', 'pack',
  'mango', 'citrus', 'manzana', 'uva', 'fresa', 'natural', 'sabor',
  'ml', 'lt', 'litro', 'litros', 'gr', 'grs', 'gramos', 'oz',
])

// Banco de alias — variantes de escritura o de presentación que deberían
// contar como "el mismo producto" aunque el texto no sea idéntico. Esto
// es lo que permite detectar el hábito real detrás de nombres distintos
// (marca + variante, con o sin espacio, mal escrito, etc.).
const ALIAS: Record<string, string> = {
  'monster energy': 'monster', 'monster ultra': 'monster', 'monster zero': 'monster',
  'vive cien': 'vive100', 'vive 100': 'vive100', 'vive100': 'vive100',
  'red bull': 'redbull', 'redbull energy': 'redbull',
  'speed max': 'speed', 'gatorade': 'gatorade', 'powerade': 'powerade',
  'coca cola': 'cocacola', 'coca-cola': 'cocacola', 'cocacola': 'cocacola', 'coca': 'cocacola',
  'pepsi cola': 'pepsi', 'postobon': 'postobon',
  'agua saborizada': 'agua saborizada', 'agua con gas': 'agua', 'agua sin gas': 'agua',
  'cafe americano': 'cafe', 'tinto': 'cafe',
  'cigarrillo': 'cigarrillos', 'cigarrillos': 'cigarrillos', 'cigarro': 'cigarrillos',
  'chicle': 'chicles', 'chicles': 'chicles',
  'papas fritas': 'papas', 'papitas': 'papas',
  'domicilio rappi': 'rappi', 'pedido rappi': 'rappi', 'rappi': 'rappi',
  'uber eats': 'uber eats', 'ubereats': 'uber eats',
}

// Limpia un "token" de descripción para poder comparar productos entre
// transacciones distintas aunque estén escritos un poco diferente:
// "Monster x2" y "monster" deben matchear igual.
function normalizar(raw: string): string {
  let s = raw.toLowerCase().trim()
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
  s = s.replace(/x\s*\d+/g, '') // "x2", "x 3"
  s = s.replace(/\d+/g, '') // números sueltos ("litro 1" -> "litro")
  s = s.replace(/[^a-z\s]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  // Banco de alias: si el texto completo (o contiene) una variante
  // conocida, usa directamente su forma canónica.
  for (const [variante, canon] of Object.entries(ALIAS)) {
    if (s === variante || s.includes(variante)) return canon
  }

  // Si no matcheó un alias completo, quita las palabras de relleno y
  // deja solo lo que probablemente sea el nombre real del producto.
  const palabras = s.split(' ').filter((w) => w.length > 0 && !PALABRAS_RELLENO.has(w))
  return palabras.join(' ').trim() || s
}

// Una descripción puede traer varios productos en un solo recibo, ej:
// "Panzzeroti, salchichoncitos x3, gaseosita y avena caleña". Se separa
// por los delimitadores más comunes de una lista escrita a mano.
// Cada "parte" de la descripción puede traer su propia cantidad ("Monster
// energy x2" son 2 unidades, no 1) — antes esto se ignoraba por completo
// y una compra de 2-3 en el mismo recibo solo contaba como una sola
// ocurrencia, así que nunca llegaba al umbral de 3 aunque el hábito real
// fuera mucho más frecuente.
function extraerProductos(descripcion: string): { normalizado: string; display: string; cantidad: number }[] {
  const partes = descripcion.split(/,|\by\b|\+|\/|·/i)
  const out: { normalizado: string; display: string; cantidad: number }[] = []
  for (const parte of partes) {
    const matchCantidad = parte.match(/x\s*(\d+)/i)
    const cantidad = matchCantidad ? Math.max(1, parseInt(matchCantidad[1], 10)) : 1
    const normalizado = normalizar(parte)
    if (normalizado.length < 3 || STOPWORDS.has(normalizado)) continue
    const display = parte.trim().replace(/x\s*\d+$/i, '').trim()
    out.push({ normalizado, display: display || normalizado, cantidad })
  }
  return out
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtConsejo(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

// Detecta productos que se repiten por NOMBRE (no solo por categoría) en
// los últimos 15 días — "otra vez el Monster", "van 4 Vive100 esta
// quincena" — en vez de solo agrupar por categoría genérica ("Bebidas").
// Usa un banco de alias + filtro de palabras de relleno para que
// variantes del mismo producto (marca, tamaño, sabor) cuenten juntas.
export function calcularGastosHormigaProducto(transacciones: Transaccion[]): ResumenGastosHormiga {
  const ahora = new Date()
  const corte = new Date(ahora)
  corte.setDate(corte.getDate() - DIAS_VENTANA)

  const dela15 = transacciones.filter((t) => {
    if (t.tipo !== 'egreso' || !t.descripcion) return false
    return parseLocalDate(t.fecha) >= corte
  })

  type Acc = { normalizado: string; display: string; categoriaId: string | null; cantidad: number; total: number; ultimaFecha: string }
  const porProducto = new Map<string, Acc>()

  for (const t of dela15) {
    const productos = extraerProductos(t.descripcion!)
    if (productos.length === 0) continue
    // El monto se reparte entre las UNIDADES detectadas en la misma
    // transacción (no entre los productos) — "Monster x2, agua" reparte
    // 2/3 del monto al Monster y 1/3 al agua, no mitad y mitad.
    const totalUnidades = productos.reduce((s, p) => s + p.cantidad, 0) || 1
    for (const p of productos) {
      const montoAsignado = (t.monto + t.monto_4x1000) * (p.cantidad / totalUnidades)
      const existing = porProducto.get(p.normalizado)
      if (existing) {
        existing.cantidad += p.cantidad
        existing.total += montoAsignado
        if (t.fecha > existing.ultimaFecha) existing.ultimaFecha = t.fecha
      } else {
        porProducto.set(p.normalizado, {
          normalizado: p.normalizado,
          display: capitalizar(p.display),
          categoriaId: t.categoria_id,
          cantidad: p.cantidad,
          total: montoAsignado,
          ultimaFecha: t.fecha,
        })
      }
    }
  }

  const items: GastoHormigaProducto[] = Array.from(porProducto.values())
    .filter((p) => p.cantidad >= 3)
    .map((p) => ({ nombre: p.display, categoriaId: p.categoriaId, cantidad: p.cantidad, total: p.total, promedio: p.total / p.cantidad, ultimaFecha: p.ultimaFecha }))
    .sort((a, b) => b.total - a.total)

  const total = items.reduce((s, i) => s + i.total, 0)

  let consejo: string | null = null
  if (items.length > 0) {
    const top = items[0]
    const frases = [
      `¿Otra vez ${top.nombre}? Van ${top.cantidad} en los últimos 15 días — ${fmtConsejo(top.total)} que pudiste ahorrar o meter a una meta.`,
      `${top.nombre} te está costando ${fmtConsejo(top.total)} cada quincena sin que lo sientas. Un fondo de ahorro chiquito con eso ya suma.`,
      `Llevas ${top.cantidad} compras de ${top.nombre} en 15 días (${fmtConsejo(top.total)}). No es el fin del mundo, pero ya es un hábito — vale la pena que lo decidas a propósito, no en piloto automático.`,
    ]
    // Elige la frase según el total, para que no siempre suene igual de
    // grave — más plata, tono más directo.
    consejo = top.total > 60000 ? frases[2] : top.total > 25000 ? frases[1] : frases[0]
  }

  return { items, total, consejo }
}

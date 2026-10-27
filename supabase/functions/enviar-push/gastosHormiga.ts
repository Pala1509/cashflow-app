// Copia para Deno de src/lib/gastosHormiga.ts — misma lógica exacta,
// solo que sin nada de React ni tipos de la app. Se duplica a propósito:
// cada Edge Function de Supabase se despliega como un bundle
// independiente, así que no puede importar directo de src/lib/. Si algún
// día cambia la lógica de detección en el cliente, hay que replicar el
// cambio aquí también.

export interface TransaccionMin {
  tipo: string
  descripcion: string | null
  categoria_id: string | null
  monto: number
  monto_4x1000: number
  fecha: string
}

export interface GastoHormigaProducto {
  nombre: string
  categoriaId: string | null
  cantidad: number
  total: number
  promedio: number
}

const DIAS_VENTANA = 15
const STOPWORDS = new Set(['y', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'con', 'para', 'al'])

const PALABRAS_RELLENO = new Set([
  'energy', 'energia', 'ultra', 'zero', 'light', 'lite', 'original', 'clasica', 'clasico',
  'grande', 'mediano', 'mediana', 'pequeno', 'pequena', 'personal', 'familiar',
  'lata', 'botella', 'bolsa', 'paquete', 'sixpack', 'six', 'pack',
  'mango', 'citrus', 'manzana', 'uva', 'fresa', 'natural', 'sabor',
  'ml', 'lt', 'litro', 'litros', 'gr', 'grs', 'gramos', 'oz',
])

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

function normalizar(raw: string): string {
  let s = raw.toLowerCase().trim()
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  s = s.replace(/x\s*\d+/g, '')
  s = s.replace(/\d+/g, '')
  s = s.replace(/[^a-z\s]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  for (const [variante, canon] of Object.entries(ALIAS)) {
    if (s === variante || s.includes(variante)) return canon
  }

  const palabras = s.split(' ').filter((w) => w.length > 0 && !PALABRAS_RELLENO.has(w))
  return palabras.join(' ').trim() || s
}

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

function parseLocalDate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function calcularGastosHormigaProducto(transacciones: TransaccionMin[]): GastoHormigaProducto[] {
  const ahora = new Date()
  const corte = new Date(ahora)
  corte.setDate(corte.getDate() - DIAS_VENTANA)

  const del15 = transacciones.filter((t) => {
    if (t.tipo !== 'egreso' || !t.descripcion) return false
    return parseLocalDate(t.fecha) >= corte
  })

  type Acc = { normalizado: string; display: string; categoriaId: string | null; cantidad: number; total: number }
  const porProducto = new Map<string, Acc>()

  for (const t of del15) {
    const productos = extraerProductos(t.descripcion!)
    if (productos.length === 0) continue
    const totalUnidades = productos.reduce((s, p) => s + p.cantidad, 0) || 1
    for (const p of productos) {
      const montoAsignado = (t.monto + t.monto_4x1000) * (p.cantidad / totalUnidades)
      const existing = porProducto.get(p.normalizado)
      if (existing) {
        existing.cantidad += p.cantidad
        existing.total += montoAsignado
      } else {
        porProducto.set(p.normalizado, {
          normalizado: p.normalizado,
          display: capitalizar(p.display),
          categoriaId: t.categoria_id,
          cantidad: p.cantidad,
          total: montoAsignado,
        })
      }
    }
  }

  return Array.from(porProducto.values())
    .filter((p) => p.cantidad >= 3)
    .map((p) => ({ nombre: p.display, categoriaId: p.categoriaId, cantidad: p.cantidad, total: p.total, promedio: p.total / p.cantidad }))
    .sort((a, b) => b.total - a.total)
}

// Parser de frases habladas para "Anotar con Siri" (CashFlow).
// Puro, sin dependencias: recibe la frase tal como la transcribe Siri y
// devuelve tipo, monto, descripción, lugar y pistas de cuenta/fecha.
// Ejemplos que debe entender:
//   "compré un Monster en el minimercado en 8.900"
//   "gasté 15 mil en almuerzo con Nequi"
//   "me pagaron 1.200.000 del freelance"
//   "taxi 12 lucas en efectivo"
//   "ayer pagué el parqueadero 5000"

export type Tipo = 'ingreso' | 'egreso'

export interface FraseParseada {
  tipo: Tipo
  monto: number | null
  descripcion: string | null
  lugar: string | null
  ayer: boolean
  efectivo: boolean
  textoNormalizado: string
}

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const INGRESO_RE =
  /\b(me pagaron|me pago|me consignaron|me transfirieron|me enviaron|me mandaron|me entro|me entraron|me llego|me llegaron|me dieron|recibi|cobre|vendi|gane|ingreso|sueldo|salario|quincena|nomina|prima)\b/

// ---- Números dichos con palabras (por si Siri no los convierte a dígitos) ----
const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}

// Convierte una secuencia de palabras numéricas ("ocho mil novecientos") a número.
function palabrasANumero(tokens: string[]): number | null {
  let total = 0
  let actual = 0
  let vio = false
  for (const w of tokens) {
    if (w === 'y') continue
    if (w in UNIDADES) { actual += UNIDADES[w]; vio = true; continue }
    if (w === 'mil') { total += (actual || 1) * 1000; actual = 0; vio = true; continue }
    if (w === 'millon' || w === 'millones' || w === 'palo' || w === 'palos') {
      total += (actual || 1) * 1_000_000; actual = 0; vio = true; continue
    }
    return null
  }
  return vio ? total + actual : null
}

// Palabras que actúan como multiplicador después de un número.
const MULT: Record<string, number> = {
  mil: 1000, k: 1000, lucas: 1000, luca: 1000, lukas: 1000, luka: 1000,
  millon: 1_000_000, millones: 1_000_000, palo: 1_000_000, palos: 1_000_000, m: 1_000_000,
}

interface Candidato { valor: number; inicio: number; fin: number }

// Lee un número escrito con dígitos en formato colombiano:
// "8.900", "8,900", "1.200.000", "8900", "$8.900", "12,5" (decimal).
function leerNumeroDigitos(raw: string): number | null {
  const s = raw.replace(/[$\s]/g, '')
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(',', '.'))
  if (/^\d+$/.test(s)) return Number(s)
  return null
}

function buscarMontos(norm: string): Candidato[] {
  const out: Candidato[] = []
  // 1) Dígitos, opcionalmente seguidos de multiplicador y de "y/con" + resto
  //    ("8 mil 900", "1 millon 200 mil", "15 lucas").
  const re = /\$?\s?\d[\d.,]*(?:\s(?:mil|k|lucas?|lukas?|millon(?:es)?|palos?|m)\b(?:\s(?:y\s)?\d[\d.,]*(?:\s(?:mil|lucas?|lukas?))?)?)?(?:\s(?:pesos|pesitos|barras))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(norm))) {
    const trozo = m[0].trim()
    const partes = trozo.replace(/\b(pesos|pesitos|barras)\b/, '').trim().split(/\s+/).filter((p) => p !== 'y')
    let total = 0
    let pendiente: number | null = null
    let ok = true
    for (const p of partes) {
      if (p in MULT) {
        total += (pendiente ?? 1) * MULT[p]
        pendiente = null
      } else {
        const n = leerNumeroDigitos(p)
        if (n === null) { ok = false; break }
        if (pendiente !== null) total += pendiente
        pendiente = n
      }
    }
    if (!ok) continue
    if (pendiente !== null) total += pendiente
    out.push({ valor: total, inicio: m.index, fin: m.index + m[0].length })
  }
  // 2) Números con palabras ("ocho mil novecientos pesos").
  if (out.length === 0) {
    const palabras = norm.split(' ')
    let i = 0
    let pos = 0
    const offsets: number[] = []
    for (const w of palabras) { offsets.push(pos); pos += w.length + 1 }
    while (i < palabras.length) {
      if (palabras[i] in UNIDADES || palabras[i] === 'mil') {
        let j = i
        while (j < palabras.length && (palabras[j] in UNIDADES || ['mil', 'millon', 'millones', 'y'].includes(palabras[j]))) j++
        // no terminar en "y"
        while (j > i && palabras[j - 1] === 'y') j--
        const n = palabrasANumero(palabras.slice(i, j))
        if (n !== null && n >= 100) {
          let fin = offsets[j - 1] + palabras[j - 1].length
          if (palabras[j] === 'pesos') fin = offsets[j] + 5
          out.push({ valor: n, inicio: offsets[i], fin })
        }
        i = Math.max(j, i + 1)
      } else i++
    }
  }
  return out
}

const VERBOS_INICIO =
  /^(?:(?:ayer|hoy|oye|ey|cashflow|anota(?:r)?|registra(?:r)?|apunta(?:r)?)\s+)*(?:(?:me\s+)?(?:compre|compra|comprar|gaste|gasto|pague|pagar|pago|me tome|me comi|me tomé|tanquee|eche|meti|invertir|inverti|di|saque|me pagaron|me pago|me consignaron|me transfirieron|me enviaron|me mandaron|me entro|me entraron|me llego|me llegaron|me dieron|recibi|cobre|vendi|gane)\b\s*)?/

const ARTICULOS_INICIO = /^(?:un|una|unos|unas|el|la|los|las|lo|de|del|en|por|para)\s+/

function limpiarTrozo(s: string): string {
  let t = s.trim().replace(/^[,.;:]+|[,.;:]+$/g, '').trim()
  let prev = ''
  while (prev !== t) { prev = t; t = t.replace(ARTICULOS_INICIO, '').trim() }
  t = t.replace(/\s+(?:en|por|de|a|con|y|para)$/g, '').trim()
  return t
}

function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function parsearFrase(frase: string, nombresCuenta: string[] = []): FraseParseada {
  const norm = normalizar(frase)
    .replace(/\bmedio (millon|palo)\b/g, '500 mil')
    .replace(/\bmedia (luca|luka)\b/g, '500')
    .replace(/\b(?:un|una) (millon|palo|mil|luca|luka)\b/g, '1 $1')
    .replace(/(^|\s)mil pesos\b/g, '$11000 pesos')
  const tipo: Tipo = INGRESO_RE.test(norm) ? 'ingreso' : 'egreso'
  const ayer = /\bayer\b/.test(norm)
  const efectivo = /\b(en efectivo|efectivo|en cash|cash|billete)\b/.test(norm)

  const candidatos = buscarMontos(norm)
  // El monto es el número más grande (en "2 monster en 8.900" gana 8.900).
  const elegido = candidatos.sort((a, b) => b.valor - a.valor)[0] ?? null
  const monto = elegido && elegido.valor > 0 ? Math.round(elegido.valor * 100) / 100 : null

  // Quitar el monto (con su preposición) y las menciones de cuenta.
  let resto = norm
  if (elegido) {
    const antes = resto.slice(0, elegido.inicio).replace(/(?:[\s,]+(?:me|en|por|de|a|valio|costo|salio|fue|fueron|son|total|un|valor|del))*[\s,]*$/, '')
    resto = `${antes} ${resto.slice(elegido.fin)}`
  }
  for (const nombre of nombresCuenta.map(normalizar).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length)) {
    const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    resto = resto.replace(new RegExp(`\\s*(?:con|desde|de|en|por|usando|pagado con|pague con)?\\s*(?:la|el|mi)?\\s*(?:tarjeta|cuenta)?\\s*(?:de\\s)?\\b${esc}\\b`, 'g'), ' ')
  }
  resto = resto
    .replace(/\s*(?:pagado\s)?(?:con|en)\s(?:el\s)?(?:efectivo|cash|billete)\b/g, ' ')
    .replace(/\b(?:efectivo|cash)\b/g, ' ')
    .replace(/\b(?:ayer|hoy)\b/g, ' ')
    .replace(/\bpesos\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  resto = resto.replace(VERBOS_INICIO, '').trim()

  // Separar "descripción en lugar": se toma el ÚLTIMO " en " como el lugar.
  let descripcion: string | null = null
  let lugar: string | null = null
  const idx = resto.lastIndexOf(' en ')
  if (idx > 0) {
    descripcion = limpiarTrozo(resto.slice(0, idx))
    lugar = limpiarTrozo(resto.slice(idx + 4))
  } else if (resto.startsWith('en ')) {
    lugar = limpiarTrozo(resto.slice(3))
  } else {
    descripcion = limpiarTrozo(resto)
  }
  if (descripcion === '') descripcion = null
  if (lugar === '') lugar = null
  // "gasté 15 mil en almuerzo": no hay descripción antes del "en" → lo de
  // después es la descripción, no un lugar.
  if (!descripcion && lugar && !/^(?:el|la|los|las)\s/.test(resto.slice(resto.lastIndexOf(' en ') + 4))) {
    descripcion = lugar
    lugar = null
  }

  // Recuperar mayúsculas/tildes originales cuando sea posible.
  const original = (frag: string | null) => {
    if (!frag) return null
    const normOrig = normalizar(frase)
    const i = normOrig.indexOf(frag)
    if (i >= 0) {
      // normalizar no cambia longitudes salvo tildes combinadas → mapear por palabras
      const palabrasOrig = frase.replace(/\s+/g, ' ').trim().split(' ')
      const palabrasNorm = palabrasOrig.map(normalizar)
      const objetivo = frag.split(' ')
      for (let k = 0; k + objetivo.length <= palabrasNorm.length; k++) {
        if (objetivo.every((w, j) => palabrasNorm[k + j].replace(/[,.;:]+$/, '') === w)) {
          return capitalizar(palabrasOrig.slice(k, k + objetivo.length).join(' ').replace(/[,.;:]+$/, ''))
        }
      }
    }
    return capitalizar(frag)
  }

  return {
    tipo,
    monto,
    descripcion: original(descripcion),
    lugar: original(lugar),
    ayer,
    efectivo,
    textoNormalizado: norm,
  }
}

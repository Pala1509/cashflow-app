// Alias de cuentas para "Anotar con Siri" / "Anotar con voz" (CashFlow).
//
// El dictado de Siri y de Google escribe los nombres de los bancos
// colombianos de mil formas: "Nequi" llega como "Neki", "Nicky", "Nizcy",
// "Nike"; "Nu Bank" como "Nubank", "New Bank"… Aquí se llevan todas esas
// variantes a un nombre canónico, tanto en lo que dijo el usuario como en
// los nombres de sus cuentas, para que coincidan. Si aun así nada coincide
// y la respuesta es corta ("¿Cómo pagaste?" → "nisky"), se busca la cuenta
// que más se parezca al oído (comparación fonética + distancia de edición).

import { normalizar } from './parser.ts'

const ALIAS: Array<[string, string[]]> = [
  ['nequi', ['nequi', 'neki', 'neky', 'nekki', 'nekis', 'nequis', 'neqi', 'nequy', 'nequie', 'nicky', 'niky', 'niki', 'nikki', 'nizcy', 'nizky', 'nisky', 'niskie', 'nezky', 'necky', 'neckie', 'next', 'nexy', 'nike', 'naiki', 'naike', 'neiki', 'ne ki', 'ne qui', 'nekí', 'enequi', 'en equi', 'nek', 'neck', 'nekey', 'nikey']],
  ['nu', ['nu bank', 'nubank', 'nu banc', 'nubanc', 'nu banco', 'new bank', 'newbank', 'new banc', 'nu card', 'new card', 'nu']],
  ['bancolombia', ['banco colombia', 'bancocolombia', 'banco de colombia', 'bancolombia', 'bancol']],
  ['daviplata', ['davi plata', 'daviplata', 'david plata', 'davidplata']],
  ['davivienda', ['davi vienda', 'davivienda', 'david vienda', 'davidvienda', 'davi']],
  ['lulo', ['lulo bank', 'lulobank', 'lulu bank', 'lulubank', 'lulo', 'lulu']],
  ['rappipay', ['rappi pay', 'rappipay', 'rapi pay', 'rapipay', 'rappi cuenta']],
  ['bbva', ['bbva', 'b b v a', 'be be uve a']],
  ['monedero', ['monederito', 'monedero']],
]

/**
 * Variantes de los bancos que el usuario sí tiene (para quitarlas de la
 * descripción: "un café con nubank" → descripción "Café").
 */
export function variantesDe(nombresCuenta: string[]): string[] {
  const texto = ` ${nombresCuenta.map(canonizar).join(' ')} `
  return ALIAS.filter(([canon]) => texto.includes(` ${canon} `) || texto.includes(` ${canon}`)).flatMap(([, v]) => v)
}

const REGLAS: Array<[RegExp, string]> = ALIAS.map(([canon, variantes]) => {
  const alt = [...variantes]
    .map((v) => normalizar(v))
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return [new RegExp(`(^|[^a-z0-9])(?:${alt})(?=[^a-z0-9]|$)`, 'g'), canon]
})

/** Normaliza y lleva los nombres de bancos a su forma canónica. */
export function canonizar(s: string): string {
  let t = ` ${normalizar(s)} `
  for (const [re, canon] of REGLAS) t = t.replace(re, `$1${canon}`)
  return t.replace(/\s+/g, ' ').trim()
}

function fonetica(s: string): string {
  return s
    .replace(/[^a-z0-9]/g, '')
    .replace(/qu/g, 'k')
    .replace(/c([eiy])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/ll/g, 'i')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/v/g, 'b')
    .replace(/(.)\1+/g, '$1')
}

function distancia(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/**
 * Cuentas que más se parecen al oído a una respuesta corta (todas las que
 * empatan en el mejor puntaje). Vacío si ninguna se parece lo suficiente o
 * si la mejor no se distingue de otra cuenta con nombre distinto.
 */
export function masParecidas<T extends { id: string; nombre: string; banco: string | null }>(texto: string, cuentas: T[]): T[] {
  const dicho = fonetica(canonizar(texto))
  if (dicho.length < 2) return []
  const puntajes = cuentas.map((c) => {
    const claves = new Set<string>()
    const nombre = canonizar(c.nombre)
    claves.add(fonetica(nombre))
    if (c.banco) claves.add(fonetica(canonizar(c.banco)))
    for (const w of nombre.split(' ')) if (w.length >= 3) claves.add(fonetica(w))
    let mejor = Infinity
    for (const k of claves) {
      if (!k) continue
      mejor = Math.min(mejor, distancia(dicho, k) / Math.max(dicho.length, k.length))
    }
    return { c, r: mejor }
  }).sort((a, b) => a.r - b.r)
  const primero = puntajes[0]
  if (!primero || primero.r > 0.5) return []
  const empatadas = puntajes.filter((x) => x.r - primero.r < 0.15).map((x) => x.c)
  // Varias empatadas: solo sirve si todas son del mismo banco (Nequi y la
  // tarjeta Nequi); quien llama decide entre ellas.
  const bancos = new Set(empatadas.map((c) => (c.banco ? canonizar(c.banco) : canonizar(c.nombre))))
  return bancos.size === 1 ? empatadas : []
}

/** La única cuenta que más se parece al oído, o null. */
export function masParecida<T extends { id: string; nombre: string; banco: string | null }>(texto: string, cuentas: T[]): T | null {
  const r = masParecidas(texto, cuentas)
  return r.length === 1 ? r[0] : null
}

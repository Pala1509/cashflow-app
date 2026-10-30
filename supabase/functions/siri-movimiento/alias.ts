// Alias de cuentas para "Anotar con Siri" / "Anotar con voz" (CashFlow).
//
// El dictado de Siri y de Google escribe los nombres de los bancos
// colombianos de mil formas: "Nequi" llega como "Neki", "Nicky", "Nizcy";
// "Nu Bank" como "Nubank", "New Bank"… Aquí se llevan todas esas variantes
// a un nombre canónico, tanto en lo que dijo el usuario como en los nombres
// de sus cuentas, para que coincidan. Si aun así nada coincide y la
// respuesta es corta ("¿Cómo pagaste?" → "nisky"), se busca la cuenta que
// más se parezca al oído (comparación fonética + distancia de edición).

import { normalizar } from './parser.ts'

const ALIAS: Array<[string, string[]]> = [
  ['nequi', ['nequi', 'neki', 'neky', 'nekki', 'nekis', 'nequis', 'neqi', 'nequy', 'nequie', 'nicky', 'niky', 'niki', 'nikki', 'nizcy', 'nizky', 'nisky', 'niskie', 'nezky', 'necky', 'neckie', 'next', 'nexy']],
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
 * Cuenta que más se parece al oído a una respuesta corta. Devuelve null si
 * ninguna se parece lo suficiente o si hay empate entre cuentas distintas.
 */
export function masParecida<T extends { id: string; nombre: string; banco: string | null }>(texto: string, cuentas: T[]): T | null {
  const dicho = fonetica(canonizar(texto))
  if (dicho.length < 2) return null
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
  const [primero, segundo] = puntajes
  if (!primero || primero.r > 0.5) return null
  if (segundo && segundo.r - primero.r < 0.15) return null
  return primero.c
}

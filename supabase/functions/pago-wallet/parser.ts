// Solo la normalización de texto que usa alias.ts (el parser completo de
// frases habladas vive en siri-movimiento).
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

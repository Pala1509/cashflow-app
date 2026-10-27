import type { Categoria } from './database.types'

// Ordena alfabéticamente, pero cualquier categoría cuyo nombre empiece con
// "Otros" (Otros gastos, Otros ingresos, etc.) siempre queda al final.
export function sortCategorias(cats: Categoria[]): Categoria[] {
  return [...cats].sort((a, b) => {
    const aOtros = a.nombre.toLowerCase().startsWith('otros')
    const bOtros = b.nombre.toLowerCase().startsWith('otros')
    if (aOtros && !bOtros) return 1
    if (!aOtros && bOtros) return -1
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

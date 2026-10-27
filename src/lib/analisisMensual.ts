import { parseLocalDate } from './date'
import type { Transaccion } from './database.types'

export interface Proyeccion {
  gastadoHastaHoy: number
  proyeccionFinDeMes: number
  diasTranscurridos: number
  diasDelMes: number
}

// Con lo gastado hasta hoy y cuántos días llevas del mes, proyecta cuánto
// vas a terminar gastando SI sigues al mismo ritmo — el mismo cálculo que
// usan las apps de gastos serias para avisarte a tiempo, no al final del mes.
export function calcularProyeccion(transacciones: Transaccion[]): Proyeccion {
  const now = new Date()
  const diasDelMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const diasTranscurridos = now.getDate()

  const gastadoHastaHoy = transacciones
    .filter((t) => {
      if (t.tipo !== 'egreso') return false
      const d = parseLocalDate(t.fecha)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  const ritmoDiario = diasTranscurridos > 0 ? gastadoHastaHoy / diasTranscurridos : 0
  const proyeccionFinDeMes = ritmoDiario * diasDelMes

  return { gastadoHastaHoy, proyeccionFinDeMes, diasTranscurridos, diasDelMes }
}

export interface ComparacionCategoria {
  categoriaId: string | null
  esteMes: number
  mesAnterior: number
  diferencia: number
}

// Compara, categoría por categoría, cuánto gastaste este mes contra el mes
// anterior — para ver de un vistazo en qué se te fue más (o menos) plata.
export function calcularComparacionMensual(transacciones: Transaccion[]): ComparacionCategoria[] {
  const now = new Date()
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const sumarPorCategoria = (mes: number, anio: number) => {
    const mapa = new Map<string | null, number>()
    transacciones
      .filter((t) => {
        if (t.tipo !== 'egreso') return false
        const d = parseLocalDate(t.fecha)
        return d.getMonth() === mes && d.getFullYear() === anio
      })
      .forEach((t) => {
        const key = t.categoria_id
        mapa.set(key, (mapa.get(key) ?? 0) + t.monto + t.monto_4x1000)
      })
    return mapa
  }

  const esteMesMap = sumarPorCategoria(now.getMonth(), now.getFullYear())
  const mesAnteriorMap = sumarPorCategoria(mesAnterior.getMonth(), mesAnterior.getFullYear())

  const todasLasCategorias = new Set([...esteMesMap.keys(), ...mesAnteriorMap.keys()])
  const resultados: ComparacionCategoria[] = []
  for (const categoriaId of todasLasCategorias) {
    const esteMes = esteMesMap.get(categoriaId) ?? 0
    const anterior = mesAnteriorMap.get(categoriaId) ?? 0
    if (esteMes === 0 && anterior === 0) continue
    resultados.push({ categoriaId, esteMes, mesAnterior: anterior, diferencia: esteMes - anterior })
  }

  return resultados.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
}

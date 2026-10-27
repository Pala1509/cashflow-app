import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface TasaCambio {
  moneda: string
  fecha: string
  tasa_cop: number
  actualizado_en: string
}

// Memoria compartida entre montajes (vive mientras la pestaña del
// navegador esté abierta) — mismo patrón que memoryCache en
// useFinanzas.ts. Sin esto, cada vez que se sale de Inicio y se vuelve
// (la barra inferior desmonta/remonta la pantalla), tasas volvía a []
// por un instante y el widget parpadeaba (desaparecía y reaparecía).
let tasasCache: TasaCambio[] | null = null

// No es dato por usuario — es el mismo para todo el mundo, así que no
// necesita el user.id para nada, a diferencia de useTema/useIdioma.
// Trae los últimos 30 días para poder dibujar la mini gráfica de
// tendencia, no solo el número de hoy.
export function useTasasCambio() {
  const [tasas, setTasas] = useState<TasaCambio[]>(() => tasasCache ?? [])
  const [loading, setLoading] = useState(() => tasasCache === null)

  useEffect(() => {
    let cancelado = false
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    supabase
      .from('tasas_cambio')
      .select('moneda, fecha, tasa_cop, actualizado_en')
      .gte('fecha', desde.toISOString().slice(0, 10))
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        if (cancelado) return
        const t = (data as TasaCambio[]) ?? []
        tasasCache = t
        setTasas(t)
        setLoading(false)
      })
    return () => { cancelado = true }
  }, [])

  // Historial de una moneda, ya ordenado por fecha — para la gráfica.
  const historialDe = useCallback((moneda: string): TasaCambio[] => {
    return tasas.filter((t) => t.moneda === moneda)
  }, [tasas])

  // El valor más reciente de una moneda — para mostrar "hoy".
  const tasaDe = useCallback((moneda: string): number => {
    const h = historialDe(moneda)
    return h.length > 0 ? h[h.length - 1].tasa_cop : 1
  }, [historialDe])

  // Convierte un monto a COP según su moneda de origen. COP (o sin
  // moneda especificada, cuentas viejas) se devuelve tal cual. Esto es
  // lo único que debe usarse para SUMAR saldos de cuentas de distinta
  // moneda entre sí — sumar los números crudos da un total sin sentido
  // (100 USD + 100.000 COP ≠ 100.100). Memoizada (useCallback) para que
  // se pueda meter segura en deps de useEffect sin causar loops.
  const convertirCOP = useCallback((monto: number, moneda: string | null | undefined): number => {
    if (!moneda || moneda === 'COP') return monto
    return monto * tasaDe(moneda)
  }, [tasaDe])

  return { tasas, loading, tasaDe, historialDe, convertirCOP }
}

// Corre una vez al día (ver el cron en 02_cashflow_schema.sql). Trae las
// tasas de una API pública gratis, sin API key — fawazahmed0/currency-api,
// servida por dos CDNs distintos como respaldo uno del otro (si uno
// falla, se intenta el otro antes de rendirse).
//
// También soporta "backfill" de días pasados vía query param ?dias=N —
// la misma API sirve tasas históricas cambiando "latest" por una fecha
// YYYY-MM-DD en la URL. Se usa una sola vez para llenar la mini gráfica
// de tendencia con datos reales de inmediato, en vez de esperar a que
// el cron diario los vaya acumulando uno por uno. Ej: invocar con
// ?dias=14 trae hoy + los 13 días anteriores para las 3 monedas.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!

const MONEDAS = ['usd', 'eur', 'mxn']

// fecha: 'latest' o 'YYYY-MM-DD'
const FUENTES = (moneda: string, fecha: string) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${fecha}/v1/currencies/${moneda}.json`,
  `https://${fecha}.currency-api.pages.dev/v1/currencies/${moneda}.json`,
]

async function traerTasaCop(moneda: string, fecha: string): Promise<number | null> {
  for (const url of FUENTES(moneda, fecha)) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const data = await resp.json()
      const cop = data?.[moneda]?.cop
      if (typeof cop === 'number' && cop > 0) return cop
    } catch {
      // intenta la siguiente fuente
    }
  }
  return null
}

Deno.serve(async (req) => {
  // Igual que enviar-push: está desplegada con --no-verify-jwt porque
  // pg_cron la llama con la anon key en vez de un JWT real, así que sin
  // este chequeo cualquiera con la URL podía llamarla las veces que
  // quisiera (gastando cupo de la API externa y de Edge Functions).
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('No autorizado', { status: 401 })
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const url = new URL(req.url)
  const dias = Math.max(1, Math.min(90, Number(url.searchParams.get('dias')) || 1))

  // Lista de fechas a traer: hoy (como 'latest', que es más confiable que
  // pedir la fecha de hoy como histórica — a veces el día actual todavía
  // no está publicado como snapshot histórico) + los N-1 días anteriores
  // como fechas históricas reales.
  const hoy = new Date()
  const fechasHistoricas: string[] = []
  for (let i = 1; i < dias; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    fechasHistoricas.push(d.toISOString().slice(0, 10))
  }

  const resultados: Record<string, number | null> = {}
  let guardadas = 0

  for (const moneda of MONEDAS) {
    // 'latest' se guarda con la fecha de hoy real.
    const tasaHoy = await traerTasaCop(moneda, 'latest')
    resultados[moneda] = tasaHoy
    if (tasaHoy !== null) {
      await supabase.from('tasas_cambio').upsert({
        moneda: moneda.toUpperCase(),
        fecha: hoy.toISOString().slice(0, 10),
        tasa_cop: tasaHoy,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'moneda,fecha' })
      guardadas++
    }

    for (const fecha of fechasHistoricas) {
      const tasa = await traerTasaCop(moneda, fecha)
      if (tasa !== null) {
        await supabase.from('tasas_cambio').upsert({
          moneda: moneda.toUpperCase(),
          fecha,
          tasa_cop: tasa,
          actualizado_en: new Date().toISOString(),
        }, { onConflict: 'moneda,fecha' })
        guardadas++
      }
    }
  }

  const fallidas = Object.entries(resultados).filter(([, v]) => v === null).map(([k]) => k)
  return new Response(JSON.stringify({ ok: fallidas.length === 0, resultados, fallidas, dias, guardadas }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

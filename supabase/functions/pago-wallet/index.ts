// Edge Function: pago-wallet (CashFlow)
//
// La llama la acción "Registrar pago" de CashFlow desde una automatización
// de Atajos en iPhone ("Cuando se use cualquier tarjeta" de Wallet). Recibe
// el comercio, el importe y el nombre de la tarjeta tal como los entrega
// Apple Pay, crea el gasto y devuelve el texto para la notificación.
//
// Auth: el mismo token por dispositivo de "Anotar con Siri" (siri_tokens),
// header x-siri-token. Por eso verify_jwt = false.
//
// Body: { comercio, importe?, tarjeta?, prueba? }
//   - importe llega como texto ("$8.900", "COP 8.900,00", "8,900.00"…).
//     Si no viene, se responde { necesitaMonto: true } y no se guarda nada.
//   - tarjeta → cuenta: primero la asociación guardada en tarjetas_wallet;
//     si no hay, se adivina por el nombre (alias: "LuloBank" = Lulo,
//     "Nu Mastercard Debit" = Nu) y se guarda para la próxima.
//   - Si en los últimos 15 min ya hay un gasto igual (mismo valor y mismo
//     comercio), no se duplica.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { canonizar, masParecidas } from './alias.ts'
import { normalizar } from './parser.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})
const ZONA = 'America/Bogota'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function formatoMonto(n: number): string {
  return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}

// "$8.900" / "COP 8.900,00" / "8,900.00" / "8900" / "$ 1.250.000" → número.
export function parseImporte(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).replace(/[^\d.,-]/g, '')
  if (!s || !/\d/.test(s)) return null
  const ultimoPunto = s.lastIndexOf('.')
  const ultimaComa = s.lastIndexOf(',')
  const sep = Math.max(ultimoPunto, ultimaComa)
  let entero = s
  let decimales = ''
  // Un separador seguido de exactamente 1-2 dígitos al final = decimales.
  if (sep >= 0 && /^\d{1,2}$/.test(s.slice(sep + 1))) {
    entero = s.slice(0, sep)
    decimales = s.slice(sep + 1)
  }
  const n = Number(entero.replace(/[.,-]/g, '') + (decimales ? '.' + decimales : ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function contienePalabra(texto: string, palabra: string): boolean {
  if (!palabra) return false
  const esc = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(texto)
}

// Comercio → categoría predeterminada (si existe para el usuario).
const PISTAS: Array<[RegExp, string[]]> = [
  [/\b(d1|ara|exito|olimpica|carulla|jumbo|isimo|surtimax|metro|makro|pricesmart|alkosto|minimercado|supermercado|mercado|tienda|fruver)\b/, ['alimentos']],
  [/\b(rappi|ifood|mcdonald|burger|kfc|frisby|presto|crepes|el corral|domino|subway|restaurante|pizza|sushi|wok)\b/, ['restaurante']],
  [/\b(juan valdez|starbucks|oma|tostao|cafe|panaderia)\b/, ['cafe']],
  [/\b(terpel|primax|esso|biomax|mobil|texaco|zeuss|gasolina|eds)\b/, ['gasolina']],
  [/\b(uber|didi|indriver|cabify|picap|taxi)\b/, ['taxi']],
  [/\b(metro de medellin|civica|transmilenio|metroplus)\b/, ['transporte publico']],
  [/\b(parqueadero|parking)\b/, ['parking']],
  [/\b(cruz verde|pasteur|farmatodo|drogueria|farmacia|locatel)\b/, ['farmacia']],
  [/\b(smartfit|smart fit|bodytech|gym|gimnasio)\b/, ['gimnasio']],
  [/\b(netflix|spotify|disney|hbo|max|prime|youtube|apple|icloud|openai|chatgpt|claude|crunchyroll|paramount)\b/, ['suscripcion']],
  [/\b(falabella|zara|h&m|arturo calle|koaj|mercado libre|amazon|temu|shein|adidas|nike)\b/, ['compras']],
  [/\b(cine colombia|cinemark|procinal|cine)\b/, ['hobby']],
]

interface Cuenta { id: string; nombre: string; banco: string | null; tipo: string; activa: boolean | null; congelada: boolean | null; four_x_mil: boolean | null }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, mensaje: 'Método no permitido' }, 405)
  const token = req.headers.get('x-siri-token')?.trim()
  if (!token) return json({ ok: false, mensaje: 'Abre CashFlow una vez para conectar los pagos automáticos.' }, 401)

  let body: { comercio?: string; importe?: string | number; tarjeta?: string; prueba?: boolean }
  try { body = await req.json() } catch { return json({ ok: false, mensaje: 'Solicitud inválida' }, 400) }

  const { data: tok } = await supabase.from('siri_tokens').select('id, user_id').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (!tok) return json({ ok: false, mensaje: 'CashFlow no está conectado. Ábrelo de nuevo para conectar los pagos automáticos.' }, 401)
  const userId: string = tok.user_id

  const comercio = (body.comercio ?? '').toString().trim().slice(0, 120) || 'Pago con Apple Pay'
  const tarjeta = (body.tarjeta ?? '').toString().trim().slice(0, 120)
  const monto = parseImporte(body.importe === undefined ? null : String(body.importe))
  if (!monto) return json({ ok: false, necesitaMonto: true, mensaje: `Pagaste en ${comercio}. Abre CashFlow para poner el valor.` })

  // ---- Cuenta: asociación guardada > adivinar por nombre > la más usada ----
  const { data: cuentasData } = await supabase.from('cuentas').select('id, nombre, banco, tipo, activa, congelada, four_x_mil').eq('user_id', userId)
  const cuentas = ((cuentasData ?? []) as Cuenta[]).filter((c) => c.activa !== false && c.congelada !== true && c.tipo !== 'cdt')
  if (!cuentas.length) return json({ ok: false, mensaje: 'Primero crea una cuenta en CashFlow.' })

  let cuenta: Cuenta | undefined
  if (tarjeta) {
    const { data: asoc } = await supabase.from('tarjetas_wallet').select('id, cuenta_id').eq('user_id', userId).eq('tarjeta', tarjeta).maybeSingle()
    if (asoc?.cuenta_id) cuenta = cuentas.find((c) => c.id === asoc.cuenta_id)
    if (!cuenta) {
      const n = canonizar(tarjeta)
      const porNombre = cuentas.filter((c) => {
        const nombre = canonizar(c.nombre)
        const banco = c.banco ? canonizar(c.banco) : ''
        return contienePalabra(n, nombre) || (banco && contienePalabra(n, banco))
      })
      // "Nu Mastercard Debit" → preferir la tarjeta/cuenta de débito sobre la de crédito, y al revés.
      const esCredito = /\b(credit|credito)\b/.test(n)
      const ordenadas = porNombre.sort((a, b) => {
        const pa = (a.tipo === 'tarjeta_credito') === esCredito ? 0 : 1
        const pb = (b.tipo === 'tarjeta_credito') === esCredito ? 0 : 1
        return pa - pb
      })
      cuenta = ordenadas[0] ?? masParecidas(n.split(' ')[0] ?? n, cuentas)[0]
    }
    // Se guarda (o actualiza) la tarjeta para que la persona la pueda
    // corregir en CashFlow → Pagos con Apple Pay.
    await supabase.from('tarjetas_wallet').upsert(
      { user_id: userId, tarjeta, cuenta_id: asoc?.cuenta_id ?? cuenta?.id ?? null, ultimo_uso: new Date().toISOString() },
      { onConflict: 'user_id,tarjeta' },
    )
  }
  if (!cuenta) {
    const desde = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
    const { data: usos } = await supabase.from('transacciones').select('cuenta_id').eq('user_id', userId).gte('fecha', desde).limit(1000)
    const conteo = new Map<string, number>()
    for (const u of usos ?? []) conteo.set(u.cuenta_id, (conteo.get(u.cuenta_id) ?? 0) + 1)
    const candidatas = cuentas.filter((c) => c.tipo !== 'efectivo')
    cuenta = [...(candidatas.length ? candidatas : cuentas)].sort((a, b) => (conteo.get(b.id) ?? 0) - (conteo.get(a.id) ?? 0))[0]
  }

  // ---- Sin duplicar: mismo valor y comercio en los últimos 15 minutos ----
  const fecha = hoyLocal()
  const hace15 = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: recientes } = await supabase.from('transacciones').select('id, descripcion, lugar').eq('user_id', userId).eq('tipo', 'egreso').eq('monto', monto).gte('created_at', hace15)
  const nComercio = normalizar(comercio)
  if ((recientes ?? []).some((t) => [t.descripcion, t.lugar].some((x) => x && (normalizar(x).includes(nComercio) || nComercio.includes(normalizar(x)))))) {
    return json({ ok: true, duplicado: true, mensaje: `Ya estaba anotado: ${comercio} · ${formatoMonto(monto)}` })
  }

  // ---- Categoría: historial del comercio > pistas > ninguna ----
  const { data: categoriasData } = await supabase.from('categorias').select('id, nombre, tipo').eq('user_id', userId).eq('tipo', 'egreso')
  const categorias = (categoriasData ?? []) as { id: string; nombre: string }[]
  let categoria: { id: string; nombre: string } | undefined
  const { data: previas } = await supabase.from('transacciones').select('categoria_id, descripcion, lugar').eq('user_id', userId).eq('tipo', 'egreso').not('categoria_id', 'is', null).order('created_at', { ascending: false }).limit(500)
  const conteo = new Map<string, number>()
  for (const t of previas ?? []) {
    if ([t.descripcion, t.lugar].some((x) => x && normalizar(x) === nComercio)) conteo.set(t.categoria_id, (conteo.get(t.categoria_id) ?? 0) + 1)
  }
  const mejor = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]
  if (mejor) categoria = categorias.find((c) => c.id === mejor[0])
  if (!categoria) {
    for (const [re, nombres] of PISTAS) {
      if (!re.test(nComercio)) continue
      categoria = categorias.find((c) => nombres.includes(normalizar(c.nombre)))
      if (categoria) break
    }
  }

  const nombreCuenta = cuenta.nombre.trim()
  const cuerpo = [comercio, formatoMonto(monto), categoria?.nombre, nombreCuenta].filter(Boolean).join(' · ')
  if (body.prueba) return json({ ok: true, prueba: true, mensaje: cuerpo, cuenta: nombreCuenta, categoria: categoria?.nombre ?? null, monto })

  const tax = cuenta.tipo !== 'tarjeta_credito' && cuenta.four_x_mil ? Math.round(monto * 0.004) : 0
  const { data: nueva, error } = await supabase.from('transacciones').insert({
    user_id: userId, tipo: 'egreso', monto, monto_4x1000: tax, categoria_id: categoria?.id ?? null,
    cuenta_id: cuenta.id, cuenta_destino_id: null, gasto_fijo_id: null, ingreso_fijo_id: null,
    descripcion: comercio, lugar: null, fecha, origen: 'apple_pay',
  }).select('id').single()
  if (error) {
    console.error('insert error', error)
    return json({ ok: false, mensaje: 'No pude anotar el pago. Ábrelo en CashFlow.' }, 500)
  }
  await supabase.from('siri_tokens').update({ ultima_transaccion_id: nueva.id, last_used_at: new Date().toISOString() }).eq('id', tok.id)

  return json({ ok: true, id: nueva.id, mensaje: cuerpo, notificacion: { titulo: 'Gasto anotado', cuerpo } })
})

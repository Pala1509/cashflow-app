// Edge Function: siri-movimiento (CashFlow)
//
// La llama el App Intent de iOS "Anotar movimiento" (ver
// ios/App/App/CashFlowSiri.swift). Recibe la frase tal como la dictó el
// usuario ("compré un Monster en el minimercado en 8.900"), la interpreta,
// guarda la transacción y devuelve un `mensaje` que Siri lee en voz alta.
//
// Auth: NO usa la sesión de Supabase (el intent corre fuera del WebView y no
// tiene el JWT). Usa un token propio por dispositivo que la app genera con
// la RPC crear_token_siri() y guarda en UserDefaults. Aquí solo se compara
// su hash sha256 contra public.siri_tokens. Por eso verify_jwt = false.
//
// Body: { frase, tipo?: 'egreso'|'ingreso', metodo?, preguntarCuenta?, prueba? }   Header: x-siri-token
//
// Cuenta / método de pago:
//   - Si la frase ya la nombra ("…con Nequi", "en efectivo") se usa esa.
//   - Si viene `metodo` (lo que el usuario contestó a "¿Cómo pagaste?") se
//     busca esa cuenta; si no se encuentra se devuelve necesitaCuenta con
//     una pregunta que lista las cuentas, y NO se guarda nada.
//   - Si no, y `preguntarCuenta` es true (intents nuevos), se devuelve
//     { necesitaCuenta: true, pregunta } para que Siri pregunte.
//   - Si no (builds viejos), se usa la cuenta más usada.
// Los nombres de bancos se comparan con alias (alias.ts): "Neki"/"Nizcy" =
// Nequi, "Nubank"/"New Bank" = Nu, etc., y si la respuesta es corta y nada
// coincide, se elige la cuenta que más se parezca al oído.
// Con prueba=true interpreta pero NO guarda (para testear el parser).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizar, parsearFrase } from './parser.ts'
import { canonizar, masParecida, variantesDe } from './alias.ts'

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

function fechaLocal(diasAtras = 0): string {
  const d = new Date(Date.now() - diasAtras * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function formatoMonto(n: number, moneda: string | null): string {
  const m = (moneda || 'COP').toUpperCase()
  if (m === 'COP') return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n) + ' ' + m
}

function contienePalabra(texto: string, palabra: string): boolean {
  if (!palabra) return false
  const esc = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(texto)
}

// Palabras clave → nombre de categoría predeterminada (normalizado). Solo se
// usa si la categoría existe para el usuario; si no, se ignora.
const PISTAS: Array<[RegExp, string[]]> = [
  [/\b(minimercado|supermercado|mercado|tienda|d1|ara|exito|olimpica|carulla|jumbo|isimo|fruver|surtimax)\b/, ['alimentos']],
  [/\b(almuerzo|almorce|desayuno|desayune|cena|cene|comida|restaurante|corrientazo|hamburguesa|pizza|salchipapa|arepa|empanada|empanadas|pollo|sushi|rappi|ifood|domicilio)\b/, ['restaurante']],
  [/\b(cafe|tinto|juan valdez|starbucks|oma|capuchino|cafeteria|panaderia|pan)\b/, ['cafe']],
  [/\b(dulce|dulces|chocolatina|galleta|galletas|mecato|helado|caramelo|caramelos)\b/, ['caramelos']],
  [/\b(gasolina|tanqueo|tanquee|terpel|primax|esso|biomax|mobil|texaco|zeuss)\b/, ['gasolina']],
  [/\b(taxi|uber|didi|indriver|indrive|cabify|picap)\b/, ['taxi']],
  [/\b(metro|bus|buseta|metroplus|civica|colectivo|pasaje|pasajes|transmilenio|mio)\b/, ['transporte publico']],
  [/\b(parqueadero|parking|parqueo)\b/, ['parking']],
  [/\b(soat|seguro de la moto|seguro del carro)\b/, ['seguros de coche']],
  [/\b(taller|mecanico|aceite|llanta|llantas|repuesto|repuestos|lavada|lavadero)\b/, ['costes de vehiculo', 'reparar']],
  [/\b(drogueria|farmacia|pastillas|medicamento|medicamentos|cruz verde|pasteur|farmatodo)\b/, ['farmacia']],
  [/\b(medico|cita|consulta|eps|examen|examenes|laboratorio)\b/, ['medico']],
  [/\b(odontologo|dentista)\b/, ['dentista']],
  [/\b(gym|gimnasio|smartfit|smart fit|bodytech|spinning)\b/, ['gimnasio']],
  [/\b(netflix|spotify|disney|hbo|max|prime video|amazon prime|youtube premium|icloud|chatgpt|claude|suscripcion|apple music|crunchyroll|paramount)\b/, ['suscripcion']],
  [/\b(internet|wifi)\b/, ['internet']],
  [/\b(recarga|plan del celular|plan celular|minutos)\b/, ['telefono']],
  [/\b(luz|energia)\b/, ['electricidad']],
  [/\b(epm|servicios|factura|facturas)\b/, ['facturas']],
  [/\b(arriendo|alquiler)\b/, ['alquiler']],
  [/\b(ropa|zapatos|tenis|camisa|camiseta|pantalon|jean|falabella|zara|mercado libre|amazon|temu|shein|centro comercial)\b/, ['compras']],
  [/\b(regalo|regalos|detalle)\b/, ['regalo']],
  [/\b(perro|gato|veterinario|veterinaria|concentrado|mascota|cuido)\b/, ['mascota']],
  [/\b(discoteca|rumba|bar|guaro|aguardiente|cerveza|cervezas|pola|polas|ron|trago|tragos)\b/, ['discoteca']],
  [/\b(concierto|boleta|boletas|entrada)\b/, ['concierto']],
  [/\b(cine|pelicula)\b/, ['hobby']],
  [/\b(curso|universidad|colegio|matricula|libro|libros|semestre)\b/, ['educacion']],
  [/\b(hotel|airbnb|hostal)\b/, ['hotel']],
  [/\b(vuelo|tiquete|avion)\b/, ['vuelo']],
  // ingresos
  [/\b(freelance|freelancer|proyecto|cliente|pagina web|app)\b/, ['freelancer']],
  [/\b(venta|vendi|ventas)\b/, ['ventas']],
  [/\b(intereses|interes|rendimientos)\b/, ['interes']],
  [/\b(dividendos|inversion|trading|cripto)\b/, ['inversiones']],
  [/\b(sueldo|salario|quincena|nomina|prima|pago del trabajo)\b/, ['salario', 'sueldo', 'nomina', 'trabajo']],
]

interface Cuenta { id: string; nombre: string; banco: string | null; tipo: string; moneda: string | null; four_x_mil: boolean | null; activa: boolean | null; congelada: boolean | null }
interface Categoria { id: string; nombre: string; tipo: string }

const PALABRAS_VACIAS = new Set(['con', 'la', 'el', 'mi', 'de', 'del', 'en', 'tarjeta', 'cuenta', 'pague', 'pago', 'fue', 'por', 'una', 'uno', 'un', 'lo', 'desde', 'banco'])

// Nombre y banco de la cuenta, ya normalizados y con alias aplicados.
const nombreDe = (c: Cuenta) => canonizar(c.nombre)
const bancoDe = (c: Cuenta) => (c.banco ? canonizar(c.banco) : '')

// ¿El texto (ya canonizado) menciona esta cuenta por nombre o banco?
function mencionada(n: string, c: Cuenta): boolean {
  const nombre = nombreDe(c)
  const banco = bancoDe(c)
  if (contienePalabra(n, nombre)) return true
  if (banco && contienePalabra(n, banco)) return true
  // "nubank" dicho pegado vs "Nu Bank" guardado separado (o al revés)
  const pegado = n.replace(/[^a-z0-9]/g, '')
  const nombrePegado = nombre.replace(/[^a-z0-9]/g, '')
  return nombrePegado.length >= 5 && pegado.includes(nombrePegado)
}

function filtrarPorTipo(n: string, cuentas: Cuenta[]): Cuenta[] {
  if (/\b(efectivo|cash|billete|billetes|en mano)\b/.test(n)) return cuentas.filter((c) => c.tipo === 'efectivo')
  if (/\bcredito\b/.test(n)) return cuentas.filter((c) => c.tipo === 'tarjeta_credito')
  if (/\bdebito\b/.test(n)) return cuentas.filter((c) => c.tipo === 'tarjeta_debito' || c.tipo === 'cuenta_bancaria')
  if (/\b(ahorros|cuenta de ahorros|corriente)\b/.test(n)) return cuentas.filter((c) => c.tipo === 'cuenta_bancaria')
  if (/\btarjeta\b/.test(n)) return cuentas.filter((c) => c.tipo === 'tarjeta_credito' || c.tipo === 'tarjeta_debito')
  return []
}

// Encuentra la cuenta que el usuario nombró ("bancolombia", "la tarjeta nu",
// "efectivo", "con la de crédito"). Devuelve null si no hay una sola clara.
function resolverCuenta(texto: string, cuentas: Cuenta[]): Cuenta | null {
  const n = canonizar(texto)
  const porNombre = cuentas.filter((c) => mencionada(n, c))
  if (porNombre.length === 1) return porNombre[0]
  if (porNombre.length > 1) {
    const exactas = porNombre.filter((c) => contienePalabra(n, nombreDe(c)))
    if (exactas.length === 1) return exactas[0]
    const porTipo = filtrarPorTipo(n, porNombre)
    if (porTipo.length === 1) return porTipo[0]
    // "Bancolombia" a secas, con cuenta y tarjeta de crédito del mismo banco
    // → casi siempre se refiere a la cuenta, no a la tarjeta.
    const noCredito = porNombre.filter((c) => c.tipo !== 'tarjeta_credito')
    if (!/\b(tarjeta|credito)\b/.test(n) && noCredito.length === 1) return noCredito[0]
    // "Nequi" con una cuenta Nequi y una tarjeta Nequi → la que no es tarjeta.
    if (!/\btarjeta\b/.test(n)) {
      const noTarjeta = porNombre.filter((c) => !c.tipo.startsWith('tarjeta'))
      if (noTarjeta.length === 1) return noTarjeta[0]
    }
    return null
  }
  const porTipo = filtrarPorTipo(n, cuentas)
  if (porTipo.length === 1) return porTipo[0]
  const tokens = n.split(' ').filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w))
  const universo = porTipo.length > 1 ? porTipo : cuentas
  const parcial = universo.filter((c) => {
    const palabras = `${nombreDe(c)} ${bancoDe(c)}`.split(' ')
    return tokens.some((w) => palabras.includes(w))
  })
  if (parcial.length === 1) return parcial[0]
  // Respuesta corta que el dictado escribió raro ("nisky", "lulu banc"):
  // la cuenta que más se parezca al oído.
  if (n.split(' ').length <= 3) return masParecida(n, universo)
  return null
}

// Cuenta mencionada dentro de la frase misma ("…con Nequi", "en efectivo").
function resolverFrase(norm: string, efectivo: boolean, cuentas: Cuenta[]): Cuenta | null {
  const nombradas = cuentas.filter((c) => mencionada(norm, c))
  if (nombradas.length) return resolverCuenta(norm, nombradas) ?? nombradas.sort((a, b) => b.nombre.length - a.nombre.length)[0]
  if (efectivo) return cuentas.find((c) => c.tipo === 'efectivo') ?? null
  if (/\btarjeta de credito\b|\bcon la tarjeta\b|\bcon tarjeta\b/.test(norm)) {
    const tcs = cuentas.filter((c) => c.tipo === 'tarjeta_credito')
    if (tcs.length === 1) return tcs[0]
  }
  return null
}

// Para volver a preguntar: si la respuesta apuntaba a varias cuentas
// ("la de crédito" con 2 tarjetas), lista solo esas.
function candidatasDe(texto: string, cuentas: Cuenta[]): Cuenta[] {
  const n = canonizar(texto)
  const porNombre = cuentas.filter((c) => mencionada(n, c))
  if (porNombre.length > 1) return porNombre
  const porTipo = filtrarPorTipo(n, cuentas)
  if (porTipo.length > 1) return porTipo
  return cuentas
}

function listarCuentas(cuentas: Cuenta[]): string {
  const nombres = cuentas.slice(0, 6).map((c) => c.nombre.trim())
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, mensaje: 'Método no permitido' }, 405)

  const token = req.headers.get('x-siri-token')?.trim()
  if (!token) return json({ ok: false, mensaje: 'Primero abre CashFlow y activa Siri en tu perfil.' }, 401)

  let body: { frase?: string; prueba?: boolean; tipo?: string; metodo?: string; preguntarCuenta?: boolean }
  try { body = await req.json() } catch { return json({ ok: false, mensaje: 'No entendí la solicitud.' }, 400) }
  const frase = (body.frase ?? '').toString().trim().slice(0, 300)
  if (!frase) return json({ ok: false, mensaje: 'No escuché ningún movimiento. Intenta de nuevo.' }, 400)

  const hash = await sha256Hex(token)
  const { data: tok } = await supabase.from('siri_tokens').select('id, user_id, ultima_transaccion_id').eq('token_hash', hash).maybeSingle()
  if (!tok) return json({ ok: false, mensaje: 'Siri no está conectado a tu cuenta. Ábrelo de nuevo desde tu perfil en CashFlow.' }, 401)
  const userId: string = tok.user_id

  const norm = normalizar(frase)

  // ---- Deshacer: "borra el último", "deshacer", "cancela eso" ----
  if (/^(borra|borrar|elimina|eliminar|deshaz|deshacer|cancela|cancelar|quita|quitar)\b/.test(norm)) {
    if (!tok.ultima_transaccion_id) return json({ ok: true, mensaje: 'No hay nada reciente que borrar.' })
    const { data: tx } = await supabase.from('transacciones').select('id, monto, descripcion, lugar, created_at').eq('id', tok.ultima_transaccion_id).eq('user_id', userId).maybeSingle()
    if (!tx || Date.now() - new Date(tx.created_at).getTime() > 30 * 60_000) {
      return json({ ok: true, mensaje: 'Solo puedo borrar lo último que anotaste con Siri en la última media hora.' })
    }
    if (!body.prueba) {
      await supabase.from('transacciones').delete().eq('id', tx.id).eq('user_id', userId)
      await supabase.from('siri_tokens').update({ ultima_transaccion_id: null, last_used_at: new Date().toISOString() }).eq('id', tok.id)
    }
    const quePaso = `${tx.descripcion ?? tx.lugar ?? 'Movimiento'} · ${formatoMonto(Number(tx.monto), null)}`
    return json({ ok: true, mensaje: `Listo, borré ${tx.descripcion ?? tx.lugar ?? 'el movimiento'} de ${formatoMonto(Number(tx.monto), null)}.`, notificacion: { titulo: 'Movimiento borrado', cuerpo: quePaso } })
  }

  const [{ data: cuentasData }, { data: categoriasData }] = await Promise.all([
    supabase.from('cuentas').select('id, nombre, banco, tipo, moneda, four_x_mil, activa, congelada').eq('user_id', userId),
    supabase.from('categorias').select('id, nombre, tipo').eq('user_id', userId),
  ])
  const cuentas = ((cuentasData ?? []) as Cuenta[]).filter((c) => c.activa !== false && c.congelada !== true && c.tipo !== 'cdt')
  const categorias = (categoriasData ?? []) as Categoria[]
  if (cuentas.length === 0) return json({ ok: false, mensaje: 'Primero crea una cuenta en CashFlow para poder anotar movimientos.' })

  const nombresCuenta = cuentas.flatMap((c) => [c.nombre, c.banco ?? '']).filter(Boolean)
  const p = parsearFrase(frase, [...nombresCuenta, ...variantesDe(nombresCuenta)])
  // Si el usuario activó Siri con "agrega un gasto…" / "agrega un ingreso…",
  // el intent manda el tipo explícito y ese manda sobre lo que se infiera.
  if (body.tipo === 'egreso' || body.tipo === 'ingreso') p.tipo = body.tipo
  if (!p.monto) {
    return json({ ok: false, mensaje: 'No entendí el valor. Prueba así: compré un café en la panadería en 5 mil.' })
  }

  // ---- Cuenta: nombrada en la frase > respuesta a "¿cómo pagaste?" > preguntar > la más usada ----
  const usables = cuentas.filter((c) => p.tipo === 'egreso' || c.tipo !== 'tarjeta_credito')
  let cuenta: Cuenta | undefined = resolverFrase(canonizar(frase), p.efectivo, usables) ?? undefined
  if (!cuenta && body.metodo) {
    cuenta = resolverCuenta(body.metodo, usables) ?? undefined
    if (!cuenta) {
      return json({
        ok: false,
        necesitaCuenta: true,
        pregunta: (() => {
          const cand = candidatasDe(body.metodo!, usables)
          return cand.length < usables.length
            ? `¿Cuál de estas: ${listarCuentas(cand)}?`
            : `No encontré "${body.metodo}". Tienes ${listarCuentas(usables)}. ¿Cuál fue?`
        })(),
      })
    }
  }
  if (!cuenta && usables.length === 1) cuenta = usables[0]
  if (!cuenta && body.preguntarCuenta) {
    return json({
      ok: false,
      necesitaCuenta: true,
      pregunta: p.tipo === 'ingreso' ? '¿A qué cuenta te llegó?' : '¿Cómo pagaste?',
    })
  }
  if (!cuenta) {
    const desde = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
    const { data: usos } = await supabase.from('transacciones').select('cuenta_id').eq('user_id', userId).gte('fecha', desde).limit(1000)
    const conteo = new Map<string, number>()
    for (const u of usos ?? []) conteo.set(u.cuenta_id, (conteo.get(u.cuenta_id) ?? 0) + 1)
    const candidatas = cuentas.filter((c) => c.tipo !== 'tarjeta_credito')
    cuenta = [...(candidatas.length ? candidatas : cuentas)].sort((a, b) => (conteo.get(b.id) ?? 0) - (conteo.get(a.id) ?? 0))[0]
  }

  // ---- Categoría: historial > nombre dicho > pistas > la más usada ----
  const delTipo = categorias.filter((c) => c.tipo === p.tipo)
  let categoria: Categoria | undefined
  const textoClave = [p.descripcion, p.lugar].filter(Boolean).map((s) => normalizar(s!))
  if (textoClave.length) {
    const { data: previas } = await supabase
      .from('transacciones')
      .select('categoria_id, descripcion, lugar')
      .eq('user_id', userId)
      .eq('tipo', p.tipo)
      .not('categoria_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)
    const conteo = new Map<string, number>()
    for (const t of previas ?? []) {
      const d = t.descripcion ? normalizar(t.descripcion) : null
      const l = t.lugar ? normalizar(t.lugar) : null
      // misma descripción pesa más que mismo lugar
      if (p.descripcion && d && d === normalizar(p.descripcion)) conteo.set(t.categoria_id, (conteo.get(t.categoria_id) ?? 0) + 3)
      if (p.lugar && l && l === normalizar(p.lugar)) conteo.set(t.categoria_id, (conteo.get(t.categoria_id) ?? 0) + 1)
    }
    const mejor = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]
    if (mejor) categoria = delTipo.find((c) => c.id === mejor[0])
  }
  if (!categoria) {
    categoria = delTipo
      .filter((c) => normalizar(c.nombre).length >= 3 && contienePalabra(norm, normalizar(c.nombre)))
      .sort((a, b) => b.nombre.length - a.nombre.length)[0]
  }
  if (!categoria) {
    const texto = textoClave.join(' ') || norm
    for (const [re, nombres] of PISTAS) {
      if (!re.test(texto)) continue
      categoria = delTipo.find((c) => nombres.includes(normalizar(c.nombre)))
      if (categoria) break
    }
  }
  if (!categoria) {
    const { data: usos } = await supabase.from('transacciones').select('categoria_id').eq('user_id', userId).eq('tipo', p.tipo).not('categoria_id', 'is', null).order('created_at', { ascending: false }).limit(300)
    const conteo = new Map<string, number>()
    for (const u of usos ?? []) conteo.set(u.categoria_id, (conteo.get(u.categoria_id) ?? 0) + 1)
    const top = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]
    categoria = top ? delTipo.find((c) => c.id === top[0]) : undefined
  }

  const monto = p.monto
  const tax = p.tipo === 'egreso' && cuenta.four_x_mil ? Math.round(monto * 0.004) : 0
  const descripcion = p.descripcion ?? p.lugar
  const lugar = p.descripcion ? p.lugar : null
  const fecha = fechaLocal(p.ayer ? 1 : 0)

  const partes = [descripcion ?? (p.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')]
  if (lugar) partes.push(`en ${lugar}`)
  const nombreCuenta = cuenta.nombre.trim()
  let mensaje = `${p.tipo === 'ingreso' ? 'Listo, anoté el ingreso' : 'Listo'}: ${partes.join(' ')}, ${formatoMonto(monto, cuenta.moneda)}`
  if (categoria) mensaje += `, en ${categoria.nombre}`
  mensaje += p.tipo === 'ingreso' ? `, a ${nombreCuenta}.` : `, desde ${nombreCuenta}.`
  if (p.ayer) mensaje = mensaje.replace(/\.$/, ', con fecha de ayer.')

  if (body.prueba) {
    return json({ ok: true, prueba: true, mensaje, interpretado: { ...p, cuenta: nombreCuenta, categoria: categoria?.nombre ?? null, fecha, monto_4x1000: tax } })
  }

  const { data: nueva, error } = await supabase
    .from('transacciones')
    .insert({
      user_id: userId,
      tipo: p.tipo,
      monto,
      monto_4x1000: tax,
      categoria_id: categoria?.id ?? null,
      cuenta_id: cuenta.id,
      cuenta_destino_id: null,
      gasto_fijo_id: null,
      ingreso_fijo_id: null,
      descripcion,
      lugar,
      fecha,
    })
    .select('id')
    .single()
  if (error) {
    console.error('insert error', error)
    return json({ ok: false, mensaje: 'No pude guardar el movimiento. Intenta de nuevo en un momento.' }, 500)
  }
  await supabase.from('siri_tokens').update({ ultima_transaccion_id: nueva.id, last_used_at: new Date().toISOString() }).eq('id', tok.id)

  const notificacion = {
    titulo: p.tipo === 'ingreso' ? 'Ingreso anotado' : 'Gasto anotado',
    cuerpo: [partes.join(' '), formatoMonto(monto, cuenta.moneda), categoria?.nombre, nombreCuenta].filter(Boolean).join(' · ') + (p.ayer ? ' · ayer' : ''),
  }
  return json({ ok: true, mensaje, notificacion, id: nueva.id })
})

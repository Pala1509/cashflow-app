// Esta función la dispara un cron (ver 04_push_cron.sql) una vez al día,
// SIN que nadie tenga la app abierta — es justo lo que la corrige de las
// notificaciones "reactivas" (presupuestos, metas) que antes solo se
// revisaban si abrías la app.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendPush } from './fcm.ts'
import { calcularGastosHormigaProducto } from './gastosHormiga.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!
const sa = {
  project_id: Deno.env.get('FCM_PROJECT_ID')!,
  client_email: Deno.env.get('FCM_CLIENT_EMAIL')!,
  // Supabase guarda los secrets como una sola línea — los \n literales
  // hay que devolverlos a saltos de línea de verdad, si no la llave no
  // sirve para firmar nada.
  private_key: (Deno.env.get('FCM_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n'),
}

Deno.serve(async (req) => {
  // Esta función está desplegada con --no-verify-jwt (necesario porque
  // pg_cron la llama con la anon key, no con un JWT de usuario real), lo
  // que significa que Supabase deja pasar CUALQUIER petición sin revisar
  // nada. Sin este chequeo, cualquiera con la URL podía llamarla las veces
  // que quisiera — cada llamada lee la tabla de TODOS los usuarios con la
  // service_role key. Este header solo lo conoce el cron (ver
  // 02_cashflow_schema.sql), así que bloquea a cualquier otro llamador.
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('No autorizado', { status: 401 })
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()
  let enviados = 0

  async function mandarATodosLosTokens(userId: string, titulo: string, cuerpo: string, ruta: string) {
    const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId)
    for (const t of tokens ?? []) {
      const ok = await sendPush(sa, t.token, titulo, cuerpo, ruta)
      if (ok) enviados++
    }
  }

  // Ya se avisó antes de esto exacto (mismo presupuesto/meta) — no
  // vuelve a mandar el mismo aviso cada día que corra el cron.
  async function yaAvisado(userId: string, clave: string): Promise<boolean> {
    const { data } = await supabase.from('push_avisos_enviados').select('id').eq('user_id', userId).eq('clave', clave).maybeSingle()
    return Boolean(data)
  }
  async function marcarAvisado(userId: string, clave: string) {
    await supabase.from('push_avisos_enviados').insert({ user_id: userId, clave })
  }

  // ── 1. Presupuestos excedidos este mes ──────────────────────────────
  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('id, user_id, categoria_id, monto_limite, categorias(nombre)')
    .eq('mes', mes)
    .eq('anio', anio)

  for (const p of presupuestos ?? []) {
    const clave = `presupuesto:${p.id}:${mes}:${anio}`
    if (await yaAvisado(p.user_id, clave)) continue

    const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`
    const { data: transacciones } = await supabase
      .from('transacciones')
      .select('monto, monto_4x1000')
      .eq('user_id', p.user_id)
      .eq('categoria_id', p.categoria_id)
      .eq('tipo', 'egreso')
      .gte('fecha', inicioMes)

    const gastado = (transacciones ?? []).reduce((s, t) => s + t.monto + t.monto_4x1000, 0)
    if (gastado <= p.monto_limite) continue

    const catNombre = (p.categorias as unknown as { nombre: string } | null)?.nombre ?? 'esa categoría'
    await mandarATodosLosTokens(p.user_id, 'Superaste un presupuesto', `Ya llevas de más en ${catNombre} este mes.`, '/presupuestos')
    await marcarAvisado(p.user_id, clave)
  }

  // ── 2. Metas de ahorro cerca de cumplirse (90%+) ────────────────────
  const { data: metas } = await supabase
    .from('metas_ahorro')
    .select('id, user_id, nombre, monto_actual, monto_objetivo')
    .eq('estado', 'activa')

  for (const m of metas ?? []) {
    if (m.monto_objetivo <= 0) continue
    const pct = m.monto_actual / m.monto_objetivo
    if (pct < 0.9) continue

    const clave = `meta:${m.id}`
    if (await yaAvisado(m.user_id, clave)) continue

    await mandarATodosLosTokens(m.user_id, '¡Ya casi!', `Vas al ${Math.round(pct * 100)}% de tu meta "${m.nombre}".`, '/balance')
    await marcarAvisado(m.user_id, clave)
  }

  // ── 3. Gastos hormiga (Fase 2 — antes solo se detectaba en el
  // cliente, con la app abierta; ahora corre server-side todos los
  // días, igual que presupuestos y metas). Solo para usuarios Pro
  // (la sección de Control Total en Resumen ya está detrás de Pro) que
  // tengan el aviso activado. Se agrupa por quincena (1-15 / 16-fin de
  // mes) para no mandar el mismo aviso todos los días mientras el
  // hábito siga activo — mismo lenguaje de "quincena" que ya usa la UI.
  const { data: usuariosPro } = await supabase
    .from('profiles')
    .select('id')
    .eq('es_pro', true)
    .eq('notif_gastos_hormiga', true)

  const quincena = hoy.getDate() <= 15 ? 1 : 2
  const periodoKey = `${anio}-${mes}-Q${quincena}`
  const corte = new Date(hoy)
  corte.setDate(corte.getDate() - 15)
  const corteStr = `${corte.getFullYear()}-${String(corte.getMonth() + 1).padStart(2, '0')}-${String(corte.getDate()).padStart(2, '0')}`

  for (const u of usuariosPro ?? []) {
    const clave = `hormiga:${periodoKey}`
    if (await yaAvisado(u.id, clave)) continue

    const { data: transacciones } = await supabase
      .from('transacciones')
      .select('tipo, descripcion, categoria_id, monto, monto_4x1000, fecha')
      .eq('user_id', u.id)
      .eq('tipo', 'egreso')
      .gte('fecha', corteStr)

    const items = calcularGastosHormigaProducto(transacciones ?? [])
    if (items.length === 0) continue

    const top = items[0]
    const totalMonto = '$' + Math.round(top.total).toLocaleString('es-CO')
    await mandarATodosLosTokens(
      u.id,
      '¿Otra vez lo mismo?',
      `Van ${top.cantidad} compras de ${top.nombre} en 15 días — ${totalMonto} que pudiste ahorrar.`,
      '/resumen',
    )
    await marcarAvisado(u.id, clave)
  }

  // ── 4. Gastos fijos próximos a vencer ────────────────────────────────
  // Cada gasto fijo tiene un día del mes (ej. el 5) — hay que calcular
  // cuándo cae la PRÓXIMA vez (este mes si todavía no pasó, si no el
  // que viene), y avisar cuando falten `notif_dias_antes` días (o 2 por
  // defecto si el ítem no puso un valor propio). La clave de "ya
  // avisado" incluye la fecha exacta de esa ocurrencia — así el mismo
  // aviso no se repite mientras el cron siga corriendo dentro de la
  // ventana de aviso, pero si pasa un mes se vuelve a avisar para la
  // ocurrencia siguiente.
  function proximaOcurrencia(diaMes: number): Date {
    const candidato = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(diaMes, 28))
    // Corrige al último día real del mes si diaMes no existe (ej. 31 en
    // un mes de 30 días) — new Date con día > días del mes se desborda
    // al mes siguiente solo, así que se calcula aparte para evitar eso.
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    candidato.setDate(Math.min(diaMes, ultimoDiaMes))
    if (candidato < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
      const ultimoDiaMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0).getDate()
      candidato.setMonth(candidato.getMonth() + 1)
      candidato.setDate(Math.min(diaMes, ultimoDiaMesSiguiente))
    }
    return candidato
  }

  const { data: usuariosGastosFijos } = await supabase.from('profiles').select('id').eq('notif_gastos_fijos', true)

  for (const u of usuariosGastosFijos ?? []) {
    const { data: gastosFijos } = await supabase
      .from('gastos_fijos')
      .select('id, nombre, monto, dia_mes, notif_dias_antes')
      .eq('user_id', u.id)
      .eq('activo', true)

    for (const g of gastosFijos ?? []) {
      const diasAntes = g.notif_dias_antes ?? 2
      const ocurrencia = proximaOcurrencia(g.dia_mes)
      const diasRestantes = Math.round((ocurrencia.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
      if (diasRestantes < 0 || diasRestantes > diasAntes) continue

      const ocurrenciaStr = `${ocurrencia.getFullYear()}-${String(ocurrencia.getMonth() + 1).padStart(2, '0')}-${String(ocurrencia.getDate()).padStart(2, '0')}`
      const clave = `gastofijo:${g.id}:${ocurrenciaStr}`
      if (await yaAvisado(u.id, clave)) continue

      const montoStr = '$' + Math.round(g.monto).toLocaleString('es-CO')
      const cuando = diasRestantes === 0 ? 'hoy' : diasRestantes === 1 ? 'mañana' : `en ${diasRestantes} días`
      await mandarATodosLosTokens(u.id, 'Gasto fijo próximo', `${g.nombre} (${montoStr}) vence ${cuando}.`, '/balance')
      await marcarAvisado(u.id, clave)
    }
  }

  // ── 5. Deudas con fecha límite próxima ───────────────────────────────
  // Mismo patrón que gastos fijos, pero con fecha_limite fija (no hay
  // que calcular "próxima ocurrencia" — o ya tiene fecha, o no aplica).
  // El default de días de aviso viene de profiles.notif_deudas_dias_antes
  // (3 por defecto) si el ítem no puso el suyo propio.
  const { data: usuariosDeudas } = await supabase.from('profiles').select('id, notif_deudas_dias_antes').eq('notif_deudas', true)

  for (const u of usuariosDeudas ?? []) {
    const { data: deudas } = await supabase
      .from('deudas_creditos')
      .select('id, nombre, tipo, fecha_limite, notif_dias_antes')
      .eq('user_id', u.id)
      .eq('estado', 'activa')
      .not('fecha_limite', 'is', null)

    for (const d of deudas ?? []) {
      if (!d.fecha_limite) continue
      const diasAntes = d.notif_dias_antes ?? u.notif_deudas_dias_antes ?? 3
      const fechaLimite = new Date(d.fecha_limite + 'T00:00:00')
      const diasRestantes = Math.round((fechaLimite.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
      if (diasRestantes < 0 || diasRestantes > diasAntes) continue

      const clave = `deuda_vence:${d.id}:${d.fecha_limite}`
      if (await yaAvisado(u.id, clave)) continue

      const cuando = diasRestantes === 0 ? 'hoy' : diasRestantes === 1 ? 'mañana' : `en ${diasRestantes} días`
      const titulo = d.tipo === 'credito' ? 'Crédito por cobrar' : 'Deuda próxima a vencer'
      await mandarATodosLosTokens(u.id, titulo, `${d.nombre} vence ${cuando}.`, '/deudas')
      await marcarAvisado(u.id, clave)
    }
  }

  // ── 6. Recordatorio de anotar movimientos (solo si no anotaste nada
  // hoy) ────────────────────────────────────────────────────────────
  // El cron principal corre a las 9am Colombia (ver 02_cashflow_schema.sql,
  // job "enviar-push-diario") — a esa hora nadie ha tenido chance de
  // anotar nada todavía, así que esta sección solo debe activarse en el
  // cron NOCTURNO aparte (job "enviar-push-nocturno", ~8pm Colombia).
  // Se detecta comparando la hora actual en Colombia (UTC-5 fijo, sin
  // horario de verano) contra un umbral — así la misma función sirve
  // para los dos crons sin necesitar parámetros ni rutas distintas.
  const horaColombia = (hoy.getUTCHours() - 5 + 24) % 24
  if (horaColombia >= 19) {
    const hoyStr = `${anio}-${String(mes).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    const { data: usuariosRecordatorio } = await supabase
      .from('profiles')
      .select('id')
      .eq('notif_recordatorio_diario', true)

    for (const u of usuariosRecordatorio ?? []) {
      const clave = `recordatorio:${hoyStr}`
      if (await yaAvisado(u.id, clave)) continue

      const { count } = await supabase
        .from('transacciones')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.id)
        .eq('fecha', hoyStr)

      if ((count ?? 0) > 0) continue // ya anotó algo hoy, no molestar

      await mandarATodosLosTokens(
        u.id,
        '¿Cómo te fue hoy?',
        'No has anotado ningún movimiento hoy — no dejes que se te olvide.',
        '/movimiento/nuevo',
      )
      await marcarAvisado(u.id, clave)
    }
  }

  // ── 7. Dato informativo del dólar (periódico, una vez por semana) ──
  // Sin importar si cambió mucho o poco — el usuario pidió algo
  // informativo, no una alerta de variación brusca. La clave de "ya
  // avisado" incluye el número de semana ISO, así solo se manda una vez
  // por semana sin importar cuál de los 2 crons diarios la alcance primero.
  function semanaIso(d: Date): number {
    const fecha = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const diaSemana = fecha.getUTCDay() || 7
    fecha.setUTCDate(fecha.getUTCDate() + 4 - diaSemana)
    const inicioAnio = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1))
    return Math.ceil(((fecha.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7)
  }

  const claveSemana = `dolar:${hoy.getUTCFullYear()}-W${semanaIso(hoy)}`
  const { data: usuariosDolar } = await supabase.from('profiles').select('id').eq('notif_dolar', true)

  if ((usuariosDolar ?? []).length > 0) {
    const { data: tasaUsd } = await supabase
      .from('tasas_cambio')
      .select('tasa_cop, fecha')
      .eq('moneda', 'USD')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tasaUsd) {
      const tasaStr = '$' + Math.round(tasaUsd.tasa_cop).toLocaleString('es-CO')
      for (const u of usuariosDolar ?? []) {
        const clave = claveSemana
        if (await yaAvisado(u.id, clave)) continue
        await mandarATodosLosTokens(u.id, 'Dato del dólar', `El dólar hoy está en ${tasaStr} COP.`, '/inicio')
        await marcarAvisado(u.id, clave)
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados }), { headers: { 'Content-Type': 'application/json' } })
})

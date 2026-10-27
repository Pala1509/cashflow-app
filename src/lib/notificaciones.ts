import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { parseLocalDate } from './date'
import { calcularGastosHormigaProducto } from './gastosHormiga'
import type { GastoFijo, Presupuesto, Categoria, Transaccion, MetaAhorro, DeudaCredito } from './database.types'
import type { ResultadoFlujo } from './flujoCaja'

// IDs de notificación reservados por rango, para poder cancelar/reprogramar
// sin chocar entre tipos distintos.
const RANGO_GASTO_FIJO = 10_000 // 10000-19999
const RANGO_PRESUPUESTO = 20_000 // 20000-29999
const RANGO_META = 30_000 // 30000-39999
const RANGO_DEUDA = 40_000 // 40000-49999
const RANGO_HORMIGA = 50_000 // 50000-59999
const ID_FLUJO_CAJA = 60_000 // un solo aviso de flujo de caja a la vez

function idParaGastoFijo(gastoFijoId: string): number {
  return RANGO_GASTO_FIJO + hashCorto(gastoFijoId)
}

// Hash simple y determinístico — no necesita ser criptográfico, solo
// necesitamos que el mismo id siempre dé el mismo número pequeño.
function hashCorto(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9000
  return h
}

export async function tienePermiso(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const estado = await LocalNotifications.checkPermissions()
  return estado.display === 'granted'
}

export async function pedirPermiso(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const estado = await LocalNotifications.requestPermissions()
  return estado.display === 'granted'
}

// Recordatorios de gastos fijos: uno recurrente por cada gasto fijo activo,
// 2 días antes de su día de pago (dia_mes), cada mes. Simplificación
// honesta: se reprograma mensualmente sin importar la frecuencia exacta
// (quincenal/trimestral/etc.) — es mejor un recordatorio de más que uno
// que nunca llega para un gasto trimestral.
export async function programarGastosFijos(gastosFijos: GastoFijo[]) {
  if (!Capacitor.isNativePlatform()) return
  const pendientes = await LocalNotifications.getPending()
  const idsViejos = pendientes.notifications.filter((n) => n.id >= RANGO_GASTO_FIJO && n.id < RANGO_GASTO_FIJO + 9000).map((n) => n.id)
  if (idsViejos.length > 0) await LocalNotifications.cancel({ notifications: idsViejos.map((id) => ({ id })) })

  // Antes avisaba de TODOS los gastos fijos activos, fijo "2 días antes"
  // sin importar el día real (que además estaba fijo en 1, otro bug ya
  // corregido). Ahora es explícito: solo los que activaste el aviso por
  // este gasto en particular, con los días que tú elegiste.
  const activos = gastosFijos.filter((g) => g.activo && g.notif_dias_antes !== null)
  if (activos.length === 0) return

  const notifs = activos.map((g) => {
    const diaAviso = Math.max(g.dia_mes - (g.notif_dias_antes ?? 2), 1)
    return {
      id: idParaGastoFijo(g.id),
      title: 'Se acerca un pago',
      body: `${g.nombre} vence pronto — ${fmt(g.monto)}`,
      schedule: { on: { day: diaAviso, hour: 9, minute: 0 }, allowWhileIdle: true },
    }
  })
  await LocalNotifications.schedule({ notifications: notifs })
}

// Recordatorio de deudas y créditos con fecha límite: una notificación
// única (no recurrente, porque tienen fecha final real) programada
// "diasAntes" días antes de fecha_limite, a las 9am.
export async function programarDeudas(deudas: DeudaCredito[]) {
  if (!Capacitor.isNativePlatform()) return
  const pendientes = await LocalNotifications.getPending()
  const idsViejos = pendientes.notifications.filter((n) => n.id >= RANGO_DEUDA && n.id < RANGO_DEUDA + 9000).map((n) => n.id)
  if (idsViejos.length > 0) await LocalNotifications.cancel({ notifications: idsViejos.map((id) => ({ id })) })

  // Antes usaba un solo número global (de Perfil) para avisar TODAS las
  // deudas por igual. Ahora cada una decide por su cuenta al crearla o
  // editarla (ver CuentaNueva.tsx) — null significa que esa deuda en
  // particular no quiere aviso, sin importar el interruptor general.
  const activas = deudas.filter((d) => d.estado === 'activa' && d.fecha_limite && d.notif_dias_antes !== null)
  if (activas.length === 0) return

  const notifs: { id: number; title: string; body: string; schedule: { at: Date } }[] = []
  for (const d of activas) {
    const diasAntes = d.notif_dias_antes!
    const limite = parseLocalDate(d.fecha_limite!)
    const avisoEn = new Date(limite)
    avisoEn.setDate(avisoEn.getDate() - diasAntes)
    avisoEn.setHours(9, 0, 0, 0)
    if (avisoEn.getTime() <= Date.now()) continue // ya pasó esa fecha, no programar en el pasado

    const restante = d.capital - d.capital_pagado
    const cuando = diasAntes === 0 ? 'vence hoy' : diasAntes === 1 ? 'vence mañana' : `vence en ${diasAntes} días`
    notifs.push({
      id: RANGO_DEUDA + hashCorto(d.id),
      title: d.tipo === 'deuda' ? `${d.nombre} ${cuando}` : `Te deben: ${d.nombre} ${cuando}`,
      body: d.tipo === 'deuda' ? `Debes ${fmt(restante)}${d.tipo_interes !== 'sin_interes' ? ' + interés' : ''}.` : `Te deben ${fmt(restante)}.`,
      schedule: { at: avisoEn },
    })
  }
  if (notifs.length > 0) await LocalNotifications.schedule({ notifications: notifs })
}

// Presupuestos excedidos y metas cerca de cumplirse no se pueden programar
// con fecha (dependen de tus movimientos reales), así que se revisan cada
// vez que la app carga datos frescos, y se avisan al toque UNA sola vez por
// periodo — usando localStorage como "ya te avisé de esto" para no
// mandarte el mismo aviso en cada recarga.
function yaAvisado(key: string): boolean {
  return localStorage.getItem(`cf_notif_${key}`) === '1'
}
function marcarAvisado(key: string) {
  localStorage.setItem(`cf_notif_${key}`, '1')
}

export async function revisarPresupuestos(presupuestos: Presupuesto[], categorias: Categoria[], transacciones: Transaccion[]) {
  if (!Capacitor.isNativePlatform()) return
  const hoy = new Date()
  const mesKey = `${hoy.getFullYear()}-${hoy.getMonth()}`

  for (const p of presupuestos) {
    const gastado = transacciones
      .filter((t) => {
        if (t.tipo !== 'egreso' || t.categoria_id !== p.categoria_id) return false
        const d = parseLocalDate(t.fecha)
        return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
      })
      .reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

    if (gastado <= p.monto_limite) continue
    const key = `presupuesto:${p.id}:${mesKey}`
    if (yaAvisado(key)) continue

    const cat = categorias.find((c) => c.id === p.categoria_id)
    await LocalNotifications.schedule({
      notifications: [{
        id: RANGO_PRESUPUESTO + hashCorto(key),
        title: 'Presupuesto superado',
        body: `Ya gastaste ${fmt(gastado)} en ${cat?.nombre ?? 'esa categoría'} — el límite era ${fmt(p.monto_limite)}.`,
        schedule: { at: new Date(Date.now() + 1500) },
      }],
    })
    marcarAvisado(key)
  }
}

export async function revisarMetas(metas: MetaAhorro[]) {
  if (!Capacitor.isNativePlatform()) return
  for (const m of metas) {
    if (m.estado !== 'activa' || m.monto_objetivo <= 0) continue
    const pct = (m.monto_actual / m.monto_objetivo) * 100
    if (pct < 90) continue
    const key = `meta:${m.id}:90`
    if (yaAvisado(key)) continue

    await LocalNotifications.schedule({
      notifications: [{
        id: RANGO_META + hashCorto(m.id),
        title: '¡Ya casi!',
        body: `Vas al ${Math.round(pct)}% de tu meta "${m.nombre}" — te falta muy poco.`,
        schedule: { at: new Date(Date.now() + 1500) },
      }],
    })
    marcarAvisado(key)
  }
}

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Gastos hormiga no se programan con fecha (dependen de cuántas veces
// compres lo mismo) — se revisan cada vez que hay movimientos frescos, y
// avisa "al acto": apenas un producto sube de 3 a 4, de 4 a 5, etc.,
// manda un aviso nuevo — no espera a un chequeo diario ni nada por el
// estilo, corre en el momento en que guardas el gasto que lo dispara.
export async function revisarGastosHormiga(transacciones: Transaccion[]) {
  if (!Capacitor.isNativePlatform()) return
  const resumen = calcularGastosHormigaProducto(transacciones)
  for (const item of resumen.items) {
    // La key incluye la cantidad — así cada vez que compras uno más y el
    // contador sube, es un umbral nuevo y sí te vuelve a avisar. No es
    // "ya te avisé de esto una vez y nunca más".
    const key = `hormiga:${item.nombre.toLowerCase()}:${item.cantidad}`
    if (yaAvisado(key)) continue

    await LocalNotifications.schedule({
      notifications: [{
        id: RANGO_HORMIGA + hashCorto(key),
        title: `¿Otra vez ${item.nombre}?`,
        body: `Van ${item.cantidad} en los últimos 15 días — ${fmt(item.total)} en total.`,
        schedule: { at: new Date(Date.now() + 1500) },
      }],
    })
    marcarAvisado(key)
  }
}

// Aviso de flujo de caja: si la proyección ve un hueco (saldo en rojo), avisa
// unos días ANTES de que empiece, a las 9am. Es una sola notificación (id
// fijo): cada vez que cambian los datos se reemplaza o se cancela, así que
// si arreglas el hueco (pasas plata de ahorros, registras un ingreso) el
// aviso viejo desaparece solo.
const DIAS_AVISO_FLUJO = 3
export async function programarAvisoFlujo(
  hueco: ResultadoFlujo['hueco'],
  textos: { titulo: string; cuerpo: (fecha: string, monto: string) => string },
) {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_FLUJO_CAJA }] })
  if (!hueco) return

  const desde = parseLocalDate(hueco.desde)
  const avisoEn = new Date(desde)
  avisoEn.setDate(avisoEn.getDate() - DIAS_AVISO_FLUJO)
  avisoEn.setHours(9, 0, 0, 0)

  const fechaTxt = parseLocalDate(hueco.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const cuerpo = textos.cuerpo(fechaTxt, fmt(hueco.falta))

  if (avisoEn.getTime() > Date.now()) {
    await LocalNotifications.schedule({ notifications: [{ id: ID_FLUJO_CAJA, title: textos.titulo, body: cuerpo, schedule: { at: avisoEn, allowWhileIdle: true } }] })
    return
  }
  // El hueco ya está a menos de 3 días: avisa ya, una sola vez por hueco.
  const key = `flujo:${hueco.desde}`
  if (yaAvisado(key)) return
  await LocalNotifications.schedule({ notifications: [{ id: ID_FLUJO_CAJA, title: textos.titulo, body: cuerpo, schedule: { at: new Date(Date.now() + 1500) } }] })
  marcarAvisado(key)
}

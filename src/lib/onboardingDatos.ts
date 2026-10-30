import { supabase } from './supabase'
import { todayLocal } from './date'
import { pagosPrestaciones } from './prestaciones'

// Datos del onboarding guiado. Se llenan ANTES de crear la cuenta (las
// preguntas van primero y el registro al final), así que viven en el
// celular hasta que haya sesión: si Supabase pide confirmar el correo,
// quedan guardados aquí y se aplican la primera vez que la persona entra.

export type TipoIngreso = 'nomina' | 'independiente' | 'ambos' | 'otro'
export type TipoCuentaOnb = 'efectivo' | 'billetera_digital' | 'cuenta_bancaria' | 'monedero'

export interface CuentaOnb { key: string; nombre: string; tipo: TipoCuentaOnb; banco: string | null; marcada: boolean; saldo: string; principal?: boolean }
export interface FijoOnb { nombre: string; icono: string; marcado: boolean; monto: string; dia: string }

export interface DatosOnboarding {
  objetivos: string[]
  tipoIngreso: TipoIngreso | null
  salario: string
  frecuencia: 'quincenal' | 'mensual'
  prestaciones: boolean
  banco: string | null
  bancoOtro: string
  cuentas: CuentaOnb[]
  tarjeta: { on: boolean; banco: string; cupo: string; debe: string; dia: string }
  prestamo: { on: boolean; entidad: string; debe: string; cuota: string }
  deboA: { on: boolean; quien: string; monto: string }
  meDeben: { on: boolean; quien: string; monto: string }
  fijos: FijoOnb[]
}

// ---- utilidades de plata ----
export const soloDigitos = (s: string) => s.replace(/\D/g, '')
export const num = (s: string) => Number(soloDigitos(s) || 0)
export const fmt = (n: number) => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-CO')
export const conPuntos = (s: string) => { const d = soloDigitos(s); return d ? Number(d).toLocaleString('es-CO') : '' }

export const conNomina = (d: DatosOnboarding) => d.tipoIngreso === 'nomina' || d.tipoIngreso === 'ambos'
export const bancoPrincipalDe = (d: DatosOnboarding) => (d.banco === 'Otro' ? d.bancoOtro.trim() || null : d.banco)

export function resumenOnboarding(d: DatosOnboarding) {
  const cuentas = d.cuentas.filter((c) => c.marcada)
  const tienes = cuentas.reduce((s, c) => s + num(c.saldo), 0)
  const debes = (d.tarjeta.on ? num(d.tarjeta.debe) : 0) + (d.prestamo.on ? num(d.prestamo.debe) : 0) + (d.deboA.on ? num(d.deboA.monto) : 0)
  const teDeben = d.meDeben.on ? num(d.meDeben.monto) : 0
  const fijos = d.fijos.filter((f) => f.marcado && num(f.monto) > 0)
  const nDeudas = [d.tarjeta.on, d.prestamo.on, d.deboA.on, d.meDeben.on].filter(Boolean).length
  return { tienes, debes, teDeben, patrimonio: tienes + teDeben - debes, nCuentas: cuentas.length, nDeudas, nFijos: fijos.length }
}

// Las 4 fechas más próximas: pagos fijos, tarjeta, nómina y prima/cesantías.
export function proximasFechas(d: DatosOnboarding) {
  const hoy = new Date()
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const enMes = (dia: number) => {
    const f = new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(dia, 1), 28))
    if (f < base) f.setMonth(f.getMonth() + 1)
    return f
  }
  const out: { fecha: Date; texto: string; monto: string; color: string }[] = []
  for (const f of d.fijos) if (f.marcado && num(f.monto) > 0) out.push({ fecha: enMes(Number(f.dia) || 1), texto: f.nombre, monto: '−' + fmt(num(f.monto)), color: 'coral' })
  if (d.tarjeta.on && num(d.tarjeta.debe) > 0) out.push({ fecha: enMes(Number(d.tarjeta.dia) || 5), texto: `Pago tarjeta ${d.tarjeta.banco}`.trim(), monto: 'Pendiente', color: 'coral' })
  const salario = num(d.salario)
  if (conNomina(d) && salario > 0) {
    out.push({ fecha: enMes(d.frecuencia === 'quincenal' ? 15 : 30), texto: d.frecuencia === 'quincenal' ? 'Quincena' : 'Nómina', monto: '+' + fmt(d.frecuencia === 'quincenal' ? salario / 2 : salario), color: 'lime' })
    if (d.prestaciones) {
      const p = pagosPrestaciones(salario, base, new Date(base.getFullYear() + 1, base.getMonth(), base.getDate()))[0]
      if (p) {
        const [y, m, dd] = p.fecha.split('-').map(Number)
        const nombre = p.tipo === 'intereses_cesantias' ? 'Intereses de cesantías' : p.tipo === 'prima_junio' ? 'Prima de junio' : 'Prima de diciembre'
        out.push({ fecha: new Date(y, m - 1, dd), texto: nombre, monto: '≈ +' + fmt(p.monto), color: 'lime' })
      }
    }
  }
  return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(0, 4)
}

// ---- guardado local mientras no hay sesión ----
const LLAVE = 'cashflow_onboarding_pendiente'

// datos = null → la persona dijo "Lo hago después" en el registro.
export function guardarPendiente(email: string, datos: DatosOnboarding | null) {
  try { localStorage.setItem(LLAVE, JSON.stringify({ email: email.trim().toLowerCase(), datos, saltado: datos === null })) } catch { /* sin almacenamiento */ }
}

// Solo se devuelve si es de esta misma cuenta (por si otra persona entra
// en el mismo celular antes de que se aplique). 'saltado' = no quiso
// responder las preguntas; null = no hay nada pendiente.
export function leerPendiente(email: string | null | undefined): DatosOnboarding | 'saltado' | null {
  try {
    const crudo = localStorage.getItem(LLAVE)
    if (!crudo) return null
    const p = JSON.parse(crudo) as { email: string; datos: DatosOnboarding | null; saltado?: boolean }
    if (email && p.email && p.email !== email.trim().toLowerCase()) return null
    if (p.saltado || !p.datos) return 'saltado'
    return p.datos
  } catch {
    return null
  }
}

export function borrarPendiente() {
  try { localStorage.removeItem(LLAVE) } catch { /* nada */ }
}

const ICONO_TIPO: Record<TipoCuentaOnb, string> = { efectivo: 'cash', billetera_digital: 'device-mobile', cuenta_bancaria: 'building-bank', monedero: 'piggy-bank' }
const COLOR_TIPO: Record<TipoCuentaOnb, string> = { efectivo: 'lime', billetera_digital: 'lavender', cuenta_bancaria: 'yellow', monedero: 'teal' }

// Crea todo en Supabase. Se puede llamar más de una vez sin duplicar:
// si el perfil ya dice onboarding_guiado_completado, no hace nada.
export async function aplicarOnboarding(userId: string, d: DatosOnboarding): Promise<void> {
  const { data: perfil } = await supabase.from('profiles').select('onboarding_guiado_completado').eq('id', userId).single()
  if (perfil?.onboarding_guiado_completado) return

  const hoy = todayLocal()
  const salario = num(d.salario)
  const nomina = conNomina(d)

  // Al registrarse, la base de datos ya crea una cuenta "Efectivo" en $0
  // (trigger handle_new_user). Se reutiliza esa en vez de crear otra.
  const { data: efectivoAuto } = await supabase.from('cuentas').select('id').eq('user_id', userId).eq('tipo', 'efectivo').eq('nombre', 'Efectivo').limit(1).maybeSingle()
  const marcadas = d.cuentas.filter((c) => c.marcada)
  const efectivoElegido = marcadas.find((c) => c.tipo === 'efectivo' && c.key === 'efectivo')
  if (efectivoAuto) {
    if (efectivoElegido) {
      const r = await supabase.from('cuentas').update({ saldo: num(efectivoElegido.saldo) }).eq('id', efectivoAuto.id)
      if (r.error) throw r.error
    } else {
      await supabase.from('cuentas').delete().eq('id', efectivoAuto.id)
    }
  }

  const nuevas: Record<string, unknown>[] = marcadas
    .filter((c) => !(efectivoAuto && c === efectivoElegido))
    .map((c) => ({
      user_id: userId, tipo: c.tipo, nombre: c.nombre.trim() || 'Cuenta', saldo: num(c.saldo),
      icono: ICONO_TIPO[c.tipo], color: COLOR_TIPO[c.tipo], four_x_mil: false, activa: true,
      es_ahorro: c.tipo === 'monedero', banco: c.banco, moneda: 'COP',
    }))
  if (d.tarjeta.on) {
    // En CashFlow la tarjeta guarda el cupo DISPONIBLE en `saldo`:
    // lo que se debe = cupo_total − saldo.
    const debe = num(d.tarjeta.debe)
    const cupo = Math.max(num(d.tarjeta.cupo), debe)
    const banco = d.tarjeta.banco.trim()
    nuevas.push({
      user_id: userId, tipo: 'tarjeta_credito', nombre: banco ? `Tarjeta ${banco}` : 'Tarjeta de crédito',
      saldo: cupo - debe, cupo_total: cupo, icono: 'credit-card', color: 'coral', four_x_mil: false, activa: true,
      banco: banco || null, dia_pago: Number(d.tarjeta.dia) || null, moneda: 'COP',
    })
  }
  if (nuevas.length) {
    const r = await supabase.from('cuentas').insert(nuevas)
    if (r.error) throw r.error
  }

  const deudas: Record<string, unknown>[] = []
  if (d.prestamo.on && num(d.prestamo.debe) > 0) deudas.push({
    user_id: userId, tipo: 'deuda', subtipo: 'Préstamo bancario', nombre: d.prestamo.entidad.trim() ? `Crédito ${d.prestamo.entidad.trim()}` : 'Crédito',
    entidad: d.prestamo.entidad.trim() || null, capital: num(d.prestamo.debe), tipo_interes: 'sin_interes', cuota_mensual: num(d.prestamo.cuota) || null,
    fecha_inicio: hoy, estado: 'activa',
  })
  if (d.deboA.on && num(d.deboA.monto) > 0) deudas.push({
    user_id: userId, tipo: 'deuda', subtipo: 'Préstamo con un tercero', nombre: d.deboA.quien.trim() ? `Le debo a ${d.deboA.quien.trim()}` : 'Deuda personal',
    capital: num(d.deboA.monto), tipo_interes: 'sin_interes', fecha_inicio: hoy, estado: 'activa',
  })
  if (d.meDeben.on && num(d.meDeben.monto) > 0) deudas.push({
    user_id: userId, tipo: 'credito', subtipo: 'Préstamo a un amigo o familiar', nombre: d.meDeben.quien.trim() ? `Me debe ${d.meDeben.quien.trim()}` : 'Me deben',
    capital: num(d.meDeben.monto), tipo_interes: 'sin_interes', fecha_inicio: hoy, estado: 'activa',
  })
  if (deudas.length) {
    const r = await supabase.from('deudas_creditos').insert(deudas)
    if (r.error) throw r.error
  }

  const gastos = d.fijos.filter((f) => f.marcado && num(f.monto) > 0).map((f) => ({
    user_id: userId, nombre: f.nombre, monto: num(f.monto), dia_mes: Math.min(Math.max(Number(f.dia) || 1, 1), 31),
    frecuencia: 'mensual', icono: f.icono, activo: true, notif_dias_antes: 2,
  }))
  if (gastos.length) {
    const r = await supabase.from('gastos_fijos').insert(gastos)
    if (r.error) throw r.error
  }

  // "Nómina" como ingreso fijo: así la detecta el motor de prima y
  // cesantías (detectarSalarioMensual) y entra al flujo de caja.
  if (nomina && salario > 0) {
    const r = await supabase.from('ingresos_fijos').insert({
      user_id: userId, nombre: 'Nómina', monto: d.frecuencia === 'quincenal' ? Math.round(salario / 2) : salario,
      dia_mes: d.frecuencia === 'quincenal' ? 15 : 30, frecuencia: d.frecuencia, icono: 'cash', activo: true,
    })
    if (r.error) throw r.error
  }

  const r = await supabase.from('profiles').update({
    objetivos: d.objetivos, tipo_ingreso: d.tipoIngreso, banco_principal: bancoPrincipalDe(d),
    salario_mensual: nomina && salario > 0 ? salario : null,
    recibe_prestaciones: nomina ? d.prestaciones : false,
    onboarding_guiado_completado: true,
  }).eq('id', userId)
  if (r.error) throw r.error
}

export async function marcarOnboardingSaltado(userId: string) {
  await supabase.from('profiles').update({ onboarding_guiado_completado: true }).eq('id', userId)
}

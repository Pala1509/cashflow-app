import { useEffect, useMemo, useRef, useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { X, ArrowLeft, Delete, Check, Info, MapPin, Pencil, Trash2, WifiOff, CalendarDays, ShoppingCart, Home, Scale, Undo2, ArrowLeftRight, LayoutGrid, Plus, Lock, Search, Star, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useMovimientosFrecuentes } from '../hooks/useMovimientosFrecuentes'
import { sortCategorias } from '../lib/categorias'
import { todayLocal, parseLocalDate } from '../lib/date'
import CenterModal from '../components/CenterModal'
import CalendarPicker from '../components/CalendarPicker'
import { cacheGet, cacheSet, outboxAdd } from '../lib/offlineDb'
import type { Categoria, Cuenta, Transaccion, MovimientoFrecuente } from '../lib/database.types'
import { ICONS, COLORS, GRUPOS } from './Cuentas'
import { EditarCategoriaModal, NuevaCategoriaModal } from './Categorias'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { calcularGastosHormigaProducto } from '../lib/gastosHormiga'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// La descripción se sigue guardando como un solo texto ("Monster Energy
// x3, Papitas naturales") — mismo formato que ya lee gastos hormiga — así
// que al editar un movimiento viejo, esto lo reconstruye de vuelta a la
// lista de productos con su cantidad, en vez de mostrar el texto crudo.
function parseDescripcionAItems(desc: string): { descripcion: string; cantidad: number }[] {
  if (!desc.trim()) return [{ descripcion: '', cantidad: 1 }]
  const partes = desc.split(',').map((p) => p.trim()).filter(Boolean)
  return partes.map((parte) => {
    const m = parte.match(/^(.*?)\s*x\s*(\d+)$/i)
    if (m) return { descripcion: m[1].trim(), cantidad: Math.max(1, parseInt(m[2], 10)) }
    return { descripcion: parte, cantidad: 1 }
  })
}

// Junta la lista de vuelta al texto que se guarda — "x1" no se escribe
// (es el caso normal, no hace falta aclararlo), solo aparece la cantidad
// cuando de verdad compraste más de uno.
function itemsADescripcion(items: { descripcion: string; cantidad: number }[]): string {
  return items
    .filter((i) => i.descripcion.trim())
    .map((i) => (i.cantidad > 1 ? `${i.descripcion.trim()} x${i.cantidad}` : i.descripcion.trim()))
    .join(', ')
}

// A diferencia de .split(' ')[0], esto no se rompe si el nombre tiene un
// espacio de más al inicio o en el medio (algo que el navegador "esconde"
// solo al mostrar texto plano, pero no cuando se corta con JS).
function firstWord(nombre: string | null | undefined, idioma: 'es' | 'en' = 'es'): string {
  const limpio = (nombre ?? '').trim()
  return limpio ? limpio.split(/\s+/)[0] : (idioma === 'en' ? 'Account' : 'Cuenta')
}

function shiftDate(fecha: string, days: number): string {
  const d = parseLocalDate(fecha)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function friendlyDate(fecha: string, idioma: 'es' | 'en' = 'es'): string {
  const hoy = todayLocal()
  if (fecha === hoy) return idioma === 'en' ? 'Today' : 'Hoy'
  if (fecha === shiftDate(hoy, -1)) return idioma === 'en' ? 'Yesterday' : 'Ayer'
  if (fecha === shiftDate(hoy, -2)) return idioma === 'en' ? '2 days ago' : 'Antier'
  const d = parseLocalDate(fecha)
  const MESES = idioma === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return idioma === 'en'
    ? `${MESES[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : ''}`
    : `${d.getDate()} de ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''}`
}

type Step = 'monto' | 'detalles' | 'confirmacion'
type Tipo = 'ingreso' | 'egreso' | 'transferencia'
type TipoMovimiento = 'normal' | 'fijo' | 'deuda' | 'credito'

export default function MovimientoNuevo() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const tipoInicial = searchParams.get('tipo') === 'ingreso' ? 'ingreso' : 'egreso'
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const { categorias, cuentas, deudas, gastosFijos, ingresosFijos, transacciones, topCategorias, reload, esPro } = useFinanzas()
  const { frecuentes, guardar: guardarFrecuenteEnBD, registrarUso } = useMovimientosFrecuentes()
  const loadedRef = useRef(false)

  const [step, setStep] = useState<Step>('monto')
  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('normal')
  const [gastoFijoId, setGastoFijoId] = useState<string | null>(null)
  const [ingresoFijoId, setIngresoFijoId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [desc, setDesc] = useState('')
  const [items, setItems] = useState<{ descripcion: string; cantidad: number }[]>([{ descripcion: '', cantidad: 1 }])
  const [cantidadEditIndex, setCantidadEditIndex] = useState<number | null>(null)
  const [cantidadDraft, setCantidadDraft] = useState('1')
  const [lugar, setLugar] = useState('')
  const [fecha, setFecha] = useState(todayLocal())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string | null>(null)
  const [showTransferPanel, setShowTransferPanel] = useState(false)
  const [transferOrigenId, setTransferOrigenId] = useState<string | null>(null)
  const [transferMonto, setTransferMonto] = useState('')
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferDone, setTransferDone] = useState<{ origenNombre: string; monto: number } | null>(null)
  const [showCatSheet, setShowCatSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState<{ tx: string; tax: number; total: number; cuentaNombre: string; catNombre: string; pendingSync: boolean; hormigaAviso: string | null } | null>(null)
  const [guardarFrecuente, setGuardarFrecuente] = useState(false)
  const [nombreFrecuente, setNombreFrecuente] = useState('')

  // La lista de productos es lo que se edita en pantalla; "desc" (lo que
  // de verdad se guarda) se recalcula solo cada vez que cambia algo acá —
  // así el resto del código (guardar, resumen, detección de hormiga) no
  // tiene que saber que por dentro ahora es una lista.
  useEffect(() => {
    setDesc(itemsADescripcion(items))
  }, [items])

  function actualizarItem(i: number, campo: 'descripcion' | 'cantidad', valor: string | number) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)))
  }

  function agregarItem() {
    setItems((prev) => [...prev, { descripcion: '', cantidad: 1 }])
  }

  function borrarItem(i: number) {
    setItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length > 0 ? next : [{ descripcion: '', cantidad: 1 }]
    })
  }

  useEffect(() => {
    if (!isEdit || loadedRef.current || transacciones.length === 0) return
    const tx = transacciones.find((t) => t.id === id)
    if (!tx) return
    setTipo(tx.tipo)
    setAmount(String(tx.monto))
    setCategoriaId(tx.categoria_id)
    setDesc(tx.descripcion || '')
    setItems(parseDescripcionAItems(tx.descripcion || ''))
    setLugar(tx.lugar || '')
    setFecha(tx.fecha)
    setCuentaId(tx.cuenta_id)
    setCuentaDestinoId(tx.cuenta_destino_id)
    setGastoFijoId(tx.gasto_fijo_id)
    setTipoMovimiento(tx.gasto_fijo_id ? 'fijo' : 'normal')
    setStep('detalles')
    loadedRef.current = true
  }, [isEdit, id, transacciones])

  const accent = tipo === 'egreso'
    ? { fg: 'var(--coral)', dim: 'var(--coral-dim)', text: '#2b0906' }
    : tipo === 'transferencia'
    ? { fg: 'var(--lavender)', dim: 'var(--lavender-dim)', text: '#1c1330' }
    : { fg: 'var(--lime)', dim: 'var(--lime-dim)', text: 'var(--lime-text)' }

  const top3 = useMemo(() => {
    if (tipo === 'transferencia') return []
    const usadas = topCategorias(tipo, 3)
    if (usadas.length >= 3) return usadas
    // Cuenta nueva sin historial: rellena con categorías reales (no solo "Otros")
    const yaIncluidas = new Set(usadas.map((c) => c.id))
    const relleno = sortCategorias(categorias.filter((c) => c.tipo === tipo && c.icono !== 'dots' && !yaIncluidas.has(c.id)))
    return [...usadas, ...relleno].slice(0, 3)
  }, [tipo, transacciones, categorias])
  const catsOfTipo = tipo === 'transferencia' ? [] : sortCategorias(categorias.filter((c) => c.tipo === tipo))
  const selectedCat = categoriaId ? categorias.find((c) => c.id === categoriaId) : null
  const isTop3 = selectedCat && top3.find((c) => c.id === selectedCat.id)

  const amt = Number(amount || 0)
  const selAcc = cuentaId ? cuentas.find((c) => c.id === cuentaId) : null
  const cuentaDestino = cuentaDestinoId ? cuentas.find((c) => c.id === cuentaDestinoId) : null
  const applyFour = tipo === 'egreso' && selAcc?.four_x_mil
  const tax = applyFour ? Math.round(amt * 0.004) : 0
  const total = amt + tax

  // ---- Transferencias: el 4x1000 también aplica si la cuenta ORIGEN lo
  // tiene activo (antes se guardaba siempre en 0, así que nunca se
  // descontaba en una transferencia). Y si el destino es una tarjeta de
  // crédito, no se puede "pagar" más de lo que realmente se debe — eso
  // dejaba el cupo usado en negativo, que no tiene sentido.
  const transferFour = tipo === 'transferencia' && selAcc?.four_x_mil
  const transferTax = transferFour ? Math.round(amt * 0.004) : 0
  const transferTotalOrigen = amt + transferTax
  const destinoEsTarjeta = cuentaDestino?.tipo === 'tarjeta_credito'
  const deudaTarjetaDestino = destinoEsTarjeta ? Math.max((cuentaDestino!.cupo_total ?? 0) - cuentaDestino!.saldo, 0) : null
  const excedeDeudaTarjeta = destinoEsTarjeta && deudaTarjetaDestino !== null && amt > deudaTarjetaDestino
  const dejariaNegativo = tipo === 'transferencia' && selAcc && transferTotalOrigen > selAcc.saldo
  // Mismo chequeo para un egreso normal (no transferencia) — una cuenta
  // de efectivo/débito/ahorro en negativo no tiene sentido (no es como
  // una tarjeta de crédito, que sí puede deber). fmt() convierte según
  // la moneda de la cuenta, ya se usa en el resto del formulario.
  const egresoDejariaNegativo = tipo === 'egreso' && selAcc && selAcc.tipo !== 'tarjeta_credito' && (selAcc.saldo - total) < 0

  function pressKey(k: string) {
    if (k === 'back') setAmount((a) => a.slice(0, -1))
    else if (amount.length < 9) setAmount((a) => a + k)
  }

  async function save() {
    if (!user) return
    if (tipo === 'transferencia') {
      if (!cuentaId || !cuentaDestinoId || cuentaId === cuentaDestinoId) return
      if (dejariaNegativo || excedeDeudaTarjeta) return
    } else if (!cuentaId || (tipoMovimiento === 'normal' && !categoriaId) || (tipoMovimiento === 'fijo' && tipo === 'egreso' && !gastoFijoId) || (tipoMovimiento === 'fijo' && tipo === 'ingreso' && !ingresoFijoId)) {
      return
    }
    if (egresoDejariaNegativo && selAcc) {
      const saldoFinal = selAcc.saldo - total
      const sufijo = selAcc.moneda && selAcc.moneda !== 'COP' ? ` ${selAcc.moneda}` : ''
      const confirmado = await appConfirm(t('mov_confirmar_negativo', { cuenta: selAcc.nombre, saldo: fmt(saldoFinal) + sufijo }), { danger: true })
      if (!confirmado) return
    }
    // BUG REAL encontrado: si activabas "Guardar como frecuente" pero no
    // alcanzabas a escribir el nombre, el movimiento se guardaba normal y
    // el frecuente se saltaba en silencio — sin ningún aviso, parecía que
    // la función de frecuentes simplemente no funcionaba. Ahora se frena
    // acá antes de guardar nada, para que sea imposible perderlo sin darse
    // cuenta.
    if (!isEdit && tipo !== 'transferencia' && guardarFrecuente && !nombreFrecuente.trim()) {
      await appAlert(t('mov_frecuente_falta_nombre'))
      return
    }
    setSaving(true)

    const payload = tipo === 'transferencia'
      ? {
          tipo: 'transferencia' as const,
          monto: amt,
          monto_4x1000: transferTax,
          categoria_id: null,
          cuenta_id: cuentaId!,
          cuenta_destino_id: cuentaDestinoId,
          gasto_fijo_id: null,
          ingreso_fijo_id: null,
          descripcion: desc || null,
          lugar: null,
          fecha,
        }
      : {
          tipo,
          monto: amt,
          monto_4x1000: tax,
          categoria_id: tipoMovimiento === 'fijo'
            ? (tipo === 'egreso' ? gastosFijos.find((g) => g.id === gastoFijoId)?.categoria_id : ingresosFijos.find((i) => i.id === ingresoFijoId)?.categoria_id) ?? categoriaId
            : categoriaId,
          cuenta_id: cuentaId,
          cuenta_destino_id: null,
          gasto_fijo_id: tipoMovimiento === 'fijo' && tipo === 'egreso' ? gastoFijoId : null,
          ingreso_fijo_id: tipoMovimiento === 'fijo' && tipo === 'ingreso' ? ingresoFijoId : null,
          descripcion: desc || (tipoMovimiento === 'fijo'
            ? (tipo === 'egreso' ? gastosFijos.find((g) => g.id === gastoFijoId)?.nombre : ingresosFijos.find((i) => i.id === ingresoFijoId)?.nombre)
            : null) || null,
          lugar: lugar || null,
          fecha,
        }

    if (isEdit) {
      if (!navigator.onLine) {
        setSaving(false)
        await appAlert(t('mov_error_editar_offline'))
        return
      }
      const { error } = await supabase.from('transacciones').update(payload).eq('id', id)
      setSaving(false)
      if (error) { await appAlert(t('mov_error_guardar', { msg: error.message })); return }
      setSaved({ tx: desc || catInfoName(categoriaId), tax, total, cuentaNombre: selAcc?.nombre ?? '', catNombre: catInfoName(categoriaId), pendingSync: false, hormigaAviso: null })
      await reload()
      setStep('confirmacion')
      return
    }

    // Movimiento nuevo: si no hay señal, se guarda local y se sincroniza solo después.
    const fullPayload = { ...payload, id: crypto.randomUUID(), user_id: user.id }
    let pendingSync = false

    if (navigator.onLine) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const { error } = await supabase.from('transacciones').insert(fullPayload as never).abortSignal(controller.signal)
        clearTimeout(timeout)
        if (error) {
          const parece_red = /fetch|network|conexi[oó]n|abort/i.test(error.message)
          if (!parece_red) { setSaving(false); await appAlert(t('mov_error_guardar', { msg: error.message })); return }
          pendingSync = true
        }
      } catch {
        clearTimeout(timeout)
        pendingSync = true
      }
    } else {
      pendingSync = true
    }

    if (pendingSync) {
      // Las transferencias offline necesitan tocar 2 cuentas — por ahora,
      // para no arriesgar inconsistencias, solo encolamos ingresos/egresos.
      if (tipo === 'transferencia') {
        setSaving(false)
        await appAlert(t('mov_error_transferencias_offline'))
        return
      }
      await outboxAdd({ id: fullPayload.id, table: 'transacciones', op: 'insert', payload: fullPayload, createdAt: Date.now() })
      await applyOptimisticLocal(fullPayload as Omit<Transaccion, 'created_at'>)
    }

    // "Al acto": si esto que acabas de guardar hace que un producto llegue
    // a 3+ veces en 15 días, avisa ya mismo en esta misma pantalla — no
    // hay que esperar a la notificación nativa (que además solo funciona
    // en el APK, no probando en el navegador).
    let hormigaAviso: string | null = null
    if (tipo === 'egreso' && desc) {
      const resumen = calcularGastosHormigaProducto([...transacciones, fullPayload as unknown as Transaccion])
      const descNorm = desc.toLowerCase()
      const match = resumen.items.find((it) => descNorm.includes(it.nombre.toLowerCase()))
      if (match && match.cantidad >= 3) {
        hormigaAviso = t('mov_hormiga_van_veces', { n: match.cantidad, producto: match.nombre, monto: fmt(match.total) })
      }
    }

    // Si activó "Guardar como frecuente" — se guarda con los mismos
    // datos que se acaban de confirmar. Solo aplica a ingreso/egreso
    // normales (no transferencias, no al editar uno ya existente).
    // Usa payload.categoria_id (ya resuelta) en vez de categoriaId a
    // secas — para un "Pago de un gasto fijo" categoriaId sigue null
    // (esa pantalla no la pide, la trae el gasto fijo), así que guardar
    // el crudo dejaba el frecuente sin categoría. También guarda a cuál
    // gasto/ingreso fijo corresponde, para que el toque rápido del chip
    // sepa completar eso también en vez de caer siempre al flujo manual.
    if (!isEdit && tipo !== 'transferencia' && guardarFrecuente && nombreFrecuente.trim()) {
      await guardarFrecuenteEnBD({
        nombre: nombreFrecuente.trim(), tipo, monto: amt, categoriaId: payload.categoria_id, cuentaId, descripcion: desc || null, lugar: lugar || null,
        gastoFijoId: tipoMovimiento === 'fijo' && tipo === 'egreso' ? gastoFijoId : null,
        ingresoFijoId: tipoMovimiento === 'fijo' && tipo === 'ingreso' ? ingresoFijoId : null,
      })
    }

    setSaving(false)
    setSaved({
      tx: tipo === 'transferencia' ? `${selAcc?.nombre ?? ''} → ${cuentaDestino?.nombre ?? ''}` : (desc || catInfoName(categoriaId)),
      tax,
      total,
      cuentaNombre: selAcc?.nombre ?? '',
      catNombre: tipo === 'transferencia' ? t('mov_transferencia') : catInfoName(categoriaId),
      pendingSync,
      hormigaAviso,
    })
    await reload()
    setStep('confirmacion')
  }

  // Actualiza la copia local (cache) para que el movimiento y el saldo de la
  // cuenta se vean reflejados de una, aunque todavía no haya llegado a Supabase.
  async function doQuickTransfer() {
    const monto = Number(transferMonto || 0)
    if (!user || !transferOrigenId || !cuentaId || monto <= 0) return
    if (!navigator.onLine) { await appAlert(t('mov_error_mover_offline')); return }
    const origenAcc = cuentas.find((c) => c.id === transferOrigenId)
    const four = origenAcc?.four_x_mil ? Math.round(monto * 0.004) : 0
    if (origenAcc && monto + four > origenAcc.saldo) {
      await appAlert(t('mov_saldo_insuficiente', { cuenta: origenAcc.nombre, monto: fmt(monto), extra: four ? t('mov_mas_4x1000', { monto: fmt(four) }) : '' }))
      return
    }
    setTransferSaving(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const { error } = await supabase.from('transacciones').insert({
        id: crypto.randomUUID(), user_id: user.id, tipo: 'transferencia' as const,
        monto, monto_4x1000: four, categoria_id: null, cuenta_id: transferOrigenId, cuenta_destino_id: cuentaId,
        gasto_fijo_id: null, ingreso_fijo_id: null, descripcion: t('mov_movida_cubrir_pago'), lugar: null, fecha,
      } as never).abortSignal(controller.signal)
      clearTimeout(timeout)
      if (error) { setTransferSaving(false); await appAlert(t('mov_error_mover_plata', { msg: error.message })); return }
    } catch {
      clearTimeout(timeout)
      setTransferSaving(false)
      await appAlert(t('mov_error_mover_conexion'))
      return
    }
    const origenNombre = cuentas.find((c) => c.id === transferOrigenId)?.nombre ?? ''
    await reload()
    setTransferSaving(false)
    setShowTransferPanel(false)
    setTransferDone({ origenNombre, monto })
    setTransferOrigenId(null)
    setTransferMonto('')
  }

  async function applyOptimisticLocal(tx: Omit<Transaccion, 'created_at'>) {
    if (!user) return
    const txKey = `${user.id}:transacciones`
    const cuentasKey = `${user.id}:cuentas`
    const cachedTx = (await cacheGet<Transaccion[]>(txKey)) ?? []
    await cacheSet(txKey, [tx as Transaccion, ...cachedTx])

    const cachedCuentas = (await cacheGet<Cuenta[]>(cuentasKey)) ?? []
    const delta = tx.tipo === 'ingreso' ? tx.monto : -(tx.monto + tx.monto_4x1000)
    await cacheSet(cuentasKey, cachedCuentas.map((c) => (c.id === tx.cuenta_id ? { ...c, saldo: c.saldo + delta } : c)))
  }

  async function removeTx() {
    if (!id) return
    if (!(await appConfirm(t('mov_confirmar_borrar'), { danger: true }))) return
    setDeleting(true)
    const { error } = await supabase.from('transacciones').delete().eq('id', id)
    setDeleting(false)
    if (error) { await appAlert(t('mov_error_borrar', { msg: error.message })); return }
    await reload()
    navigate(-1)
  }

  function catInfoName(id: string | null) {
    if (!id) return t('mov_otros')
    return nombreCategoria(categorias.find((c) => c.id === id)?.nombre, idioma) || t('mov_otros')
  }

  // Rellena todo con los datos del frecuente y deja el paso de Detalles
  // para que el usuario complete a mano lo que falte — es el respaldo de
  // usarFrecuenteRapido() de abajo, para cuando la cuenta ya no existe, o
  // cuando el gasto/ingreso fijo asociado ya no existe o se desactivó.
  // Si el frecuente venía de un gasto/ingreso fijo, igual precarga esa
  // selección (en vez de caer siempre a "Gasto normal") para que sea un
  // toque menos incluso en este camino de respaldo.
  function usarFrecuente(f: MovimientoFrecuente) {
    setTipo(f.tipo)
    setAmount(String(f.monto))
    setCategoriaId(f.categoria_id)
    setItems(parseDescripcionAItems(f.descripcion || ''))
    setLugar(f.lugar || '')
    setCuentaId(f.cuenta_id)
    setTipoMovimiento(f.gasto_fijo_id || f.ingreso_fijo_id ? 'fijo' : 'normal')
    setGastoFijoId(f.gasto_fijo_id ?? null)
    setIngresoFijoId(f.ingreso_fijo_id ?? null)
    registrarUso(f.id)
    setStep('detalles')
  }

  // Tocar un chip de "frecuente" guarda el movimiento DE UNA, sin pasar
  // por Detalles — ese es el punto de un frecuente (agregar rápido).
  // Usa exactamente los mismos datos que se guardaron cuando se creó
  // (monto, cuenta, descripción, y categoría O el gasto/ingreso fijo
  // asociado — un frecuente creado desde "Pago de un gasto fijo" no
  // trae categoría propia, la categoría la pone el gasto fijo). Reimplementa
  // el mismo insert que save() en vez de reutilizarlo directamente porque
  // save() lee sus valores del estado del formulario (amount, cuentaId,
  // desc...), que se actualiza de forma asíncrona — llamarlo justo
  // después de un setState todavía vería los valores viejos. Si algún
  // día cambia la lógica de guardado en save(), hay que replicar el
  // cambio acá también.
  async function usarFrecuenteRapido(f: MovimientoFrecuente) {
    if (!user) return
    const cuenta = f.cuenta_id ? cuentas.find((c) => c.id === f.cuenta_id) : null
    const esFijo = Boolean(f.gasto_fijo_id || f.ingreso_fijo_id)
    const gastoFijo = f.gasto_fijo_id ? gastosFijos.find((g) => g.id === f.gasto_fijo_id) : null
    const ingresoFijo = f.ingreso_fijo_id ? ingresosFijos.find((i) => i.id === f.ingreso_fijo_id) : null
    const fijoValido = f.gasto_fijo_id ? Boolean(gastoFijo?.activo) : f.ingreso_fijo_id ? Boolean(ingresoFijo?.activo) : true
    const categoriaValida = f.categoria_id ? categorias.some((c) => c.id === f.categoria_id) : false
    const categoriaResuelta = esFijo ? (gastoFijo?.categoria_id ?? ingresoFijo?.categoria_id ?? null) : f.categoria_id

    // Cuenta borrada, o gasto/ingreso fijo borrado/desactivado, o (para
    // un frecuente normal) categoría borrada — no hay con qué autoguardar
    // completo, así que cae al flujo de siempre.
    if (!cuenta || (esFijo && !fijoValido) || (!esFijo && !categoriaValida)) {
      usarFrecuente(f)
      return
    }

    const monto = f.monto
    const four = f.tipo === 'egreso' && cuenta.four_x_mil
    const taxCalc = four ? Math.round(monto * 0.004) : 0
    const totalCalc = monto + taxCalc
    const dejariaNegativo = f.tipo === 'egreso' && cuenta.tipo !== 'tarjeta_credito' && (cuenta.saldo - totalCalc) < 0

    if (dejariaNegativo) {
      const sufijo = cuenta.moneda && cuenta.moneda !== 'COP' ? ` ${cuenta.moneda}` : ''
      const confirmado = await appConfirm(t('mov_confirmar_negativo', { cuenta: cuenta.nombre, saldo: fmt(cuenta.saldo - totalCalc) + sufijo }), { danger: true })
      if (!confirmado) return
    }

    // Refleja los datos en el resto de la pantalla por si algo falla y
    // el usuario necesita corregir algo a mano.
    setTipo(f.tipo)
    setAmount(String(f.monto))
    setCategoriaId(categoriaResuelta)
    setItems(parseDescripcionAItems(f.descripcion || ''))
    setLugar(f.lugar || '')
    setCuentaId(f.cuenta_id)
    setTipoMovimiento(esFijo ? 'fijo' : 'normal')
    setGastoFijoId(f.gasto_fijo_id ?? null)
    setIngresoFijoId(f.ingreso_fijo_id ?? null)
    setSaving(true)

    const descripcionResuelta = f.descripcion || (esFijo ? (gastoFijo?.nombre ?? ingresoFijo?.nombre ?? null) : null) || null

    const payload = {
      tipo: f.tipo,
      monto,
      monto_4x1000: taxCalc,
      categoria_id: categoriaResuelta,
      cuenta_id: cuenta.id,
      cuenta_destino_id: null,
      gasto_fijo_id: f.gasto_fijo_id ?? null,
      ingreso_fijo_id: f.ingreso_fijo_id ?? null,
      descripcion: descripcionResuelta,
      lugar: f.lugar || null,
      fecha: todayLocal(),
    }
    const fullPayload = { ...payload, id: crypto.randomUUID(), user_id: user.id }
    let pendingSync = false

    if (navigator.onLine) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const { error } = await supabase.from('transacciones').insert(fullPayload as never).abortSignal(controller.signal)
        clearTimeout(timeout)
        if (error) {
          const parece_red = /fetch|network|conexi[oó]n|abort/i.test(error.message)
          if (!parece_red) { setSaving(false); await appAlert(t('mov_error_guardar', { msg: error.message })); return }
          pendingSync = true
        }
      } catch {
        clearTimeout(timeout)
        pendingSync = true
      }
    } else {
      pendingSync = true
    }

    if (pendingSync) {
      await outboxAdd({ id: fullPayload.id, table: 'transacciones', op: 'insert', payload: fullPayload, createdAt: Date.now() })
      await applyOptimisticLocal(fullPayload as Omit<Transaccion, 'created_at'>)
    }

    let hormigaAviso: string | null = null
    if (f.tipo === 'egreso' && payload.descripcion) {
      const resumen = calcularGastosHormigaProducto([...transacciones, fullPayload as unknown as Transaccion])
      const descNorm = payload.descripcion.toLowerCase()
      const match = resumen.items.find((it) => descNorm.includes(it.nombre.toLowerCase()))
      if (match && match.cantidad >= 3) {
        hormigaAviso = t('mov_hormiga_van_veces', { n: match.cantidad, producto: match.nombre, monto: fmt(match.total) })
      }
    }

    registrarUso(f.id)
    setSaving(false)
    setSaved({
      tx: payload.descripcion || catInfoName(categoriaResuelta),
      tax: taxCalc,
      total: totalCalc,
      cuentaNombre: cuenta.nombre,
      catNombre: catInfoName(categoriaResuelta),
      pendingSync,
      hormigaAviso,
    })
    await reload()
    setStep('confirmacion')
  }

  // ---------------------------- PASO 1: MONTO ----------------------------
  if (step === 'monto') {
    return (
      <div className="flex h-full flex-col">
        <Header title={isEdit ? t('mov_editar_titulo') : t('mov_nuevo_titulo')} onClose={() => navigate(-1)} />

        <div className="mx-5 mt-3.5 flex flex-shrink-0 gap-2">
          <TypePill active={tipo === 'ingreso'} activeStyle={{ background: 'var(--lime-dim)', color: 'var(--lime)', borderColor: 'var(--lime)' }} onClick={() => setTipo('ingreso')}>
            {t('mov_ingreso')}
          </TypePill>
          <TypePill active={tipo === 'egreso'} activeStyle={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderColor: 'var(--coral)' }} onClick={() => setTipo('egreso')}>
            {t('mov_egreso')}
          </TypePill>
          {!isEdit && (
            <TypePill active={tipo === 'transferencia'} activeStyle={{ background: 'var(--lavender-dim)', color: 'var(--lavender)', borderColor: 'var(--lavender)' }} onClick={() => setTipo('transferencia')}>
              {t('mov_transferencia')}
            </TypePill>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div className="flex items-baseline gap-1 text-[42px] font-bold font-display font-mono" style={{ color: accent.fg }}>
            <span className="text-lg font-medium" style={{ color: 'var(--text-3)' }}>$</span>
            {amount ? Number(amount).toLocaleString('es-CO') : '0'}
            <span style={{ width: 2, height: 32, background: accent.fg, marginLeft: 2, display: 'inline-block' }} />
          </div>

          {!amount && tipo !== 'transferencia' && frecuentes.some((f) => f.tipo === tipo) && (
            <div className="mt-5 flex w-full gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
              {frecuentes.filter((f) => f.tipo === tipo).map((f) => (
                <button
                  key={f.id}
                  onClick={() => usarFrecuenteRapido(f)}
                  className="flex flex-shrink-0 flex-col items-start gap-0.5 rounded-2xl px-3.5 py-2.5 text-left transition-transform duration-75 active:scale-95"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    <Star size={10} style={{ color: accent.fg, flexShrink: 0 }} />
                    <span className="max-w-[120px] truncate">{f.nombre}</span>
                  </div>
                  <div className="font-mono text-[10.5px]" style={{ color: 'var(--text-3)' }}>{fmt(f.monto)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid flex-shrink-0 grid-cols-3 gap-2 px-5 pb-4.5 pt-1.5">
          {['1','2','3','4','5','6','7','8','9'].map((n) => (
            <button key={n} onClick={() => pressKey(n)} className="flex h-13.5 items-center justify-center rounded-2xl text-lg font-medium font-mono transition-transform duration-75 active:scale-90 active:brightness-125" style={{ height: 54, background: 'var(--card)' }}>
              {n}
            </button>
          ))}
          <button onClick={() => pressKey('back')} className="flex h-13.5 items-center justify-center rounded-2xl transition-transform duration-75 active:scale-90 active:brightness-125" style={{ height: 54, background: 'var(--card)' }}>
            <Delete size={18} />
          </button>
          <button onClick={() => pressKey('0')} className="flex h-13.5 items-center justify-center rounded-2xl text-lg font-medium font-mono transition-transform duration-75 active:scale-90 active:brightness-125" style={{ height: 54, background: 'var(--card)' }}>
            0
          </button>
          <button
            onClick={() => amt > 0 && setStep('detalles')}
            disabled={amt <= 0}
            className="flex h-13.5 items-center justify-center rounded-2xl text-sm font-bold transition-transform duration-75 active:scale-90 disabled:opacity-40 disabled:active:scale-100"
            style={{ height: 54, background: accent.fg, color: accent.text }}
          >
            {t('mov_siguiente')}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------- PASO 2: DETALLES ----------------------------
  if (step === 'detalles') {
    const hoy = todayLocal()
    const ayer = shiftDate(hoy, -1)
    const antier = shiftDate(hoy, -2)
    const esFechaCustom = fecha !== hoy && fecha !== ayer && fecha !== antier

    // ---- Flujo especial: TRANSFERENCIA (Desde / Hacia, sin categoría) ----
    if (tipo === 'transferencia') {
      return (
        <div className="flex h-full flex-col">
          <Header title={t('mov_transferencia')} onBack={() => (isEdit ? navigate(-1) : setStep('monto'))} onClose={() => navigate(-1)} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <div className="flex min-h-full flex-col justify-center py-4">
            <button onClick={() => setStep('monto')} className="flex w-full flex-col items-center gap-1 py-2.5">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold font-display font-mono" style={{ color: accent.fg }}>{fmt(amt)}</div>
                <Pencil size={14} style={{ color: 'var(--text-3)' }} />
              </div>
              <div className="max-w-[220px] text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('mov_se_mueve_entre_cuentas')}</div>
            </button>

            <FieldLabel>{t('mov_desde')}</FieldLabel>
            <div className="flex flex-wrap gap-2.5">
              {cuentas.filter((c) => c.tipo !== 'tarjeta_credito').map((a) => (
                <WalletChip key={a.id} active={cuentaId === a.id} onClick={() => setCuentaId(a.id)} cuenta={a} disabled={a.id === cuentaDestinoId} idioma={idioma} />
              ))}
            </div>

            <FieldLabel>{t('mov_hacia')}</FieldLabel>
            <div className="flex flex-wrap gap-2.5">
              {cuentas.map((a) => (
                <WalletChip key={a.id} active={cuentaDestinoId === a.id} onClick={() => setCuentaDestinoId(a.id)} cuenta={a} disabled={a.id === cuentaId} esTarjeta={a.tipo === 'tarjeta_credito'} idioma={idioma} />
              ))}
            </div>

            <FieldLabel>{t('mov_fecha')}</FieldLabel>
            <div className="mb-2.5 grid grid-cols-4 gap-2">
              <DateChip active={fecha === hoy} accent={accent} onClick={() => setFecha(hoy)}>{t('mov_hoy')}</DateChip>
              <DateChip active={fecha === ayer} accent={accent} onClick={() => setFecha(ayer)}>{t('mov_ayer')}</DateChip>
              <DateChip active={fecha === antier} accent={accent} onClick={() => setFecha(antier)}>{t('mov_antier')}</DateChip>
              <DateChip active={esFechaCustom} accent={accent} icon={CalendarDays} onClick={() => setShowDatePicker(true)}>
                {esFechaCustom ? friendlyDate(fecha, idioma) : t('mov_que_dia')}
              </DateChip>
            </div>

            <FieldLabel>{t('mov_nota_opcional')}</FieldLabel>
            <InputRow icon={<Pencil size={16} />} placeholder={t('mov_placeholder_nota')} value={desc} onChange={setDesc} />

            {selAcc && cuentaDestino && !excedeDeudaTarjeta && !dejariaNegativo && (
              <div className="mt-3.5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                {t('mov_transfer_resumen', {
                  origen: selAcc.nombre,
                  saldoOrigen: fmt(selAcc.saldo - transferTotalOrigen),
                  tax: transferTax > 0 ? t('mov_incluye_4x1000', { monto: fmt(transferTax) }) : '',
                  destino: cuentaDestino.nombre,
                  saldoDestino: fmt(cuentaDestino.saldo + amt),
                })}
              </div>
            )}

            {dejariaNegativo && selAcc && (
              <div className="mt-3.5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                {t('mov_solo_tiene_negativo', { cuenta: selAcc.nombre, saldo: fmt(selAcc.saldo), extra: transferTax > 0 ? t('mov_con_4x1000_necesitas', { monto: fmt(transferTax), total: fmt(transferTotalOrigen) }) : '' })}
              </div>
            )}

            {excedeDeudaTarjeta && cuentaDestino && (
              <div className="mt-3.5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                {t('mov_no_pagar_mas_de_lo_que_debes', { cuenta: cuentaDestino.nombre, monto: fmt(deudaTarjetaDestino ?? 0) })}
              </div>
            )}

            <button
              onClick={save}
              disabled={!cuentaId || !cuentaDestinoId || cuentaId === cuentaDestinoId || saving || dejariaNegativo || excedeDeudaTarjeta}
              className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
              style={{ background: accent.fg, color: accent.text }}
            >
              {saving ? t('mov_guardando') : t('mov_guardar_transferencia')}
            </button>
            </div>
          </div>

          {showDatePicker && (
            <CenterModal onClose={() => setShowDatePicker(false)} maxWidth={320}>
              <CalendarPicker value={fecha} onChange={(v) => { setFecha(v); setShowDatePicker(false) }} maxDate={todayLocal()} />
            </CenterModal>
          )}
        </div>
      )
    }

    // ---- Flujo especial: abono a una deuda (redirige al flujo que ya existe) ----
    if (tipo === 'egreso' && tipoMovimiento === 'deuda') {
      const misDeudas = deudas.filter((d) => d.tipo === 'deuda')
      return (
        <div className="flex h-full flex-col">
          <Header title={t('mov_cual_deuda_titulo')} onBack={() => (isEdit ? navigate(-1) : setTipoMovimiento('normal'))} onClose={() => navigate(-1)} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              {t('mov_llevamos_registrar_pago')}
            </div>
            {misDeudas.length === 0 && <div className="py-8 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('mov_sin_deudas_activas')}</div>}
            {misDeudas.map((d) => (
              <button key={d.id} onClick={() => navigate(`/deuda/${d.id}/pago`)} className="mb-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                  <Scale size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{d.nombre}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('mov_debes_monto', { monto: fmt(d.capital - d.capital_pagado) })}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // ---- Flujo especial: cobro de una cuenta por cobrar (redirige al flujo que ya existe) ----
    if (tipo === 'ingreso' && tipoMovimiento === 'credito') {
      const misCreditos = deudas.filter((d) => d.tipo === 'credito')
      return (
        <div className="flex h-full flex-col">
          <Header title={t('mov_cual_credito_titulo')} onBack={() => (isEdit ? navigate(-1) : setTipoMovimiento('normal'))} onClose={() => navigate(-1)} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              {t('mov_llevamos_registrar_cobro')}
            </div>
            {misCreditos.length === 0 && <div className="py-8 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('mov_nadie_te_debe')}</div>}
            {misCreditos.map((c) => (
              <button key={c.id} onClick={() => navigate(`/deuda/${c.id}/pago`)} className="mb-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
                  <Undo2 size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{c.nombre}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('mov_te_deben_monto', { monto: fmt(c.capital - c.capital_pagado) })}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // ---- Flujo normal: ingreso / egreso ----
    return (
      <div className="flex h-full flex-col">
        <Header title={isEdit ? t('mov_editar_titulo') : t('mov_detalles')} onBack={() => (isEdit ? navigate(-1) : setStep('monto'))} onClose={() => navigate(-1)} />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <button onClick={() => setStep('monto')} className="flex w-full flex-col items-center gap-1 py-2.5">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold font-display font-mono" style={{ color: accent.fg }}>{fmt(amt)}</div>
              <Pencil size={14} style={{ color: 'var(--text-3)' }} />
            </div>
            <div className="text-[11px]" style={{ color: accent.fg }}>{tipo === 'ingreso' ? t('mov_ingreso') : t('mov_egreso')}</div>
          </button>

          {tipo === 'egreso' && !isEdit && (
            <>
              <FieldLabel>{t('mov_tipo_de_movimiento')}</FieldLabel>
              <div className="flex flex-col gap-2">
                <TipoMovBtn active={tipoMovimiento === 'normal'} onClick={() => setTipoMovimiento('normal')} icon={ShoppingCart} title={t('mov_gasto_normal')} sub={t('mov_gasto_normal_sub')} />
                <TipoMovBtn active={tipoMovimiento === 'fijo'} onClick={() => setTipoMovimiento('fijo')} icon={Home} title={t('mov_pago_gasto_fijo')} sub={t('mov_pago_gasto_fijo_sub')} color="var(--yellow)" dim="var(--yellow-dim)" />
                <TipoMovBtn active={false} onClick={() => setTipoMovimiento('deuda')} icon={Scale} title={t('mov_abono_deuda')} sub={t('mov_abono_deuda_sub')} color="var(--coral)" dim="var(--coral-dim)" />
              </div>
            </>
          )}

          {tipo === 'ingreso' && !isEdit && (
            <>
              <FieldLabel>{t('mov_tipo_de_movimiento')}</FieldLabel>
              <div className="flex flex-col gap-2">
                <TipoMovBtn active={tipoMovimiento === 'normal'} onClick={() => setTipoMovimiento('normal')} icon={ShoppingCart} title={t('mov_ingreso_normal')} sub={t('mov_ingreso_normal_sub')} />
                <TipoMovBtn active={tipoMovimiento === 'fijo'} onClick={() => setTipoMovimiento('fijo')} icon={Home} title={t('mov_cobro_ingreso_fijo')} sub={t('mov_cobro_ingreso_fijo_sub')} color="var(--lime)" dim="var(--lime-dim)" />
                <TipoMovBtn active={false} onClick={() => setTipoMovimiento('credito')} icon={Undo2} title={t('mov_cuenta_por_cobrar')} sub={t('mov_cuenta_por_cobrar_sub')} color="var(--yellow)" dim="var(--yellow-dim)" />
              </div>
            </>
          )}

          {tipoMovimiento === 'fijo' && tipo === 'egreso' ? (
            <>
              <FieldLabel>{t('mov_cual_gasto_fijo')}</FieldLabel>
              {gastosFijos.length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('mov_sin_gastos_fijos')}</div>}
              <div className="flex flex-col gap-2">
                {gastosFijos.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGastoFijoId(g.id)}
                    className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
                    style={{ background: gastoFijoId === g.id ? 'var(--yellow-dim)' : 'var(--card)', border: `1.5px solid ${gastoFijoId === g.id ? 'var(--yellow)' : 'var(--line)'}` }}
                  >
                    <span className="flex-1 text-[12.5px] font-medium">{g.nombre}</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{fmt(g.monto)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-2xl px-3.5 py-3 text-[10.5px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                {t('mov_vincular_gasto_fijo')}
              </div>
            </>
          ) : tipoMovimiento === 'fijo' && tipo === 'ingreso' ? (
            <>
              <FieldLabel>{t('mov_cual_ingreso_fijo')}</FieldLabel>
              {ingresosFijos.length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('mov_sin_ingresos_fijos')}</div>}
              <div className="flex flex-col gap-2">
                {ingresosFijos.map((ing) => (
                  <button
                    key={ing.id}
                    onClick={() => setIngresoFijoId(ing.id)}
                    className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
                    style={{ background: ingresoFijoId === ing.id ? 'var(--lime-dim)' : 'var(--card)', border: `1.5px solid ${ingresoFijoId === ing.id ? 'var(--lime)' : 'var(--line)'}` }}
                  >
                    <span className="flex-1 text-[12.5px] font-medium">{ing.nombre}</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{fmt(ing.monto)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-2xl px-3.5 py-3 text-[10.5px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                {t('mov_vincular_ingreso_fijo')}
              </div>
            </>
          ) : (
            <>
              <FieldLabel>{t('mov_categoria_mas_usadas')}</FieldLabel>
              <div className="grid grid-cols-4 gap-2.5">
                {top3.map((c) => (
                  <CatChip key={c.id} active={categoriaId === c.id} accent={accent} icon={ICONS[c.icono] ?? ICONS.otros} color={c.color} onClick={() => setCategoriaId(c.id)}>
                    {nombreCategoria(c.nombre, idioma)}
                  </CatChip>
                ))}
                <CatChip
                  active={Boolean(selectedCat && !isTop3)}
                  accent={accent}
                  dashed={!(selectedCat && !isTop3)}
                  icon={selectedCat && !isTop3 ? (ICONS[selectedCat.icono] ?? ICONS.otros) : LayoutGrid}
                  color={selectedCat && !isTop3 ? selectedCat.color : undefined}
                  onClick={() => setShowCatSheet(true)}
                >
                  {selectedCat && !isTop3 ? nombreCategoria(selectedCat.nombre, idioma) : t('mov_mas_categorias')}
                </CatChip>
              </div>
            </>
          )}

          <FieldLabel>{t('mov_fecha')}</FieldLabel>
          <div className="mb-2.5 grid grid-cols-4 gap-2">
            <DateChip active={fecha === hoy} accent={accent} onClick={() => setFecha(hoy)}>{t('mov_hoy')}</DateChip>
            <DateChip active={fecha === ayer} accent={accent} onClick={() => setFecha(ayer)}>{t('mov_ayer')}</DateChip>
            <DateChip active={fecha === antier} accent={accent} onClick={() => setFecha(antier)}>{t('mov_antier')}</DateChip>
            <DateChip active={esFechaCustom} accent={accent} icon={CalendarDays} onClick={() => setShowDatePicker(true)}>
              {esFechaCustom ? friendlyDate(fecha, idioma) : t('mov_que_dia')}
            </DateChip>
          </div>

          <FieldLabel>{tipo === 'egreso' ? t('mov_que_compraste') : t('mov_detalles')}</FieldLabel>
          {items.map((item, i) => (
            <div key={i} className="mb-2 flex items-center gap-1.5">
              <div className="flex flex-1 items-center gap-2 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <Pencil size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <input
                  value={item.descripcion}
                  onChange={(e) => actualizarItem(i, 'descripcion', e.target.value)}
                  placeholder={tipo === 'egreso' ? t('mov_placeholder_producto') : t('mov_placeholder_descripcion')}
                  className="w-full bg-transparent text-[13px] outline-none"
                  style={{ color: 'var(--text-1)' }}
                />
              </div>
              {tipo === 'egreso' && (
                <button
                  onClick={() => { setCantidadEditIndex(i); setCantidadDraft('') }}
                  className="flex h-11.5 w-12 flex-shrink-0 items-center justify-center rounded-2xl font-mono text-[13px] font-bold"
                  style={{
                    height: 46, width: 48,
                    background: item.cantidad > 1 ? accent.dim : 'var(--card)',
                    border: `1px solid ${item.cantidad > 1 ? accent.fg : 'var(--line)'}`,
                    color: item.cantidad > 1 ? accent.fg : 'var(--text-2)',
                  }}
                >
                  ×{item.cantidad}
                </button>
              )}
              {items.length > 1 && (
                <button onClick={() => borrarItem(i)} className="flex h-11.5 w-7 flex-shrink-0 items-center justify-center" style={{ color: 'var(--text-3)' }}>
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={agregarItem}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[12px] font-semibold"
            style={{ border: '1.5px dashed var(--line)', color: accent.fg }}
          >
            <Plus size={14} /> {tipo === 'egreso' ? t('mov_agregar_producto') : t('mov_agregar_otro')}
          </button>
          {tipo === 'egreso' && items.filter((i) => i.descripcion.trim()).length > 1 && (
            <div className="mb-3 text-[10px]" style={{ color: 'var(--text-3)' }}>{t('mov_se_guarda_como', { texto: itemsADescripcion(items) })}</div>
          )}
          <InputRow icon={<MapPin size={16} />} placeholder={t('mov_lugar')} value={lugar} onChange={setLugar} />

          <FieldLabel>
            {t('mov_billetera_obligatorio')} <span style={{ color: accent.fg, textTransform: 'none', letterSpacing: 0 }}>{t('mov_obligatorio')}</span>
          </FieldLabel>
          <div className="flex flex-wrap gap-2.5">
            {cuentas.map((a) => (
              <WalletChip key={a.id} active={cuentaId === a.id} onClick={() => { setCuentaId(a.id); setTransferDone(null); setShowTransferPanel(false) }} cuenta={a} esTarjeta={a.tipo === 'tarjeta_credito'} idioma={idioma} />
            ))}
          </div>

          {selAcc?.tipo === 'tarjeta_credito' && (
            <div className="mt-2 rounded-xl px-3 py-2 text-[10.5px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
              <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
              {tipo === 'egreso' ? t('mov_tarjeta_egreso_nota') : t('mov_tarjeta_ingreso_nota')}
            </div>
          )}

          {!isEdit && cuentaId && (
            <>
              {!showTransferPanel && !transferDone && (
                <button
                  onClick={() => setShowTransferPanel(true)}
                  className="mt-2.5 flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
                  style={{ background: 'var(--lavender-dim)', border: '1px dashed var(--lavender)' }}
                >
                  <ArrowLeftRight size={16} style={{ color: 'var(--lavender)', flexShrink: 0 }} />
                  <div>
                    <div className="text-[11.5px] font-semibold" style={{ color: 'var(--lavender)' }}>{t('mov_necesitas_mover_plata')}</div>
                    <div className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{t('mov_transfiere_de_otra', { cuenta: firstWord(selAcc?.nombre, idioma) })}</div>
                  </div>
                </button>
              )}

              {showTransferPanel && (
                <div className="mt-2.5 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--lavender)' }}>
                  <div className="mb-3 flex items-center gap-2">
                    <ArrowLeftRight size={14} style={{ color: 'var(--lavender)' }} />
                    <div className="text-[12px] font-bold" style={{ color: 'var(--lavender)' }}>{t('mov_mover_plata_a', { cuenta: firstWord(selAcc?.nombre, idioma) })}</div>
                    <button onClick={() => { setShowTransferPanel(false); setTransferOrigenId(null); setTransferMonto('') }} className="ml-auto" style={{ color: 'var(--text-3)' }}>
                      <X size={15} />
                    </button>
                  </div>

                  <div className="mb-1.5 text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('mov_desde')}</div>
                  <div className="flex gap-2">
                    {cuentas.filter((c) => c.id !== cuentaId && c.tipo !== 'tarjeta_credito').map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setTransferOrigenId(c.id)}
                        className="flex-1 rounded-xl px-2 py-2 text-center text-[10.5px]"
                        style={{
                          background: transferOrigenId === c.id ? 'var(--lavender-dim)' : 'var(--card-2)',
                          border: `1.5px solid ${transferOrigenId === c.id ? 'var(--lavender)' : 'var(--line)'}`,
                          color: transferOrigenId === c.id ? 'var(--lavender)' : 'var(--text-1)',
                          fontWeight: transferOrigenId === c.id ? 700 : 400,
                        }}
                      >
                        {firstWord(c.nombre, idioma)}
                        <div className="font-mono text-[9px]" style={{ color: 'var(--text-3)', fontWeight: 400 }}>{fmt(c.saldo)}</div>
                      </button>
                    ))}
                  </div>

                  <div className="mb-1.5 mt-3 text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('mov_monto_a_mover')}</div>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--card-2)' }}>
                    <span style={{ color: 'var(--text-3)' }}>$</span>
                    <input
                      inputMode="numeric"
                      value={transferMonto ? Number(transferMonto).toLocaleString('es-CO') : ''}
                      onChange={(e) => setTransferMonto(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="w-full bg-transparent text-[13px] font-mono outline-none"
                      style={{ color: 'var(--text-1)' }}
                    />
                  </div>

                  <button
                    onClick={doQuickTransfer}
                    disabled={transferSaving || !transferOrigenId || Number(transferMonto || 0) <= 0}
                    className="mt-3 w-full rounded-xl py-2.5 text-[12px] font-bold disabled:opacity-40"
                    style={{ background: 'var(--lavender)', color: '#1c1330' }}
                  >
                    {transferSaving ? t('mov_moviendo') : t('mov_transferir_y_pagar', { cuenta: firstWord(selAcc?.nombre, idioma) })}
                  </button>
                </div>
              )}

              {transferDone && (
                <div className="mt-2.5 flex items-center gap-2 rounded-2xl px-3.5 py-3" style={{ background: 'var(--lavender-dim)', color: 'var(--lavender)' }}>
                  <Check size={14} style={{ flexShrink: 0 }} />
                  <span className="text-[10.5px]">{t('mov_se_transfirieron', { monto: fmt(transferDone.monto), origen: transferDone.origenNombre, destino: selAcc?.nombre ?? '' })}</span>
                </div>
              )}
            </>
          )}

          {selAcc && (
            <div className="mt-3.5 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
              <Row label={tipo === 'ingreso' ? t('mov_ingreso') : t('mov_egreso')} value={fmt(amt)} />
              {applyFour ? (
                <Row muted icon={<Info size={11} />} label={t('mov_4x1000')} value={fmt(tax)} />
              ) : (
                <Row muted label={t('mov_4x1000')} value={t('mov_no_aplica')} />
              )}
              <Row bold color={accent.fg} label={t('mov_total_en', { cuenta: firstWord(selAcc.nombre, idioma) })} value={fmt(total)} withBorder />
            </div>
          )}

          {egresoDejariaNegativo && selAcc && (
            <div className="mt-3.5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
              <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
              {t('mov_egreso_dejaria_negativo', { cuenta: selAcc.nombre, saldo: fmt(selAcc.saldo - total) + (selAcc.moneda && selAcc.moneda !== 'COP' ? ` ${selAcc.moneda}` : '') })}
            </div>
          )}

          {!isEdit && (
            <div className="mt-3.5">
              <button onClick={() => setGuardarFrecuente(!guardarFrecuente)} className="flex w-full items-center gap-2.5 rounded-2xl p-3" style={{ background: 'var(--card)' }}>
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md" style={guardarFrecuente ? { background: accent.fg } : { border: '1.5px solid var(--line)' }}>
                  {guardarFrecuente && <Check size={13} color={accent.text} />}
                </div>
                <span className="text-left text-[12px] font-medium">{t('mov_guardar_frecuente')}</span>
              </button>
              {guardarFrecuente && (
                <div className="mt-2">
                  <InputRow icon={<Star size={16} />} placeholder={t('mov_nombre_frecuente_placeholder')} value={nombreFrecuente} onChange={setNombreFrecuente} />
                  <div className="mb-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('mov_guardar_frecuente_nota')}</div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={save}
            disabled={!cuentaId || (tipoMovimiento === 'normal' && !categoriaId) || (tipoMovimiento === 'fijo' && tipo === 'egreso' && !gastoFijoId) || (tipoMovimiento === 'fijo' && tipo === 'ingreso' && !ingresoFijoId) || saving}
            className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
            style={{ background: accent.fg, color: accent.text }}
          >
            {saving ? t('mov_guardando') : isEdit ? t('mov_guardar_cambios') : t('mov_guardar_tipo', { tipo: tipo === 'ingreso' ? t('mov_ingreso').toLowerCase() : t('mov_egreso').toLowerCase() })}
          </button>

          {isEdit && (
            <button
              onClick={removeTx}
              disabled={deleting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
            >
              <Trash2 size={15} /> {deleting ? t('mov_borrando') : t('mov_borrar_movimiento')}
            </button>
          )}
        </div>

        {showCatSheet && (
          <CatSheet
            accent={accent}
            categorias={catsOfTipo}
            selectedId={categoriaId}
            onSelect={(id) => { setCategoriaId(id); setShowCatSheet(false) }}
            onClose={() => setShowCatSheet(false)}
            onCategoriaEditada={reload}
            tab={tipo === 'ingreso' ? 'ingreso' : 'egreso'}
            userId={user?.id}
            esPro={esPro}
          />
        )}

        {showDatePicker && (
          <CenterModal onClose={() => setShowDatePicker(false)} maxWidth={320}>
            <CalendarPicker value={fecha} onChange={(v) => { setFecha(v); setShowDatePicker(false) }} maxDate={todayLocal()} />
          </CenterModal>
        )}

        {cantidadEditIndex !== null && (
          <CenterModal onClose={() => setCantidadEditIndex(null)} maxWidth={300}>
            <div className="text-center text-[11px]" style={{ color: 'var(--text-2)' }}>
              {t('mov_cantidad_de', { producto: items[cantidadEditIndex]?.descripcion || t('mov_este_producto') })}
            </div>
            <div className="my-4 text-center font-mono text-[38px] font-bold" style={{ color: accent.fg }}>
              {cantidadDraft || '0'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button
                  key={n}
                  onClick={() => setCantidadDraft((d) => (d === '0' ? n : (d + n).slice(0, 3)))}
                  className="flex h-12 items-center justify-center rounded-2xl font-mono text-base font-semibold"
                  style={{ background: 'var(--card)' }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCantidadDraft((d) => (d.length > 1 ? d.slice(0, -1) : '0'))}
                className="flex h-12 items-center justify-center rounded-2xl"
                style={{ background: 'var(--card)' }}
              >
                <Delete size={16} />
              </button>
              <button
                onClick={() => setCantidadDraft((d) => (d === '0' ? '0' : d + '0').slice(0, 3))}
                className="flex h-12 items-center justify-center rounded-2xl font-mono text-base font-semibold"
                style={{ background: 'var(--card)' }}
              >
                0
              </button>
              <button
                onClick={() => {
                  const n = Math.max(1, Number(cantidadDraft || '1'))
                  actualizarItem(cantidadEditIndex, 'cantidad', n)
                  setCantidadEditIndex(null)
                }}
                className="flex h-12 items-center justify-center rounded-2xl text-[12.5px] font-bold"
                style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
              >
                {t('mov_listo')}
              </button>
            </div>
          </CenterModal>
        )}
      </div>
    )
  }

  // ---------------------------- PASO 3: CONFIRMACIÓN ----------------------------
  if (!saved) return null
  return <PantallaConfirmacion accent={accent} isEdit={isEdit} tipo={tipo} amt={amt} saved={saved} cuentaDestino={cuentaDestino} navigate={navigate} t={t} />
}

function PantallaConfirmacion({
  accent, isEdit, tipo, amt, saved, cuentaDestino, navigate, t,
}: {
  accent: { fg: string; dim: string; text: string }
  isEdit: boolean
  tipo: string
  amt: number
  saved: { tx: string; catNombre: string; cuentaNombre: string; total: number; tax: number; pendingSync: boolean; hormigaAviso: string | null }
  cuentaDestino: { nombre: string } | null | undefined
  navigate: (path: string) => void
  t: (clave: import('../lib/i18n').ClaveTraduccion, vars?: Record<string, string | number>) => string
}) {
  const DURACION_MS = 3000
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    const irme = () => navigate(isEdit ? '/movimientos' : '/inicio')
    const timeoutId = setTimeout(irme, DURACION_MS)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div
        className="mb-4.5 flex h-18.5 w-18.5 items-center justify-center rounded-full check-pop"
        style={{ width: 74, height: 74, background: accent.dim, border: `1.5px solid ${accent.fg}`, color: accent.fg }}
      >
        <Check size={32} className="check-draw" />
      </div>
      <div className="text-base font-bold font-display">{isEdit ? t('mov_actualizado') : t('mov_guardado')}</div>
      <div className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {tipo === 'transferencia'
          ? t('mov_transfer_confirmacion', { monto: fmt(amt), origen: saved.cuentaNombre, destino: cuentaDestino?.nombre ?? '' })
          : saved.tax > 0
          ? t('mov_confirmacion_con_tax', { total: fmt(saved.total), cuenta: saved.cuentaNombre, monto: fmt(amt), tax: fmt(saved.tax) })
          : t('mov_confirmacion_simple', { cuenta: saved.cuentaNombre })}
      </div>

      {saved.pendingSync && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
          <WifiOff size={14} />
          <span className="text-[11px]">{t('mov_sin_conexion_sincroniza')}</span>
        </div>
      )}

      {saved.hormigaAviso && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-left" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span className="text-[11px] leading-relaxed">{saved.hormigaAviso}</span>
        </div>
      )}

      <div className="mt-5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{saved.tx}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{saved.catNombre} · {saved.cuentaNombre}</div>
        </div>
        <div className="ml-auto font-mono font-semibold" style={{ color: accent.fg }}>
          {tipo === 'transferencia' ? '' : tipo === 'ingreso' ? '+' : '–'}{fmt(saved.total)}
        </div>
      </div>

      <button
        onClick={() => { setCerrando(true); navigate(isEdit ? '/movimientos' : '/inicio') }}
        className="relative mt-6.5 overflow-hidden rounded-2xl px-10 py-3.5 text-sm font-bold"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)', opacity: cerrando ? 0.7 : 1 }}
      >
        <span className="listo-progress" style={{ animationDuration: `${DURACION_MS}ms` }} />
        <span className="relative">{t('mov_listo')}</span>
      </button>
    </div>
  )
}

// ============================= Subcomponentes =============================

function Header({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
      {onBack ? (
        <button onClick={onBack} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
      ) : (
        <div style={{ width: 34 }} />
      )}
      <div className="text-[15px] font-semibold font-display">{title}</div>
      <button onClick={onClose} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
        <X size={16} />
      </button>
    </div>
  )
}

function TypePill({ active, activeStyle, onClick, children }: { active: boolean; activeStyle: React.CSSProperties; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-2xl py-2.5 text-[12.5px] font-semibold"
      style={active ? activeStyle : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

function CatChip({ active, accent, dashed, onClick, icon: Icon, color, children }: { active: boolean; accent: { fg: string; dim: string }; dashed?: boolean; onClick: () => void; icon?: LucideIcon; color?: string; children: React.ReactNode }) {
  const col = color ? (COLORS[color] ?? COLORS.lavender) : null
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center text-[9.5px]"
      style={{
        background: active ? accent.dim : 'var(--card)',
        borderColor: active ? accent.fg : 'var(--line)',
        borderWidth: 1,
        borderStyle: dashed ? 'dashed' : 'solid',
        color: active ? accent.fg : 'var(--text-2)',
      }}
    >
      {Icon && col ? (
        <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: col.fg, boxShadow: active ? `0 0 0 2px ${accent.fg}` : 'none' }}>
          <Icon size={13} style={{ color: 'var(--bg)' }} />
        </div>
      ) : Icon ? (
        <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--card-2)' }}>
          <Icon size={13} style={{ color: 'var(--text-3)' }} />
        </div>
      ) : (
        <span className="block h-2 w-2 rounded-full" style={{ background: active ? accent.fg : 'var(--text-3)' }} />
      )}
      {children}
    </button>
  )
}

function DateChip({ active, accent, icon: Icon, onClick, children }: { active: boolean; accent: { fg: string; dim: string }; icon?: LucideIcon; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-center text-[10.5px] font-medium leading-tight"
      style={{
        background: active ? accent.dim : 'var(--card)',
        borderColor: active ? accent.fg : 'var(--line)',
        borderWidth: 1,
        borderStyle: 'solid',
        color: active ? accent.fg : 'var(--text-2)',
      }}
    >
      {Icon && <Icon size={13} style={{ color: active ? accent.fg : 'var(--text-3)' }} />}
      {children}
    </button>
  )
}

function InputRow({ icon, placeholder, value, onChange }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-1)' }}
      />
    </div>
  )
}

function WalletChip({ active, onClick, cuenta, disabled, esTarjeta, idioma }: { active: boolean; onClick: () => void; cuenta: Cuenta; disabled?: boolean; esTarjeta?: boolean; idioma?: 'es' | 'en' }) {
  const nombreMostrado = firstWord(cuenta.nombre, idioma)
  const col = COLORS[cuenta.color] ?? COLORS.lavender
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-shrink-0 rounded-2xl px-2 py-2.75 text-center disabled:opacity-30"
      style={{ width: 84, background: active ? col.dim : 'var(--card)', border: `1.5px solid ${active ? col.fg : 'var(--line)'}` }}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: col.fg }} />
        <div className="truncate text-[10px] font-medium" style={{ color: active ? col.fg : 'var(--text-1)' }}>{nombreMostrado}</div>
      </div>
      <div className="mt-0.5 font-mono text-[9px]" style={{ color: 'var(--text-3)' }}>
        {esTarjeta ? `${idioma === 'en' ? 'Used' : 'Usado'} ${fmt(Math.max((cuenta.cupo_total ?? 0) - cuenta.saldo, 0))}` : fmt(cuenta.saldo)}
      </div>
    </button>
  )
}

function TipoMovBtn({ active, onClick, icon: Icon, title, sub, color, dim }: { active: boolean; onClick: () => void; icon: LucideIcon; title: string; sub: string; color?: string; dim?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
      style={{ background: active ? (dim ?? 'var(--card-2)') : 'var(--card)', border: `1.5px solid ${active ? (color ?? 'var(--text-2)') : 'var(--line)'}` }}
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--card-2)', color: color ?? 'var(--text-2)' }}>
        <Icon size={16} />
      </span>
      <div>
        <div className="text-[12px] font-semibold">{title}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{sub}</div>
      </div>
    </button>
  )
}

function Row({ label, value, muted, bold, color, icon, withBorder }: { label: string; value: string; muted?: boolean; bold?: boolean; color?: string; icon?: React.ReactNode; withBorder?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-1 text-xs"
      style={{
        color: color ?? (muted ? 'var(--text-3)' : 'var(--text-1)'),
        fontWeight: bold ? 600 : 400,
        fontSize: muted ? 11 : 12,
        borderTop: withBorder ? '1px solid var(--line)' : undefined,
        marginTop: withBorder ? 4 : 0,
        paddingTop: withBorder ? 9 : 4,
      }}
    >
      <span className="flex items-center gap-1">{icon}{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function CatSheet({ accent, categorias, selectedId, onSelect, onClose, onCategoriaEditada, tab, userId, esPro }: { accent: { fg: string; dim: string; text?: string }; categorias: Categoria[]; selectedId: string | null; onSelect: (id: string) => void; onClose: () => void; onCategoriaEditada: () => void; tab: 'ingreso' | 'egreso'; userId: string | undefined; esPro: boolean }) {
  const { t, idioma } = useIdioma()
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [showNueva, setShowNueva] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  // Los lapicitos NO se ven por default — solo aparecen en las 4
  // categorías... digo, en TODAS las categorías después de tocar este
  // botón. Antes estaban siempre visibles y se veía muy cargado; ahora
  // es "activar modo edición" a propósito, con un botón bien visible en
  // la esquina (borde y relleno lime cuando está activo) en vez de un
  // ícono suelto que no se distinguía de decoración.
  const [modoEditar, setModoEditar] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const grupos = GRUPOS
    .map((g) => ({ ...g, items: categorias.filter((c) => c.grupo === g.id) }))
    .filter((g) => g.items.length > 0)
  const sinGrupo = categorias.filter((c) => !c.grupo)

  // Lapicito en la esquina de cada categoría — solo se muestra con
  // modoEditar activo. Tocar el ícono grande selecciona la categoría
  // para el movimiento (como siempre, incluso en modo edición); tocar
  // el lapicito abre la edición sin afectar la selección. Color fijo
  // (lime, como en la pantalla de Categorías) en vez de accent.fg — con
  // accent.fg se veía horrible en egresos (coral chocando contra el
  // rosado/lo que sea del ícono de la categoría). Va SIEMPRE
  // abajo-derecha del círculo del ícono — igual que en Categorias.tsx —
  // para que las dos pantallas se vean idénticas.
  function Lapicito({ onClick }: { onClick: () => void }) {
    if (!modoEditar) return null
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className="absolute z-10 flex items-center justify-center rounded-full"
        style={{ width: 16, height: 16, right: -4, bottom: -4, background: 'var(--lime)', color: 'var(--lime-text)', border: '1.5px solid var(--bg)' }}
      >
        <Pencil size={8} />
      </button>
    )
  }

  // Con modo edición prendido, todo el botón de la categoría edita (no
  // hace falta apuntarle al lapicito chiquito) — el lapicito se queda
  // solo como pista visual de que está en modo edición, no como el
  // único lugar donde se puede tocar.
  function handleTap(c: Categoria) {
    if (modoEditar) setEditando(c)
    else onSelect(c.id)
  }

  // Una sola función para pintar una categoría — la usan tanto la vista
  // agrupada normal como los resultados de búsqueda, así se ven
  // exactamente igual en los dos casos.
  function Tile({ c, personalizada }: { c: Categoria; personalizada?: boolean }) {
    const Icon = ICONS[c.icono] ?? ICONS.otros
    const col = COLORS[c.color] ?? COLORS.lavender
    const sel = selectedId === c.id
    return (
      <button onClick={() => handleTap(c)} className="flex flex-col items-center gap-1 text-center">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full" style={{ background: personalizada ? 'var(--card-2)' : col.fg, boxShadow: sel ? `0 0 0 2px var(--bg), 0 0 0 4px ${accent.fg}` : 'none' }}>
          <Icon size={16} style={{ color: personalizada ? 'var(--text-2)' : 'var(--bg)' }} />
          <Lapicito onClick={() => setEditando(c)} />
        </div>
        <div className="text-[9px] leading-tight" style={{ color: sel ? accent.fg : 'var(--text-2)' }}>{personalizada ? c.nombre : nombreCategoria(c.nombre, idioma)}</div>
      </button>
    )
  }

  // Con texto en la búsqueda, se comparan nombres ya traducidos (para
  // que buscar en inglés encuentre categorías predeterminadas también)
  // y se muestran en una sola cuadrícula plana, sin agrupar — más fácil
  // de escanear cuando ya se sabe qué se busca.
  const buscando = busqueda.trim().length > 0
  const resultadosBusqueda = buscando
    ? categorias.filter((c) => nombreCategoria(c.nombre, idioma).toLowerCase().includes(busqueda.trim().toLowerCase()))
    : []

  return (
    <CenterModal onClose={onClose} maxWidth={380}>
      <div className="mb-3 flex items-center justify-between">
        <div style={{ width: 30 }} />
        <div className="text-center text-[15px] font-semibold font-display">{t('mov_todas_categorias')}</div>
        <button
          onClick={() => setModoEditar((v) => !v)}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
          style={modoEditar
            ? { background: 'var(--lime)', color: 'var(--lime-text)' }
            : { background: 'var(--card-2)', border: '1.5px solid var(--lime)', color: 'var(--lime)' }}
          title={t('mov_editar_categorias')}
        >
          <Pencil size={14} />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <Search size={14} style={{ color: 'var(--text-3)' }} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t('mov_buscar_categoria')}
          className="w-full bg-transparent text-[12.5px] outline-none"
          style={{ color: 'var(--text-1)' }}
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} style={{ color: 'var(--text-3)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {modoEditar && !buscando && (
        <div className="mb-3 rounded-xl px-3 py-2 text-center text-[10.5px]" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
          {t('mov_editar_categorias_nota')}
        </div>
      )}
      <div className="max-h-[65vh] overflow-y-auto">
        {buscando ? (
          resultadosBusqueda.length === 0 ? (
            <div className="py-6 text-center text-[11.5px]" style={{ color: 'var(--text-3)' }}>{t('mov_sin_resultados_categoria')}</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {resultadosBusqueda.map((c) => <Tile key={c.id} c={c} personalizada={!c.grupo} />)}
            </div>
          )
        ) : (
          <>
            {grupos.map((g) => (
              <div key={g.id} className="mb-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: (COLORS[g.color] ?? COLORS.lavender).fg }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t(('grupo_' + g.id) as import('../lib/i18n').ClaveTraduccion)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {g.items.map((c) => <Tile key={c.id} c={c} />)}
                </div>
              </div>
            ))}
            {sinGrupo.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--text-3)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('mov_personalizadas')}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {sinGrupo.map((c) => <Tile key={c.id} c={c} personalizada />)}
                </div>
              </div>
            )}

            {/* Agregar categoría propia — al final de la lista, Pro. En Free
            abre el paywall en vez del formulario de creación. Se oculta
            durante una búsqueda para no distraer del resultado. */}
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => (esPro ? setShowNueva(true) : setShowPaywall(true))} className="flex flex-col items-center gap-1 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ border: '1.5px dashed var(--lime)', color: 'var(--lime)' }}>
                  {esPro ? <Plus size={16} /> : <Lock size={12} />}
                </div>
                <div className="text-[9px] leading-tight" style={{ color: 'var(--lime)' }}>{t('mov_agregar_categoria')}</div>
              </button>
            </div>
          </>
        )}
      </div>

      {editando && (
        <EditarCategoriaModal
          categoria={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onCategoriaEditada() }}
        />
      )}

      {showNueva && (
        <NuevaCategoriaModal
          tab={tab}
          userId={userId}
          onClose={() => setShowNueva(false)}
          onCreated={() => { setShowNueva(false); onCategoriaEditada() }}
        />
      )}

      {showPaywall && <ProPaywallSheet reason={t('mov_paywall_categoria_propia')} onClose={() => setShowPaywall(false)} />}
    </CenterModal>
  )
}

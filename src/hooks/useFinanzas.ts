import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { cacheGet, cacheSet } from '../lib/offlineDb'
import { syncOutbox, pendingCount } from '../lib/offlineSync'
import { useTasasCambio } from './useTasasCambio'
import type { Cuenta, Categoria, Transaccion, DeudaCredito, MetaAhorro, IngresoFijo, GastoFijo, Presupuesto } from '../lib/database.types'

type DefCat = { nombre: string; tipo: 'ingreso' | 'egreso'; icono: string; grupo: string; color: string; predeterminada: true }

const DEFAULT_CATEGORIAS: DefCat[] = [
  // ---- Ingresos (lime) ----
  { nombre: 'Salario', tipo: 'ingreso', icono: 'banknote', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Ventas', tipo: 'ingreso', icono: 'plus-circle', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Freelancer', tipo: 'ingreso', icono: 'target', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Ingresos', tipo: 'ingreso', icono: 'wallet', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Interés', tipo: 'ingreso', icono: 'percent', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Inversiones', tipo: 'ingreso', icono: 'trending-up', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Pensión', tipo: 'ingreso', icono: 'shield-check', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Prestación por hijo', tipo: 'ingreso', icono: 'baby', grupo: 'ingresos', color: 'lime', predeterminada: true },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'dots', grupo: 'ingresos', color: 'lime', predeterminada: true },

  // ---- Entretenimiento (rosa) ----
  { nombre: 'Bolos', tipo: 'egreso', icono: 'bowling', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Cine', tipo: 'egreso', icono: 'movie', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Concierto', tipo: 'egreso', icono: 'mic', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Deportes', tipo: 'egreso', icono: 'trophy', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Discoteca', tipo: 'egreso', icono: 'disco', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Electrónica', tipo: 'egreso', icono: 'electronics', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Entretenimiento', tipo: 'egreso', icono: 'party', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Gimnasio', tipo: 'egreso', icono: 'dumbbell', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Hobby', tipo: 'egreso', icono: 'hobby', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Suscripción', tipo: 'egreso', icono: 'subscription', grupo: 'entretenimiento', color: 'pink', predeterminada: true },
  { nombre: 'Vacaciones', tipo: 'egreso', icono: 'vacation', grupo: 'entretenimiento', color: 'pink', predeterminada: true },

  // ---- Comida y bebida (azul) ----
  { nombre: 'Alimentos', tipo: 'egreso', icono: 'groceries', grupo: 'comida', color: 'blue', predeterminada: true },
  { nombre: 'Bebidas', tipo: 'egreso', icono: 'drinks', grupo: 'comida', color: 'blue', predeterminada: true },
  { nombre: 'Café', tipo: 'egreso', icono: 'coffee', grupo: 'comida', color: 'blue', predeterminada: true },
  { nombre: 'Caramelos', tipo: 'egreso', icono: 'candy', grupo: 'comida', color: 'blue', predeterminada: true },
  { nombre: 'Comida', tipo: 'egreso', icono: 'utensils', grupo: 'comida', color: 'blue', predeterminada: true },
  { nombre: 'Restaurante', tipo: 'egreso', icono: 'chef', grupo: 'comida', color: 'blue', predeterminada: true },

  // ---- Alojamiento (amarillo) ----
  { nombre: 'Agua', tipo: 'egreso', icono: 'water', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Alojamiento', tipo: 'egreso', icono: 'home', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Alquiler', tipo: 'egreso', icono: 'building', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Aporte a la casa', tipo: 'egreso', icono: 'hand-coins', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Banco', tipo: 'egreso', icono: 'building-bank', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Electricidad', tipo: 'egreso', icono: 'zap', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Facturas', tipo: 'egreso', icono: 'file-text', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Impuestos', tipo: 'egreso', icono: 'percent', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Internet', tipo: 'egreso', icono: 'wifi', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Mantenimiento', tipo: 'egreso', icono: 'wrench', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Préstamo', tipo: 'egreso', icono: 'hand-coins', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Seguros', tipo: 'egreso', icono: 'shield-check', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Servicio', tipo: 'egreso', icono: 'package', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Suministros domésticos', tipo: 'egreso', icono: 'spray', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'TV', tipo: 'egreso', icono: 'tv', grupo: 'alojamiento', color: 'yellow', predeterminada: true },
  { nombre: 'Teléfono', tipo: 'egreso', icono: 'phone', grupo: 'alojamiento', color: 'yellow', predeterminada: true },

  // ---- Estilo de vida (coral) ----
  { nombre: 'Beneficencia', tipo: 'egreso', icono: 'heart', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Compras', tipo: 'egreso', icono: 'shopping-cart', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Comunidad', tipo: 'egreso', icono: 'users', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Dentista', tipo: 'egreso', icono: 'smile', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Educación', tipo: 'egreso', icono: 'graduation-cap', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Estilo de vida', tipo: 'egreso', icono: 'star', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Farmacia', tipo: 'egreso', icono: 'pill', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Gastos de oficina', tipo: 'egreso', icono: 'briefcase', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Guardería', tipo: 'egreso', icono: 'baby', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Hotel', tipo: 'egreso', icono: 'bed', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Mascota', tipo: 'egreso', icono: 'paw', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Médico', tipo: 'egreso', icono: 'stethoscope', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Niñera', tipo: 'egreso', icono: 'user-round', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Regalo', tipo: 'egreso', icono: 'gift', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Trabajo', tipo: 'egreso', icono: 'building2', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Viajes', tipo: 'egreso', icono: 'plane', grupo: 'estilo_vida', color: 'coral', predeterminada: true },
  { nombre: 'Otros gastos', tipo: 'egreso', icono: 'dots', grupo: 'estilo_vida', color: 'coral', predeterminada: true },

  // ---- Ahorros (verde agua) ----
  { nombre: 'Ahorros', tipo: 'egreso', icono: 'piggy-bank', grupo: 'ahorros', color: 'teal', predeterminada: true },
  { nombre: 'Ahorros para emergencias', tipo: 'egreso', icono: 'shield-alert', grupo: 'ahorros', color: 'teal', predeterminada: true },
  { nombre: 'Ahorros para vacaciones', tipo: 'egreso', icono: 'vacation', grupo: 'ahorros', color: 'teal', predeterminada: true },

  // ---- Transporte (lavanda) ----
  { nombre: 'Alquiler de coche', tipo: 'egreso', icono: 'car', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Costes de vehículo', tipo: 'egreso', icono: 'car-front', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Gasolina', tipo: 'egreso', icono: 'fuel', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Parking', tipo: 'egreso', icono: 'parking', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Reparar', tipo: 'egreso', icono: 'wrench', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Seguros de coche', tipo: 'egreso', icono: 'shield-check', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Taxi', tipo: 'egreso', icono: 'car', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Transporte', tipo: 'egreso', icono: 'bus', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Transporte público', tipo: 'egreso', icono: 'train', grupo: 'transporte', color: 'lavender', predeterminada: true },
  { nombre: 'Vuelo', tipo: 'egreso', icono: 'plane', grupo: 'transporte', color: 'lavender', predeterminada: true },
]

// Si la red no responde en este tiempo, la tratamos como "sin conexión" y
// seguimos con lo que ya está en el dispositivo — en vez de esperar los
// 30-60 segundos que un navegador espera antes de rendirse solo.
const NETWORK_TIMEOUT_MS = 5000

// Vive FUERA del hook a propósito — cada pestaña (Inicio/Cuentas/Balance...)
// monta su propia instancia de useFinanzas desde cero al cambiar de tab, y
// sin esto cada cambio de pestaña mostraba "Cargando..." un instante aunque
// los datos ya se hubieran traído hace un segundo. Esta memoria sobrevive
// esos montajes/desmontajes (se resetea solo si recargas la página entera).
const memoryCache = new Map<string, unknown>()
function memKey(userId: string | undefined, tabla: string) {
  return `${userId}:${tabla}`
}

export function useFinanzas() {
  const { user } = useAuth()
  const { convertirCOP } = useTasasCambio()
  const seedingRef = useRef(false)
  const [cuentas, setCuentas] = useState<Cuenta[]>(() => (memoryCache.get(memKey(user?.id, 'cuentas')) as Cuenta[]) ?? [])
  const [categorias, setCategorias] = useState<Categoria[]>(() => (memoryCache.get(memKey(user?.id, 'categorias')) as Categoria[]) ?? [])
  const [transacciones, setTransacciones] = useState<Transaccion[]>(() => (memoryCache.get(memKey(user?.id, 'transacciones')) as Transaccion[]) ?? [])
  const [deudas, setDeudas] = useState<DeudaCredito[]>(() => (memoryCache.get(memKey(user?.id, 'deudas')) as DeudaCredito[]) ?? [])
  const [metas, setMetas] = useState<MetaAhorro[]>(() => (memoryCache.get(memKey(user?.id, 'metas')) as MetaAhorro[]) ?? [])
  const [ingresosFijos, setIngresosFijos] = useState<IngresoFijo[]>(() => (memoryCache.get(memKey(user?.id, 'ingresosFijos')) as IngresoFijo[]) ?? [])
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>(() => (memoryCache.get(memKey(user?.id, 'gastosFijos')) as GastoFijo[]) ?? [])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(() => (memoryCache.get(memKey(user?.id, 'presupuestos')) as Presupuesto[]) ?? [])
  const [esPro, setEsPro] = useState(() => Boolean(memoryCache.get(memKey(user?.id, 'esPro'))))
  const [loading, setLoading] = useState(() => !memoryCache.has(memKey(user?.id, 'cuentas')))
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [pendientesSync, setPendientesSync] = useState(0)
  const [hasCache, setHasCache] = useState(() => memoryCache.has(memKey(user?.id, 'cuentas')))

  const cacheKey = useCallback((tabla: string) => `${user?.id}:${tabla}`, [user])

  // 1) SIEMPRE se muestra primero — es instantáneo, vive en el dispositivo.
  const loadFromCache = useCallback(async () => {
    if (!user) return false
    const [c, cat, tx, d, m, inf, gf, pres, pro] = await Promise.all([
      cacheGet<Cuenta[]>(cacheKey('cuentas')),
      cacheGet<Categoria[]>(cacheKey('categorias')),
      cacheGet<Transaccion[]>(cacheKey('transacciones')),
      cacheGet<DeudaCredito[]>(cacheKey('deudas')),
      cacheGet<MetaAhorro[]>(cacheKey('metas')),
      cacheGet<IngresoFijo[]>(cacheKey('ingresosFijos')),
      cacheGet<GastoFijo[]>(cacheKey('gastosFijos')),
      cacheGet<Presupuesto[]>(cacheKey('presupuestos')),
      cacheGet<boolean>(cacheKey('esPro')),
    ])
    const tieneAlgo = c !== null
    if (tieneAlgo) {
      setCuentas(c ?? [])
      setCategorias(cat ?? [])
      setTransacciones(tx ?? [])
      setDeudas(d ?? [])
      setMetas(m ?? [])
      setIngresosFijos(inf ?? [])
      setGastosFijos(gf ?? [])
      setPresupuestos(pres ?? [])
      setEsPro(Boolean(pro))
      setHasCache(true)
      memoryCache.set(memKey(user.id, 'cuentas'), c ?? [])
      memoryCache.set(memKey(user.id, 'categorias'), cat ?? [])
      memoryCache.set(memKey(user.id, 'transacciones'), tx ?? [])
      memoryCache.set(memKey(user.id, 'deudas'), d ?? [])
      memoryCache.set(memKey(user.id, 'metas'), m ?? [])
      memoryCache.set(memKey(user.id, 'ingresosFijos'), inf ?? [])
      memoryCache.set(memKey(user.id, 'gastosFijos'), gf ?? [])
      memoryCache.set(memKey(user.id, 'presupuestos'), pres ?? [])
      memoryCache.set(memKey(user.id, 'esPro'), Boolean(pro))
    }
    return tieneAlgo
  }, [user, cacheKey])

  // 2) En segundo plano, intenta traer lo real de Supabase — con un límite
  // de tiempo corto, para no dejar la app "pensando" si la señal es mala.
  const refreshFromNetwork = useCallback(async () => {
    if (!user) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)

    try {
      const perfilRes = await supabase.from('profiles').select('es_pro, es_pro_duo').eq('id', user.id).abortSignal(controller.signal).single()
      // Pro por pago propio O por Dúo (alguien te lo regaló) — cualquiera
      // de los dos te da acceso completo a las funciones Pro.
      const esProNow = Boolean(perfilRes.data?.es_pro) || Boolean(perfilRes.data?.es_pro_duo)

      let txQuery = supabase.from('transacciones').select('*').abortSignal(controller.signal).order('fecha', { ascending: false }).order('created_at', { ascending: false })
      if (!esProNow) {
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - 3)
        const y = cutoff.getFullYear(), m = String(cutoff.getMonth() + 1).padStart(2, '0'), d = String(cutoff.getDate()).padStart(2, '0')
        txQuery = txQuery.gte('fecha', `${y}-${m}-${d}`)
      } else {
        txQuery = txQuery.limit(50)
      }

      const now = new Date()
      const [c, cat, tx, d, m, inf, gf, pres] = await Promise.all([
        supabase.from('cuentas').select('*').abortSignal(controller.signal).eq('activa', true).order('created_at'),
        supabase.from('categorias').select('*').abortSignal(controller.signal).order('nombre'),
        txQuery,
        supabase.from('deudas_creditos').select('*').abortSignal(controller.signal).eq('estado', 'activa'),
        supabase.from('metas_ahorro').select('*').abortSignal(controller.signal).order('created_at'),
        supabase.from('ingresos_fijos').select('*').abortSignal(controller.signal).eq('activo', true).order('dia_mes'),
        supabase.from('gastos_fijos').select('*').abortSignal(controller.signal).eq('activo', true).order('dia_mes'),
        supabase.from('presupuestos').select('*').abortSignal(controller.signal).eq('mes', now.getMonth() + 1).eq('anio', now.getFullYear()),
      ])
      clearTimeout(timeout)

      const firstError = c.error || cat.error || tx.error || d.error || m.error || inf.error || gf.error || pres.error
      if (firstError) throw firstError

      setOffline(false)
      setEsPro(esProNow)
      setCuentas((c.data as Cuenta[]) ?? [])
      setPresupuestos((pres.data as Presupuesto[]) ?? [])

      let categoriasData = (cat.data as Categoria[]) ?? []
      const nombresExistentes = new Set(categoriasData.map((c) => c.nombre))
      const faltantes = DEFAULT_CATEGORIAS.filter((dc) => !nombresExistentes.has(dc.nombre))
      if (faltantes.length > 0 && !seedingRef.current) {
        seedingRef.current = true
        const seed = await supabase
          .from('categorias')
          .upsert(faltantes.map((dc) => ({ ...dc, user_id: user.id })), { onConflict: 'user_id,nombre', ignoreDuplicates: true })
        seedingRef.current = false
        if (!seed.error) {
          const refetch = await supabase.from('categorias').select('*').order('nombre')
          categoriasData = (refetch.data as Categoria[]) ?? []
        }
      }
      setCategorias(categoriasData)
      setTransacciones((tx.data as Transaccion[]) ?? [])
      setDeudas((d.data as DeudaCredito[]) ?? [])
      setMetas((m.data as MetaAhorro[]) ?? [])
      setIngresosFijos((inf.data as IngresoFijo[]) ?? [])
      setGastosFijos((gf.data as GastoFijo[]) ?? [])

      memoryCache.set(memKey(user.id, 'cuentas'), (c.data as Cuenta[]) ?? [])
      memoryCache.set(memKey(user.id, 'categorias'), categoriasData)
      memoryCache.set(memKey(user.id, 'transacciones'), (tx.data as Transaccion[]) ?? [])
      memoryCache.set(memKey(user.id, 'deudas'), (d.data as DeudaCredito[]) ?? [])
      memoryCache.set(memKey(user.id, 'metas'), (m.data as MetaAhorro[]) ?? [])
      memoryCache.set(memKey(user.id, 'ingresosFijos'), (inf.data as IngresoFijo[]) ?? [])
      memoryCache.set(memKey(user.id, 'gastosFijos'), (gf.data as GastoFijo[]) ?? [])
      memoryCache.set(memKey(user.id, 'presupuestos'), (pres.data as Presupuesto[]) ?? [])
      memoryCache.set(memKey(user.id, 'esPro'), esProNow)

      await Promise.all([
        cacheSet(cacheKey('cuentas'), c.data ?? []),
        cacheSet(cacheKey('categorias'), categoriasData),
        cacheSet(cacheKey('transacciones'), tx.data ?? []),
        cacheSet(cacheKey('deudas'), d.data ?? []),
        cacheSet(cacheKey('metas'), m.data ?? []),
        cacheSet(cacheKey('ingresosFijos'), inf.data ?? []),
        cacheSet(cacheKey('gastosFijos'), gf.data ?? []),
        cacheSet(cacheKey('presupuestos'), pres.data ?? []),
        cacheSet(cacheKey('esPro'), esProNow),
      ])
      setPendientesSync(await pendingCount())
      return true
    } catch {
      clearTimeout(timeout)
      setOffline(true)
      return false
    }
  }, [user, cacheKey])

  const reload = useCallback(async () => {
    if (!user) return
    setError(null)

    const teniaCache = await loadFromCache()
    // Si ya había algo (caché en disco o en la memoria compartida entre
    // pestañas), quita el loading YA — no esperes a que la red responda,
    // eso pasa calladito en segundo plano. Solo si es la primera vez de
    // verdad (nada guardado en ningún lado) se deja el loading prendido.
    setLoading(!teniaCache)

    const ok = await refreshFromNetwork()
    if (!ok && !teniaCache) {
      // Primera vez Y sin red: no hay nada que mostrar todavía.
      setError('Sin conexión y sin datos guardados aún — conéctate al menos una vez para traer tu información.')
    }
    setPendientesSync(await pendingCount())
    setLoading(false)
  }, [user, loadFromCache, refreshFromNetwork])

  useEffect(() => {
    reload()
  }, [reload])

  // Apenas vuelve la señal, sincroniza lo pendiente y refresca con lo real.
  useEffect(() => {
    function onOnline() {
      syncOutbox((pendientes) => setPendientesSync(pendientes)).then(() => refreshFromNetwork())
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refreshFromNetwork])

  // Igual, pero cuando la APP (no la red) vuelve a primer plano — sin
  // esto, si agregaste un movimiento desde la ventanita rápida del widget
  // (una Activity y un WebView completamente aparte, con su propia
  // sesión de React) y volvías a la app principal, seguía mostrando los
  // datos viejos hasta que algo más disparara un refresh. Corre en
  // segundo plano, calladito — no vuelve a poner loading en true.
  useEffect(() => {
    const listenerPromise = CapApp.addListener('resume', () => { refreshFromNetwork() })
    return () => { listenerPromise.then((l) => l.remove()) }
  }, [refreshFromNetwork])

  // Convierte a COP antes de sumar — si no, una cuenta en USD y una en
  // COP se suman como si fueran la misma moneda (bug real, ver
  // RESUMEN-PARA-CONTINUAR.txt).
  const totalCash = cuentas.filter((c) => c.tipo !== 'tarjeta_credito').reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
  const totalIngresosFijos = ingresosFijos.reduce((s, i) => s + i.monto, 0)
  const totalGastosFijos = gastosFijos.reduce((s, g) => s + g.monto, 0)
  const totalAporteMetas = metas.reduce((s, m) => s + (m.aporte_mensual || 0), 0)
  const disponibleLibre = totalIngresosFijos - totalGastosFijos - totalAporteMetas

  const topCategorias = (tipo: 'ingreso' | 'egreso', n = 3) => {
    const counts: Record<string, number> = {}
    transacciones
      .filter((t) => t.tipo === tipo && t.categoria_id)
      .forEach((t) => { counts[t.categoria_id as string] = (counts[t.categoria_id as string] ?? 0) + 1 })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id]) => categorias.find((c) => c.id === id))
      .filter(Boolean) as Categoria[]
  }

  return {
    cuentas, categorias, transacciones, deudas, metas, ingresosFijos, gastosFijos, presupuestos,
    loading, error, reload, totalCash, topCategorias, esPro, offline, pendientesSync, hasCache,
    totalIngresosFijos, totalGastosFijos, totalAporteMetas, disponibleLibre,
  }
}

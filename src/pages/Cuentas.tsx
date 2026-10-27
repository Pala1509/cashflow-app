import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote, Smartphone, Landmark, CreditCard, Scale, Undo2, MoreHorizontal, Plus, ChevronRight, ChevronUp, ChevronDown, Lock, Pencil,
  Home, Music, Target, Utensils, Bike, Monitor, Gamepad2, Heart, Wallet, PlusCircle,
  Trophy, Clapperboard, Mic2, Disc3, Zap, PartyPopper, Dumbbell, Palette, RefreshCw, Palmtree,
  ShoppingBasket, Wine, Coffee, Candy, ChefHat, Droplet, Building, HandCoins, FileText, Percent,
  Wifi, Wrench, ShieldCheck, Package, SprayCan, Tv, Phone, TrendingUp, Baby, ShoppingCart, Users,
  Smile, GraduationCap, Star, Pill, Briefcase, BedDouble, PawPrint, Stethoscope, UserRound, Gift,
  Building2, Plane, PiggyBank, ShieldAlert, Car, CarFront, Fuel, ParkingCircle, Bus, TrainFront,
  type LucideIcon,
} from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useProDuo } from '../hooks/useProDuo'
import { useAuth } from '../lib/AuthContext'
import Avatar from '../components/Avatar'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { parseLocalDate } from '../lib/date'
import { FREE_LIMITS } from '../lib/pro'
import { useIdioma } from '../lib/IdiomaContext'
import { useTasasCambio } from '../hooks/useTasasCambio'
import { nombreCategoria } from '../lib/categoriaI18n'
import { getNombreCompleto } from '../lib/profile'
import { proyeccionInteres, diasParaVencer, montoFinalCDT } from '../lib/interes'
import logoBlanco from '../assets/logos/logo-blanco-transparente-web.png'
import type { Cuenta } from '../lib/database.types'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// A diferencia de fmt() (siempre COP, sin decimales), esto respeta la
// moneda propia de cada cuenta — USD/EUR/MXN se muestran con 2
// decimales y su símbolo, como cualquier app bancaria de esos países.
export function fmtMoneda(n: number, moneda: string): string {
  if (moneda === 'USD') return 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (moneda === 'EUR') return '€' + n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (moneda === 'MXN') return 'MX$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return fmt(n)
}

export const ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  'device-mobile': Smartphone,
  'building-bank': Landmark,
  lock: Lock,
  'credit-card': CreditCard,
  scale: Scale,
  'arrow-back-up': Undo2,
  home: Home,
  music: Music,
  target: Target,
  utensils: Utensils,
  bike: Bike,
  'device-desktop': Monitor,
  'gamepad-2': Gamepad2,
  heart: Heart,
  wallet: Wallet,
  'plus-circle': PlusCircle,
  dots: MoreHorizontal,
  otros: MoreHorizontal,
  // --- categorías estilo Buddy ---
  bowling: Trophy, movie: Clapperboard, mic: Mic2, trophy: Trophy, disco: Disc3,
  electronics: Zap, party: PartyPopper, dumbbell: Dumbbell, hobby: Palette,
  subscription: RefreshCw, vacation: Palmtree,
  groceries: ShoppingBasket, drinks: Wine, coffee: Coffee, candy: Candy, chef: ChefHat,
  water: Droplet, building: Building, 'hand-coins': HandCoins, zap: Zap,
  'file-text': FileText, percent: Percent, wifi: Wifi, wrench: Wrench,
  'shield-check': ShieldCheck, package: Package, spray: SprayCan, tv: Tv, phone: Phone,
  'trending-up': TrendingUp, baby: Baby, banknote: Banknote,
  'shopping-cart': ShoppingCart, users: Users, smile: Smile, 'graduation-cap': GraduationCap,
  star: Star, pill: Pill, briefcase: Briefcase, bed: BedDouble, paw: PawPrint,
  stethoscope: Stethoscope, 'user-round': UserRound, gift: Gift, building2: Building2,
  plane: Plane, 'piggy-bank': PiggyBank, 'shield-alert': ShieldAlert,
  car: Car, 'car-front': CarFront, fuel: Fuel, parking: ParkingCircle, bus: Bus, train: TrainFront,
}

export const GRUPOS: { id: string; nombre: string; color: string }[] = [
  { id: 'entretenimiento', nombre: 'Entretenimiento', color: 'pink' },
  { id: 'comida', nombre: 'Comida y bebida', color: 'blue' },
  { id: 'alojamiento', nombre: 'Alojamiento', color: 'yellow' },
  { id: 'ingresos', nombre: 'Ingresos', color: 'lime' },
  { id: 'estilo_vida', nombre: 'Estilo de vida', color: 'coral' },
  { id: 'ahorros', nombre: 'Ahorros', color: 'teal' },
  { id: 'transporte', nombre: 'Transporte', color: 'lavender' },
]

export const COLORS: Record<string, { fg: string; dim: string }> = {
  lime: { fg: 'var(--lime)', dim: 'var(--lime-dim)' },
  coral: { fg: 'var(--coral)', dim: 'var(--coral-dim)' },
  yellow: { fg: 'var(--yellow)', dim: 'var(--yellow-dim)' },
  lavender: { fg: 'var(--lavender)', dim: 'var(--lavender-dim)' },
  pink: { fg: 'var(--pink)', dim: 'var(--pink-dim)' },
  blue: { fg: 'var(--blue)', dim: 'var(--blue-dim)' },
  teal: { fg: 'var(--teal)', dim: 'var(--teal-dim)' },
}

// Degradado de 2 tonos + color de texto legible encima, uno por cada color
// de cuenta — para la tarjeta de crédito expandida (estilo wallet).
// Versión corta de un monto — "997K", "1.2M" — para que quepa disfrazado
// como los últimos dígitos del número de tarjeta en la vista previa.
export function shortFmt(n: number) {
  const sign = n < 0 ? '-' : ''
  n = Math.abs(n)
  if (n >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  return `${sign}${Math.round(n / 1000)}K`
}

// Disfraza el saldo real como si fueran los últimos dígitos de un número
// de tarjeta — 12 caracteres, agrupados de 4 en 4, cambia solo según la
// plata real que tenga esa cuenta (nunca es un número inventado). Con $0
// queda completamente disfrazado (todo puntos, sin mostrar el "0").
export function maskedNumero(saldo: number): string {
  const digitos = saldo === 0 ? '' : Math.round(Math.abs(saldo)).toString()
  const total = 12
  const puntos = '•'.repeat(Math.max(total - digitos.length, 0))
  const full = (puntos + digitos).slice(-total)
  const grupos: string[] = []
  for (let i = 0; i < full.length; i += 4) grupos.push(full.slice(i, i + 4))
  return grupos.join(' ')
}

export const CARD_GRADIENTS: Record<string, { from: string; to: string; text: string }> = {
  lime: { from: '#C6FF4D', to: '#5FE0C8', text: '#0C2B10' },
  coral: { from: '#FF7A6E', to: '#B9327A', text: '#4A1B0C' },
  yellow: { from: '#FFD666', to: '#FF7A6E', text: '#3A1200' },
  lavender: { from: '#B9A6F5', to: '#7A67D8', text: '#1c1330' },
  pink: { from: '#FF8FC7', to: '#B9327A', text: '#4B1528' },
  blue: { from: '#7AB3F5', to: '#3C4AD8', text: '#0C1E4B' },
  teal: { from: '#5FE0C8', to: '#1D9E75', text: '#04342C' },
}

// Bancos de Colombia — cada uno con el color de nuestra propia paleta que
// más se le parece (Nequi morado, Bancolombia amarillo, etc.), NO su logo
// real ni sus colores de marca exactos — así la "miniimagen" de la tarjeta
// es 100% nuestra (el degradado de CARD_GRADIENTS de arriba), sin ningún
// riesgo de usar marca registrada de nadie.
// Bancos agrupados por continente — en orden alfabético dentro de cada
// grupo. El campo `color` solo controla el degradado de la tarjeta
// visual (mismo color por defecto), no tiene nada que ver con el país.
// `monedaSugerida` es aparte de la agrupación visual — un banco de
// EE.UU. y uno de México caen los dos bajo "Norteamérica" pero sugieren
// monedas distintas (USD vs MXN), así que la moneda va por banco, no
// por continente. Los bancos de Centroamérica, Sudamérica (salvo el
// caso de dólares/euros que ya cubren otros grupos) y Asia no sugieren
// ninguna moneda porque CashFlow por ahora solo maneja COP/USD/EUR/MXN.
// Reordenar o recolorear esto NO afecta cuentas ya creadas — el color
// elegido queda guardado en la cuenta al momento de crearla, no se lee
// de aquí después.
type MonedaSugerida = 'USD' | 'EUR' | 'MXN'
export const BANCOS_GRUPOS: { id: 'norteamerica' | 'centroamerica' | 'sudamerica' | 'europa' | 'asia'; bancos: { nombre: string; color: string; monedaSugerida?: MonedaSugerida }[] }[] = [
  {
    id: 'norteamerica',
    bancos: [
      { nombre: 'American Express', color: 'coral', monedaSugerida: 'USD' },
      { nombre: 'Banamex (Citibanamex)', color: 'blue', monedaSugerida: 'MXN' },
      { nombre: 'Banco Azteca', color: 'coral', monedaSugerida: 'MXN' },
      { nombre: 'Banco del Bajío', color: 'teal', monedaSugerida: 'MXN' },
      { nombre: 'Bank of America', color: 'blue', monedaSugerida: 'USD' },
      { nombre: 'Banorte', color: 'yellow', monedaSugerida: 'MXN' },
      { nombre: 'Banregio', color: 'lime', monedaSugerida: 'MXN' },
      { nombre: 'BBVA México', color: 'yellow', monedaSugerida: 'MXN' },
      { nombre: 'Capital One', color: 'yellow', monedaSugerida: 'USD' },
      { nombre: 'Chase', color: 'blue', monedaSugerida: 'USD' },
      { nombre: 'Citibank', color: 'teal', monedaSugerida: 'USD' },
      { nombre: 'Goldman Sachs', color: 'lavender', monedaSugerida: 'USD' },
      { nombre: 'HSBC México', color: 'pink', monedaSugerida: 'MXN' },
      { nombre: 'Inbursa', color: 'lavender', monedaSugerida: 'MXN' },
      { nombre: 'PNC Bank', color: 'lime', monedaSugerida: 'USD' },
      { nombre: 'Santander México', color: 'coral', monedaSugerida: 'MXN' },
      { nombre: 'Scotiabank México', color: 'blue', monedaSugerida: 'MXN' },
      { nombre: 'TD Bank', color: 'teal', monedaSugerida: 'USD' },
      { nombre: 'US Bank', color: 'coral', monedaSugerida: 'USD' },
      { nombre: 'Wells Fargo', color: 'yellow', monedaSugerida: 'USD' },
    ],
  },
  {
    id: 'centroamerica',
    bancos: [
      { nombre: 'BAC Credomatic', color: 'coral' },
      { nombre: 'Banco General (Panamá)', color: 'blue' },
      { nombre: 'Banco Industrial (Guatemala)', color: 'teal' },
      { nombre: 'Banco Nacional de Costa Rica', color: 'yellow' },
      { nombre: 'Banistmo (Panamá)', color: 'lavender' },
      { nombre: 'Banrural (Guatemala)', color: 'lime' },
      { nombre: 'Ficohsa (Honduras)', color: 'pink' },
    ],
  },
  {
    id: 'sudamerica',
    bancos: [
      { nombre: 'Banco Agrario', color: 'lime' },
      { nombre: 'Banco AV Villas', color: 'yellow' },
      { nombre: 'Banco Caja Social', color: 'blue' },
      { nombre: 'Banco de Bogotá', color: 'blue' },
      { nombre: 'Banco de Chile', color: 'teal' },
      { nombre: 'Banco de la Nación (Perú)', color: 'coral' },
      { nombre: 'Banco Falabella', color: 'teal' },
      { nombre: 'Banco Galicia (Argentina)', color: 'lavender' },
      { nombre: 'Banco Popular', color: 'coral' },
      { nombre: 'Bancolombia', color: 'yellow' },
      { nombre: 'BancoEstado (Chile)', color: 'blue' },
      { nombre: 'Bancoomeva', color: 'yellow' },
      { nombre: 'Banesco (Venezuela)', color: 'pink' },
      { nombre: 'BBVA', color: 'teal' },
      { nombre: 'BCP (Perú)', color: 'lime' },
      { nombre: 'Daviplata', color: 'coral' },
      { nombre: 'Davivienda', color: 'coral' },
      { nombre: 'GNB Sudameris', color: 'blue' },
      { nombre: 'Itaú', color: 'yellow' },
      { nombre: 'Itaú Unibanco (Brasil)', color: 'lime' },
      { nombre: 'Lulo Bank', color: 'lime' },
      { nombre: 'Movii', color: 'pink' },
      { nombre: 'Nequi', color: 'lavender' },
      { nombre: 'Nu', color: 'pink' },
      { nombre: 'RappiPay', color: 'coral' },
      { nombre: 'Scotiabank Colpatria', color: 'coral' },
    ],
  },
  {
    id: 'europa',
    bancos: [
      { nombre: 'Banco Santander', color: 'coral', monedaSugerida: 'EUR' },
      { nombre: 'Barclays', color: 'blue', monedaSugerida: 'EUR' },
      { nombre: 'BBVA', color: 'yellow', monedaSugerida: 'EUR' },
      { nombre: 'BNP Paribas', color: 'lavender', monedaSugerida: 'EUR' },
      { nombre: 'Crédit Agricole', color: 'teal', monedaSugerida: 'EUR' },
      { nombre: 'Deutsche Bank', color: 'blue', monedaSugerida: 'EUR' },
      { nombre: 'HSBC', color: 'pink', monedaSugerida: 'EUR' },
      { nombre: 'ING', color: 'coral', monedaSugerida: 'EUR' },
      { nombre: 'N26', color: 'lime', monedaSugerida: 'EUR' },
      { nombre: 'Revolut', color: 'lavender', monedaSugerida: 'EUR' },
      { nombre: 'UniCredit', color: 'yellow', monedaSugerida: 'EUR' },
    ],
  },
  {
    id: 'asia',
    bancos: [
      { nombre: 'Bank of China', color: 'coral' },
      { nombre: 'DBS Bank (Singapur)', color: 'blue' },
      { nombre: 'HDFC Bank (India)', color: 'teal' },
      { nombre: 'ICBC', color: 'yellow' },
      { nombre: 'Mitsubishi UFJ Financial Group (Japón)', color: 'lavender' },
      { nombre: 'Mizuho Bank (Japón)', color: 'lime' },
      { nombre: 'Standard Chartered', color: 'pink' },
      { nombre: 'State Bank of India', color: 'coral' },
    ],
  },
]

// Mapa nombre de banco → moneda sugerida — para auto-precargar la
// moneda correcta al elegir un banco extranjero (ver chooseBanco() en
// CuentaNueva.tsx). Solo cubre bancos con monedaSugerida definida
// arriba; el resto (Sudamérica, Centroamérica, Asia) no fuerza nada —
// varios bancos sí ofrecen cuentas en dólares sin ser de EE.UU., y
// CashFlow por ahora no maneja otras monedas (JPY, CNY, GTQ, etc).
export const BANCO_MONEDA_DE: Record<string, MonedaSugerida> = Object.fromEntries(
  BANCOS_GRUPOS.flatMap((g) => g.bancos.filter((b) => b.monedaSugerida).map((b) => [b.nombre, b.monedaSugerida as MonedaSugerida]))
)

// "Otro banco" queda fuera de los grupos, como opción catch-all al
// final de la lista — no pertenece a ninguna región en particular.
export const BANCO_OTRO = 'Otro banco'

// Lista plana de todos los bancos (todas las regiones + Otro) — para
// buscar el color asociado a un nombre ya guardado, sin importar en
// qué grupo esté.
export const BANCOS_TODOS: { nombre: string; color: string }[] = [
  ...BANCOS_GRUPOS.flatMap((g) => g.bancos),
  { nombre: BANCO_OTRO, color: 'lavender' },
]

// 3 variantes de diseño por banco — todas usan el mismo color asociado al
// banco, solo cambia el tratamiento visual (inspirado en que los bancos
// reales suelen ofrecer varias tarjetas: clásica, "black", preferencial).
// Sigue sin usar ningún logo ni diseño real de banco.
export const DISENOS_TARJETA = ['clasico', 'oscuro', 'claro'] as const
export type DisenoTarjeta = (typeof DISENOS_TARJETA)[number]

export function estiloTarjeta(colorKey: string | null | undefined, diseno: string | null | undefined) {
  const grad = CARD_GRADIENTS[colorKey ?? 'lavender'] ?? CARD_GRADIENTS.lavender
  if (diseno === 'oscuro') {
    return { background: `linear-gradient(135deg, #17171A 40%, ${grad.to})`, text: '#F5F5F3' }
  }
  if (diseno === 'claro') {
    return { background: `linear-gradient(135deg, ${grad.to}, ${grad.from})`, text: grad.text }
  }
  return { background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`, text: grad.text }
}

export function IconCircle({ icono, color, size = 42 }: { icono: string; color: string; size?: number }) {
  const Icon = ICONS[icono] ?? MoreHorizontal
  const c = COLORS[color] ?? COLORS.lavender
  return (
    <div className="flex flex-shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: c.dim, color: c.fg }}>
      <Icon size={Math.round(size * 0.42)} />
    </div>
  )
}

export default function Cuentas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const { cuentas, deudas, gastosFijos, esPro, loading, transacciones, categorias } = useFinanzas()
  const { convertirCOP } = useTasasCambio()
  const [debitoExpandidaId, setDebitoExpandidaId] = useState<string | null>(null)
  // Una sola cuenta "de resumen" expandida a la vez (Efectivo/Débito/
  // Ahorros/CDT comparten esto — separado de debitoExpandidaId porque
  // ese controla la vista de tarjeta visual, esto es el panel de
  // movimientos/interés que se despliega debajo).
  const [movExpandidaId, setMovExpandidaId] = useState<string | null>(null)
  const { row: proDuoRow, partnerName } = useProDuo()
  const [showPaywall, setShowPaywall] = useState(false)

  const cuentasCash = cuentas.filter((c) => c.tipo !== 'tarjeta_credito' && c.tipo !== 'cdt' && !c.es_ahorro)
  const cuentasAhorro = cuentas.filter((c) => c.tipo !== 'tarjeta_credito' && c.tipo !== 'cdt' && c.es_ahorro)
  const cuentasCDT = cuentas.filter((c) => c.tipo === 'cdt')

  // Mismo total de siempre (cuentasCash + cuentasAhorro) — esto solo las
  // separa para MOSTRARLAS, por tipo real de plata: efectivo físico,
  // cuentas/billeteras débito, y tarjetas débito con saldo propio.
  const cuentasEfectivo = cuentasCash.filter((c) => c.tipo === 'efectivo' || c.tipo === 'monedero')
  const cuentasDebito = cuentasCash.filter((c) => c.tipo === 'billetera_digital' || c.tipo === 'cuenta_bancaria')
  const cuentasTarjetaDebito = cuentasCash.filter((c) => c.tipo === 'tarjeta_debito')
  const tarjetas = (() => {
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)
    const usos = new Map<string, number>()
    for (const t of transacciones) {
      if (!t.cuenta_id || parseLocalDate(t.fecha) < hace30) continue
      usos.set(t.cuenta_id, (usos.get(t.cuenta_id) ?? 0) + 1)
    }
    return cuentas
      .filter((c) => c.tipo === 'tarjeta_credito')
      .map((c) => ({ cuenta: c, usos: usos.get(c.id) ?? 0 }))
      .sort((a, b) => b.usos - a.usos)
  })()

  // Convertidas a COP antes de sumar — mezclar saldos de distinta
  // moneda sin convertir da un total sin sentido (100 USD + 100.000 COP
  // no son 100.100 de nada).
  const tienes = cuentasCash.reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
    + cuentasAhorro.reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
    + cuentasCDT.reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
  const debesTarjetas = tarjetas.reduce((s, { cuenta: c }) => s + convertirCOP((c.cupo_total ?? 0) - c.saldo, c.moneda), 0)
  const debesDeudas = deudas.filter((d) => d.tipo === 'deuda').reduce((s, d) => s + (d.capital - d.capital_pagado), 0)
  const debes = debesTarjetas + debesDeudas

  const ahorroActual = cuentasAhorro.reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
  const totalGastosFijos = gastosFijos.reduce((s, g) => s + g.monto, 0)
  const mesesColchon = totalGastosFijos > 0 ? ahorroActual / totalGastosFijos : 0

  // Últimos 7 días de movimientos que tocan esta cuenta — como origen
  // (egresos e ingresos normales, o transferencia saliendo) o como
  // destino (transferencia llegando, que cuenta como "ingreso" para
  // efectos de este resumen aunque en la base no tenga tipo "ingreso").
  function resumenCuenta(cuentaId: string) {
    const desde = new Date()
    desde.setDate(desde.getDate() - 7)
    const items = transacciones
      .filter((tx) => (tx.cuenta_id === cuentaId || tx.cuenta_destino_id === cuentaId) && parseLocalDate(tx.fecha) >= desde)
      .map((tx) => {
        const esOrigen = tx.cuenta_id === cuentaId
        const esIngreso = tx.tipo === 'ingreso' || (tx.tipo === 'transferencia' && !esOrigen)
        const montoMostrado = esOrigen && tx.tipo !== 'ingreso' ? tx.monto + tx.monto_4x1000 : tx.monto
        let nombre = tx.descripcion || nombreCategoria(categorias.find((c) => c.id === tx.categoria_id)?.nombre, idioma)
        if (tx.tipo === 'transferencia') {
          const otraCuentaId = esOrigen ? tx.cuenta_destino_id : tx.cuenta_id
          const otraCuenta = cuentas.find((c) => c.id === otraCuentaId)?.nombre ?? ''
          nombre = esOrigen ? t('cuentas_transferencia_hacia', { cuenta: otraCuenta }) : t('cuentas_transferencia_desde', { cuenta: otraCuenta })
        }
        return { id: tx.id, fecha: tx.fecha, esIngreso, montoMostrado, nombre: nombre || t('mov_otros') }
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    const ingresos = items.filter((i) => i.esIngreso).reduce((s, i) => s + i.montoMostrado, 0)
    const egresos = items.filter((i) => !i.esIngreso).reduce((s, i) => s + i.montoMostrado, 0)
    return { items: items.slice(0, 5), ingresos, egresos }
  }

  function PanelMovimientos({ cuentaId, onEditar }: { cuentaId: string; onEditar: () => void }) {
    const { items, ingresos, egresos } = resumenCuenta(cuentaId)
    return (
      <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <div className="mb-1.5 text-[9px] uppercase tracking-wide opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_ultimos_7_dias')}</div>
        <div className="mb-2 flex gap-2">
          <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_ingresos')}</div>
            <div className="font-mono text-[12px] font-bold" style={{ color: 'var(--lime)' }}>+{fmt(ingresos)}</div>
          </div>
          <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_egresos')}</div>
            <div className="font-mono text-[12px] font-bold" style={{ color: 'var(--coral)' }}>–{fmt(egresos)}</div>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="py-1.5 text-[10.5px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_sin_movimientos_semana')}</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between py-1 text-[11px]">
              <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-1)' }}>{it.nombre}</span>
              <span className="ml-2 flex-shrink-0 font-mono" style={{ color: it.esIngreso ? 'var(--lime)' : 'var(--coral)' }}>
                {it.esIngreso ? '+' : '–'}{fmt(it.montoMostrado)}
              </span>
            </div>
          ))
        )}
        <button onClick={onEditar} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.18)', color: 'var(--text-2)' }}>
          <Pencil size={12} /> {t('cuentas_editar_cuenta')}
        </button>
      </div>
    )
  }


  function subtipoLabel(c: Cuenta) {
    if (c.subtipo) return c.subtipo + (c.four_x_mil ? ' · 4x1000' : '')
    if (c.tipo === 'efectivo') return t('cuentas_billetera_fisica')
    if (c.tipo === 'monedero') return t('cuentas_monedero')
    if (c.tipo === 'tarjeta_debito') return t('cuentas_tarjeta_debito') + (c.four_x_mil ? ' · 4x1000' : '')
    if (c.tipo === 'billetera_digital') return t('cuentas_billetera_digital') + (c.four_x_mil ? ' · 4x1000' : '')
    return c.four_x_mil ? '4x1000' : ''
  }

  function CuentaRow({ c, ahorro }: { c: Cuenta; ahorro?: boolean }) {
    const tieneTasa = ahorro && c.tasa_ea > 0
    const expandida = movExpandidaId === c.id
    return (
      <div className="mb-2.5 flex w-full flex-col rounded-2xl p-3.5 text-left" style={{ background: 'var(--card)', border: ahorro ? '1px solid var(--lime-dim)' : undefined }}>
        <button onClick={() => setMovExpandidaId(expandida ? null : c.id)} className="flex w-full items-center gap-3 text-left">
          <IconCircle icono={c.icono} color={c.color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {c.nombre}
              {c.moneda && c.moneda !== 'COP' && (
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
                  {c.moneda}
                </span>
              )}
              {tieneTasa && (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'var(--teal-dim, rgba(95,224,200,.14))', color: 'var(--teal)' }}>
                  {c.tasa_ea}% EA
                </span>
              )}
              {c.compartida_con_id && (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'var(--lavender-dim, rgba(167,139,250,.14))', color: 'var(--lavender)' }}>
                  <Users size={9} /> {t('cuentas_compartida')}
                </span>
              )}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
              {subtipoLabel(c)}
              {c.compartida_con_id && partnerName && ` · ${t('cuentas_compartida_con', { pareja: partnerName })}`}
            </div>
          </div>
          <div className="font-mono text-[13px]" style={{ color: ahorro ? 'var(--lime)' : undefined }}>{fmtMoneda(c.saldo, c.moneda)}</div>
          {expandida ? <ChevronUp size={14} style={{ color: 'var(--lime)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
        </button>
        {tieneTasa && (
          <div className="mt-2.5 flex gap-4 rounded-xl px-3 py-2" style={{ background: 'var(--card-2)' }}>
            <div>
              <div className="text-[8px]" style={{ color: 'var(--text-3)' }}>{t('cuentas_en_30_dias')}</div>
              <div className="font-mono text-[11px] font-semibold" style={{ color: 'var(--teal)' }}>+{fmt(proyeccionInteres(c.saldo, c.tasa_ea, 30))}</div>
            </div>
            <div>
              <div className="text-[8px]" style={{ color: 'var(--text-3)' }}>{t('cuentas_en_1_ano')}</div>
              <div className="font-mono text-[11px] font-semibold" style={{ color: 'var(--teal)' }}>+{fmt(proyeccionInteres(c.saldo, c.tasa_ea, 365))}</div>
            </div>
          </div>
        )}
        {expandida && <PanelMovimientos cuentaId={c.id} onEditar={() => navigate(`/cuentas/${c.id}/editar`)} />}
      </div>
    )
  }

  const cuentasList = (
    <>
      <SectionHead title={t('seccion_efectivo')} onAdd={() => navigate('/cuentas/nueva?tipo=efectivo')} contador={!esPro ? `${cuentasEfectivo.length}/${FREE_LIMITS.maxEfectivo} Free` : undefined} />
      {loading && <Empty>{t('cuentas_cargando')}</Empty>}
      {!loading && cuentasEfectivo.length === 0 && <Empty>{t('cuentas_vacio_efectivo')}</Empty>}
      {cuentasEfectivo.map((c) => <CuentaRow key={c.id} c={c} />)}

      <SectionHead title={t('seccion_cuentas_debito')} onAdd={() => navigate('/cuentas/nueva?tipo=billetera_digital')} contador={!esPro ? `${cuentasDebito.length}/${FREE_LIMITS.maxCuentasDebito} Free` : undefined} />
      {!loading && cuentasDebito.length === 0 && <Empty>{t('cuentas_vacio_debito')}</Empty>}
      {cuentasDebito.map((c) => <CuentaRow key={c.id} c={c} />)}

      <SectionHead title={t('seccion_tarjetas_debito')} onAdd={() => navigate('/cuentas/nueva?tipo=tarjeta_debito')} contador={!esPro ? `${cuentasTarjetaDebito.length}/${FREE_LIMITS.maxTarjetasDebito} Free` : undefined} />
      {!loading && cuentasTarjetaDebito.length === 0 && <Empty>{t('cuentas_vacio_tarjeta_debito')}</Empty>}
      {cuentasTarjetaDebito.map((c) => {
        const expandida = debitoExpandidaId === c.id
        const col = COLORS[c.color] ?? COLORS.lavender

        if (!expandida) {
          return (
            <button
              key={c.id}
              onClick={() => setDebitoExpandidaId(c.id)}
              className="relative mb-2 flex w-full items-center gap-2.5 overflow-hidden rounded-2xl py-2.5 pl-3 pr-3.5 text-left"
              style={{ background: 'var(--card)' }}
            >
              <div className="absolute inset-y-0 left-0" style={{ width: 4, background: col.fg }} />
              <div className="ml-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12px] font-medium">
                  {c.nombre}
                  {c.compartida_con_id && <Users size={10} style={{ color: 'var(--lavender)', flexShrink: 0 }} />}
                </div>
                <div className="mt-0.5 truncate text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                  {subtipoLabel(c)}
                  {c.compartida_con_id && partnerName && ` · ${t('cuentas_compartida_con', { pareja: partnerName })}`}
                </div>
              </div>
              <div className="font-mono text-[11.5px] font-semibold" style={{ color: col.fg }}>{fmtMoneda(c.saldo, c.moneda)}</div>
              <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
            </button>
          )
        }

        const grad = estiloTarjeta(c.color, c.diseno_tarjeta)
        return (
          <div key={c.id} className="relative mb-2.5 overflow-hidden rounded-2xl p-4" style={{ background: grad.background }}>
            {c.diseno_tarjeta === 'oscuro' && (
              <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px)' }} />
            )}
            <img
              src={logoBlanco}
              alt=""
              className="absolute pointer-events-none select-none"
              style={{ right: 6, top: '20%', width: 92, opacity: 0.2, filter: 'blur(1px)', transform: 'rotate(-18deg)' }}
            />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <div className="text-[13px] font-bold font-display" style={{ color: grad.text }}>{c.nombre}</div>
                {c.compartida_con_id && (
                  <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)', color: grad.text }}>
                    <Users size={8} /> {t('cuentas_compartida')}
                  </span>
                )}
              </div>
              <button onClick={() => setDebitoExpandidaId(null)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.28)', color: grad.text }}>
                <ChevronUp size={14} />
              </button>
            </div>

            {/* Tocar el cuerpo (no el botón de arriba) entra a editar la tarjeta */}
            <button onClick={() => navigate(`/cuentas/${c.id}/editar`)} className="relative mt-1 block w-full text-left">
              <div className="text-[7.5px] uppercase tracking-wide opacity-70" style={{ color: grad.text }}>{subtipoLabel(c)}</div>

              <div className="my-3" style={{ width: 32, height: 24, borderRadius: 5, background: 'linear-gradient(135deg, #F3D98B, #C9A227)' }}>
                <div className="m-1 h-[calc(100%-8px)] rounded-sm" style={{ border: '1px solid rgba(0,0,0,0.22)' }} />
              </div>

              <div className="font-mono text-[13px] font-semibold tracking-[2px]" style={{ color: grad.text, opacity: 0.9 }}>
                {maskedNumero(c.saldo)}
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <div className="text-[6.5px] uppercase tracking-wide opacity-60" style={{ color: grad.text }}>{t('cuentas_titular')}</div>
                  <div className="font-mono text-[10px] font-semibold uppercase" style={{ color: grad.text }}>{getNombreCompleto(user) || t('cuentas_tu_nombre')}</div>
                </div>
                <div className="flex">
                  <div className="h-4 w-4 rounded-full" style={{ background: grad.text, opacity: 0.55 }} />
                  <div className="-ml-2 h-4 w-4 rounded-full" style={{ background: '#fff', opacity: 0.85, mixBlendMode: 'overlay' }} />
                </div>
              </div>
            </button>
            <div className="relative">
              <PanelMovimientos cuentaId={c.id} onEditar={() => navigate(`/cuentas/${c.id}/editar`)} />
            </div>
          </div>
        )
      })}

      <SectionHead title={t('seccion_ahorros')} onAdd={() => navigate('/cuentas/nueva?modo=ahorro')} contador={!esPro ? `${cuentasAhorro.length}/${FREE_LIMITS.maxAhorros} Free` : undefined} />
      {!loading && cuentasAhorro.length === 0 && <Empty>{t('cuentas_vacio_ahorros')}</Empty>}
      {cuentasAhorro.map((c) => <CuentaRow key={c.id} c={c} ahorro />)}

      <SectionHead title={t('seccion_cdts')} onAdd={() => navigate('/cuentas/nueva?tipo=cdt')} pro={!esPro} />
      {!loading && cuentasCDT.length === 0 && <Empty>{t('cuentas_vacio_cdt')}</Empty>}
      {cuentasCDT.map((c) => {
        const dias = c.fecha_apertura && c.plazo_dias ? diasParaVencer(c.fecha_apertura, c.plazo_dias) : null
        const vencido = dias !== null && dias <= 0
        const montoFinal = c.plazo_dias ? montoFinalCDT(c.saldo, c.tasa_ea, c.plazo_dias) : c.saldo
        const pct = c.plazo_dias ? Math.min(Math.max(((c.plazo_dias - (dias ?? 0)) / c.plazo_dias) * 100, 0), 100) : 0
        const diasTranscurridos = c.plazo_dias ? Math.max(c.plazo_dias - (dias ?? 0), 0) : 0
        const interesGanado = proyeccionInteres(c.saldo, c.tasa_ea, diasTranscurridos)
        const expandido = movExpandidaId === c.id
        return (
          <div
            key={c.id}
            className="relative mb-2.5 overflow-hidden rounded-2xl p-4 text-left"
            style={{ background: `linear-gradient(150deg, rgba(185,166,245,0.16), var(--card) 65%)`, border: '1px solid var(--lavender)' }}
          >
            <button onClick={() => setMovExpandidaId(expandido ? null : c.id)} className="block w-full text-left">
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-extrabold uppercase" style={{ background: 'rgba(185,166,245,0.18)', color: 'var(--lavender)' }}>
              <Lock size={9} /> {vencido ? t('cuentas_vencio') : t('cuentas_bloqueado')}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="text-[13px] font-bold font-display">{c.nombre}</div>
              {c.compartida_con_id && <Users size={11} style={{ color: 'var(--lavender)', flexShrink: 0 }} />}
            </div>
            <div className="mt-0.5 text-[9.5px]" style={{ color: 'var(--text-3)' }}>
              {c.plazo_dias ? `${c.plazo_dias} días · ${c.tasa_ea}% EA` : `${c.tasa_ea}% EA`}
              {c.compartida_con_id && partnerName && ` · ${t('cuentas_compartida_con', { pareja: partnerName })}`}
            </div>
            <div className="mt-3">
              <div className="text-[8px] uppercase" style={{ color: 'var(--text-3)' }}>{t('cuentas_capital_inicial')}</div>
              <div className="font-mono text-[19px] font-bold">{fmtMoneda(c.saldo, c.moneda)}</div>
            </div>
            {c.plazo_dias && (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--lavender)' }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[8.5px]" style={{ color: 'var(--text-3)' }}>
                  <span>{t('cuentas_abierto', { fecha: c.fecha_apertura ? new Date(c.fecha_apertura + 'T00:00:00').toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' }) : '' })}</span>
                  <span>{vencido ? t('cuentas_ya_puedes_retirar') : t('cuentas_vence_en', { n: dias ?? 0, s: dias === 1 ? '' : 's' })}</span>
                </div>
              </>
            )}
            <div className="mt-2.5 rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="text-[8.5px]" style={{ color: 'var(--text-3)' }}>{vencido ? t('cuentas_recibes') : t('cuentas_al_vencimiento')}</div>
              <div className="font-mono text-[14px] font-bold" style={{ color: 'var(--lavender)' }}>{fmt(montoFinal)}</div>
            </div>
            </button>
            {expandido && (
              <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
                <div className="mb-1.5 text-[9px] uppercase tracking-wide opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_interes_acumulado')}</div>
                <div className="mb-2 flex gap-2">
                  <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
                    <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_ya_ganado', { n: diasTranscurridos, s: diasTranscurridos === 1 ? '' : 's' })}</div>
                    <div className="font-mono text-[13px] font-bold" style={{ color: 'var(--teal)' }}>+{fmt(interesGanado)}</div>
                  </div>
                  <div className="flex-1 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
                    <div className="text-[8px] opacity-70" style={{ color: 'var(--text-2)' }}>{t('cuentas_al_vencimiento_corto')}</div>
                    <div className="font-mono text-[13px] font-bold" style={{ color: 'var(--teal)' }}>+{fmt(montoFinal - c.saldo)}</div>
                  </div>
                </div>
                <button onClick={() => navigate(`/cuentas/${c.id}/editar`)} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.18)', color: 'var(--text-2)' }}>
                  <Pencil size={12} /> {t('cuentas_editar_cdt')}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )

  return (
    <div className="px-5 pt-3 md:px-8 md:pt-6">
      <div className="mb-1 flex items-center justify-between pt-2 md:justify-center">
        <div style={{ width: 34 }} className="md:hidden" />
        <div className="text-[15px] font-semibold font-display">{t('cuentas_titulo')}</div>
        <div className="md:hidden">
          <Avatar user={user} size={34} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      <div className="lg:mx-auto lg:max-w-[640px]">
        {/* Todo el texto de esta tarjeta en negro puro — mismo criterio que
        Inicio.tsx: sobre el lima brillante el negro es lo único que
        contrasta fuerte de verdad, y así toda la app queda consistente en
        vez de usar --lime-pos/--lime-neg (verdes/rojos oscuros) solo acá. */}
        <div className="mt-1.5 rounded-3xl p-5" style={{ background: 'var(--card-lime)' }}>
          <div className="text-xs" style={{ color: '#000000', opacity: 0.65 }}>{t('cuentas_patrimonio_neto')}</div>
          <div className="mt-1 text-[25px] font-bold font-display font-mono" style={{ color: '#000000' }}>{fmt(tienes - debes)}</div>
          <div className="mt-3 flex gap-4">
            <div>
              <span className="text-[10.5px] font-semibold" style={{ color: '#000000' }}>● {t('cuentas_tienes')}</span>
              <div className="font-mono text-[13px] font-bold" style={{ color: '#000000' }}>{fmt(tienes)}</div>
            </div>
            <div>
              <span className="text-[10.5px] font-semibold" style={{ color: '#000000' }}>● {t('cuentas_debes')}</span>
              <div className="font-mono text-[13px] font-bold" style={{ color: '#000000' }}>{fmt(debes)}</div>
            </div>
          </div>
        </div>

        <div>{cuentasList}</div>

        <div className="mb-5.5 mt-6" style={{ borderTop: '1px solid var(--line)' }} />

        <div className="mb-2.5 flex items-center gap-2">
          <div className="text-sm font-semibold">{t('cuentas_colchon_financiero')}</div>
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>PRO</span>
        </div>

        {!esPro ? (
          <button onClick={() => setShowPaywall(true)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold">{t('cuentas_colchon_pregunta')}</div>
              <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('cuentas_colchon_desc')}</div>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
            {totalGastosFijos === 0 ? (
              <div className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('cuentas_colchon_sin_gastos')}</div>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('cuentas_colchon_tienes_para')}</div>
                    <div className="font-mono text-[22px] font-bold" style={{ color: mesesColchon >= 3 ? 'var(--lime)' : mesesColchon >= 1 ? 'var(--yellow)' : 'var(--coral)' }}>
                      {t('cuentas_colchon_meses', { n: mesesColchon.toFixed(1), es: mesesColchon === 1 ? '' : 'es' })}
                    </div>
                  </div>
                  <div className="text-right text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {t('cuentas_colchon_guardado', { monto: fmt(ahorroActual) })}<br />{t('cuentas_colchon_de_mes', { monto: fmt(totalGastosFijos) })}
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--card)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((mesesColchon / 6) * 100, 100)}%`,
                      background: mesesColchon >= 3 ? 'var(--lime)' : mesesColchon >= 1 ? 'var(--yellow)' : 'var(--coral)',
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[9px]" style={{ color: 'var(--text-3)' }}>
                  <span>0</span>
                  <span>{t('cuentas_colchon_minimo')}</span>
                  <span>6+</span>
                </div>
                <div className="mt-2.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {mesesColchon >= 6
                    ? t('cuentas_colchon_excelente')
                    : mesesColchon >= 3
                    ? t('cuentas_colchon_bien')
                    : mesesColchon >= 1
                    ? t('cuentas_colchon_buen_camino')
                    : t('cuentas_colchon_bajo')}
                </div>
              </>
            )}
          </div>
        )}

        {/* Solo si eres Pro y todavía no tienes a nadie vinculado — si ya
            hay un vínculo (pendiente o activo) no tiene sentido invitar
            a alguien más, Pro Dúo es solo para una persona. */}
        {esPro && !proDuoRow && (
          <button
            onClick={() => navigate('/perfil/pro-duo')}
            className="relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-left"
            style={{
              background: 'linear-gradient(150deg, rgba(198,255,77,0.14), rgba(185,166,245,0.08) 60%, var(--card) 100%)',
              border: '1px solid rgba(198,255,77,0.22)',
            }}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
              <Heart size={16} />
            </div>
            <div className="flex-1">
              <div className="text-[12.5px] font-bold font-display">{t('cuentas_regala_pro')}</div>
              <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-2)' }}>{t('cuentas_regala_pro_desc')}</div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
          </button>
        )}

      </div>

      {/* Espaciador explícito — no depender solo del padding del shell para
          que el contenido no quede tapado por la tab bar/borde inferior.
          Más grande en celular a propósito (tab bar fija ~4.5rem + margen),
          vuelve a ser chico en desktop/tablet donde no hay tab bar. */}
      <div className="h-28 md:h-6" />

      {showPaywall && (
        <ProPaywallSheet
          reason={t('cuentas_paywall_colchon')}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  )
}

export function SectionHead({ title, onAdd, contador, pro }: { title: string; onAdd: () => void; contador?: string; pro?: boolean }) {
  const { t } = useIdioma()
  return (
    <div className="mb-2.5 mt-5.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">{title}</div>
        {contador && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>{contador}</span>}
        {pro && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>PRO</span>}
      </div>
      <button onClick={onAdd} data-tour="cuentas-agregar" className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--lime)' }}>
        <Plus size={13} /> {t('cuentas_agregar')}
      </button>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-3.5 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{children}</div>
}

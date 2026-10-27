import { useEffect, useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, X, ChevronRight, ChevronDown, Trash2, Check,
  Tag, DollarSign, Percent, CalendarClock, AlertTriangle, Search, Globe2, Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useProDuo } from '../hooks/useProDuo'
import { FREE_LIMITS, seccionCuenta, contarSeccion, SECCION_LABEL } from '../lib/pro'
import ProPaywallSheet from '../components/ProPaywallSheet'
import CenterModal from '../components/CenterModal'
import CalendarPicker from '../components/CalendarPicker'
import { todayLocal, parseLocalDate } from '../lib/date'
import { getNombreCompleto } from '../lib/profile'
import type { TipoCuenta } from '../lib/database.types'
import { IconCircle, COLORS, BANCOS_GRUPOS, BANCOS_TODOS, BANCO_OTRO, BANCO_MONEDA_DE, DISENOS_TARJETA, estiloTarjeta, maskedNumero, type DisenoTarjeta } from './Cuentas'
import { signalTourAction } from '../lib/tourActionBus'
import { useBancosPersonalizados } from '../hooks/useBancosPersonalizados'
import { usePais } from '../hooks/usePais'
import { useBancosDesbloqueados } from '../hooks/useBancosDesbloqueados'
import { continenteDe } from '../lib/paises'
import logoBlanco from '../assets/logos/logo-blanco-transparente-web.png'
import { proyeccionInteres, montoFinalCDT, fechaVencimiento } from '../lib/interes'
import { useIdioma } from '../lib/IdiomaContext'
import type { ClaveTraduccion } from '../lib/i18n'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

type AccTipo = TipoCuenta | 'deuda' | 'credito'
type Interes = 'sobre_saldo' | 'fijo_capital' | 'sin_interes'
type Step = 'type' | 'subtype-bank' | 'subtype-debt' | 'interest' | 'form'

// Estos tipos preguntan banco + diseño dentro del mismo formulario (no
// como un paso aparte) — el color se deriva solo del banco elegido.
const REQUIERE_BANCO = new Set<AccTipo>(['billetera_digital', 'cuenta_bancaria', 'tarjeta_debito', 'tarjeta_credito', 'cdt'])

const TYPE_OPTS: { id: AccTipo; icon: keyof typeof ICON_MAP; color: string }[] = [
  { id: 'efectivo', icon: 'cash', color: 'lime' },
  { id: 'billetera_digital', icon: 'device-mobile', color: 'lavender' },
  { id: 'cuenta_bancaria', icon: 'building-bank', color: 'yellow' },
  { id: 'monedero', icon: 'piggy-bank', color: 'teal' },
  { id: 'cdt', icon: 'lock', color: 'lavender' },
  { id: 'tarjeta_debito', icon: 'credit-card', color: 'blue' },
  { id: 'tarjeta_credito', icon: 'credit-card', color: 'coral' },
  { id: 'deuda', icon: 'scale', color: 'coral' },
  { id: 'credito', icon: 'arrow-back-up', color: 'yellow' },
]
// Claves de traducción para cada tipo — separado del array de arriba
// porque TYPE_OPTS vive fuera del componente (sin acceso a t()).
const TYPE_LABEL_KEYS: Record<AccTipo, { nombre: ClaveTraduccion; desc: ClaveTraduccion }> = {
  efectivo: { nombre: 'cn_tipo_efectivo', desc: 'cn_tipo_efectivo_desc' },
  billetera_digital: { nombre: 'cn_tipo_billetera', desc: 'cn_tipo_billetera_desc' },
  cuenta_bancaria: { nombre: 'cn_tipo_bancaria', desc: 'cn_tipo_bancaria_desc' },
  monedero: { nombre: 'cn_tipo_monedero', desc: 'cn_tipo_monedero_desc' },
  cdt: { nombre: 'cn_tipo_cdt', desc: 'cn_tipo_cdt_desc' },
  tarjeta_debito: { nombre: 'cn_tipo_debito', desc: 'cn_tipo_debito_desc' },
  tarjeta_credito: { nombre: 'cn_tipo_credito', desc: 'cn_tipo_credito_desc' },
  deuda: { nombre: 'cn_tipo_deuda', desc: 'cn_tipo_deuda_desc' },
  credito: { nombre: 'cn_tipo_prestamo', desc: 'cn_tipo_prestamo_desc' },
}
const ICON_MAP = { cash: 'cash', 'device-mobile': 'device-mobile', 'building-bank': 'building-bank', 'piggy-bank': 'piggy-bank', 'credit-card': 'credit-card', scale: 'scale', 'arrow-back-up': 'arrow-back-up', lock: 'lock' } as const

// Solo estos 3 tienen sentido como "cuenta de ahorros" — nada de billetera
// digital, tarjeta o deuda ahí. El CDT no entra porque tiene su propia
// sección y flujo (plazo, vencimiento) — no es un ahorro flexible.
const TIPOS_AHORRO: AccTipo[] = ['efectivo', 'cuenta_bancaria', 'monedero']

const BANK_SUBTYPES = ['Cuenta de ahorros', 'Cuenta corriente', 'Fondo de inversión']

// "Deuda" = algo que TÚ debes (a un banco, o a alguien). "Préstamo que hiciste"
// = plata que TE deben a ti — son direcciones opuestas, por eso cada una
// tiene sus propias opciones (no tiene sentido preguntar "crédito hipotecario"
// si le prestaste plata a un amigo).
const DEBT_SUBTYPES = ['Préstamo bancario', 'Crédito rotativo', 'Crédito hipotecario', 'Préstamo con un tercero', 'Otro']
const CREDIT_SUBTYPES = ['Préstamo a un amigo o familiar', 'Fiado / venta a crédito', 'Otro']

// Estos 3 solo funcionan de una forma en la vida real (interés sobre el
// saldo que va bajando) — no tiene sentido preguntarte "¿fijo o sin
// interés?" para un crédito hipotecario. Se salta ese paso directo.
const SUBTIPOS_BANCARIOS = new Set(['Préstamo bancario', 'Crédito rotativo', 'Crédito hipotecario'])

const PERIODOS = ['Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual']
const PERIODO_KEYS: Record<string, ClaveTraduccion> = {
  Quincenal: 'cn_periodo_quincenal', Mensual: 'cn_periodo_mensual', Trimestral: 'cn_periodo_trimestral', Semestral: 'cn_periodo_semestral', Anual: 'cn_periodo_anual',
}
const GRUPO_BANCO_LABEL_KEYS: Record<string, ClaveTraduccion> = {
  norteamerica: 'cn_grupo_norteamerica', centroamerica: 'cn_grupo_centroamerica', sudamerica: 'cn_grupo_sudamerica', europa: 'cn_grupo_europa', asia: 'cn_grupo_asia',
}

// Interés que más probablemente aplica según el subtipo elegido — se
// preselecciona para ahorrar un toque, pero se puede cambiar igual.
const DEFAULT_INTEREST: Record<string, Interes> = {
  'Préstamo bancario': 'sobre_saldo',
  'Crédito rotativo': 'sobre_saldo',
  'Crédito hipotecario': 'sobre_saldo',
  'Préstamo con un tercero': 'fijo_capital',
  'Préstamo a un amigo o familiar': 'sin_interes',
  'Fiado / venta a crédito': 'sin_interes',
}

const INTEREST_OPTS: { id: Interes; nombre: ClaveTraduccion; desc: ClaveTraduccion }[] = [
  { id: 'sobre_saldo', nombre: 'cn_interes_sobre_saldo', desc: 'cn_interes_sobre_saldo_desc' },
  { id: 'fijo_capital', nombre: 'cn_interes_fijo', desc: 'cn_interes_fijo_desc' },
  { id: 'sin_interes', nombre: 'cn_interes_sin', desc: 'cn_interes_sin_desc' },
]

export default function CuentaNueva() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const { cuentas, deudas, gastosFijos, esPro, reload } = useFinanzas()
  const { bancos: bancosPersonalizados } = useBancosPersonalizados()
  const { t, idioma } = useIdioma()
  const [params] = useSearchParams()
  const modoAhorro = params.get('modo') === 'ahorro'
  const [showPaywall, setShowPaywall] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadedEdit, setLoadedEdit] = useState(!isEdit)

  const preTipo = params.get('tipo') as AccTipo | null
  const [step, setStep] = useState<Step>(isEdit ? 'form' : 'type')
  const [tipo, setTipo] = useState<AccTipo | null>(null)
  const [subtipo, setSubtipo] = useState<string | null>(null)
  const [interes, setInteres] = useState<Interes | null>(null)
  const [nombre, setNombre] = useState('')
  const [saldo, setSaldo] = useState('')
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('')
  const [periodo, setPeriodo] = useState('Mensual')
  const [plazoMeses, setPlazoMeses] = useState('')
  const [cuotaMensual, setCuotaMensual] = useState('')
  const [gastoFijoVinculado, setGastoFijoVinculado] = useState<string | null>(null)
  const [capitalPagadoInicial, setCapitalPagadoInicial] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [notifActivo, setNotifActivo] = useState(false)
  const [notifDiasAntes, setNotifDiasAntes] = useState('1')
  const [showFechaLimite, setShowFechaLimite] = useState(false)
  const [four, setFour] = useState(true)
  const [esAhorro, setEsAhorro] = useState(modoAhorro)
  const [cuotaManejo, setCuotaManejo] = useState('')
  const [tasaInteresTarjeta, setTasaInteresTarjeta] = useState('')
  const [diaCorte, setDiaCorte] = useState('')
  const [diaPago, setDiaPago] = useState('')
  const [tasaEa, setTasaEa] = useState('')
  const [plazoDias, setPlazoDias] = useState(180)
  const [fechaApertura, setFechaApertura] = useState(todayLocal())
  const [compartir, setCompartir] = useState(false)
  const { row: proDuoRow, partnerName } = useProDuo()
  const parejaActiva = proDuoRow?.estado === 'activo' ? proDuoRow : null
  const parejaId = parejaActiva ? (parejaActiva.inviter_id === user?.id ? parejaActiva.invitado_id : parejaActiva.inviter_id) : null
  const [colorElegido, setColorElegido] = useState<string | null>(null)
  const [banco, setBanco] = useState<string | null>(null)
  const [diseno, setDiseno] = useState<DisenoTarjeta>('clasico')
  const [showBancoPicker, setShowBancoPicker] = useState(false)
  const [bancoQuery, setBancoQuery] = useState('')
  const { pais } = usePais()
  const miContinente = continenteDe(pais)
  const [bancosDesbloqueados, setBancosDesbloqueados] = useBancosDesbloqueados()
  // Sin país guardado (betas viejos) no filtramos nada, para no esconderle
  // bancos a nadie por un dato que todavía no existía cuando se registró.
  const verTodosContinentes = !miContinente || (esPro && bancosDesbloqueados)
  const [saving, setSaving] = useState(false)
  const [moneda, setMoneda] = useState<'COP' | 'USD' | 'EUR' | 'MXN'>('COP')

  // Modo edición: busca la cuenta o deuda existente y precarga el formulario,
  // saltando directo al paso final (ya sabemos el tipo, no hay que preguntarlo).
  useEffect(() => {
    if (!isEdit || loadedEdit) return
    const cuenta = cuentas.find((c) => c.id === id)
    if (cuenta) {
      setTipo(cuenta.tipo)
      setSubtipo(cuenta.subtipo)
      setNombre(cuenta.nombre)
      setSaldo(String(cuenta.tipo === 'tarjeta_credito' ? cuenta.cupo_total ?? 0 : cuenta.saldo))
      setFour(cuenta.four_x_mil)
      setColorElegido(cuenta.color)
      setBanco(cuenta.banco)
      setMoneda((cuenta.moneda as 'COP' | 'USD' | 'EUR' | 'MXN') ?? 'COP')
      setDiseno((cuenta.diseno_tarjeta as DisenoTarjeta) ?? 'clasico')
      setEsAhorro(cuenta.es_ahorro)
      setCompartir(Boolean(cuenta.compartida_con_id))
      setCuotaManejo(cuenta.cuota_manejo ? String(cuenta.cuota_manejo) : '')
      setTasaInteresTarjeta(cuenta.tasa_interes ? String(cuenta.tasa_interes) : '')
      setDiaCorte(cuenta.dia_corte ? String(cuenta.dia_corte) : '')
      setDiaPago(cuenta.dia_pago ? String(cuenta.dia_pago) : '')
      setTasaEa(cuenta.tasa_ea ? String(cuenta.tasa_ea) : '')
      setPlazoDias(cuenta.plazo_dias ?? 180)
      setFechaApertura(cuenta.fecha_apertura ?? todayLocal())
      setStep('form')
      setLoadedEdit(true)
      return
    }
    const deuda = deudas.find((d) => d.id === id)
    if (deuda) {
      setTipo(deuda.tipo)
      setSubtipo(deuda.subtipo)
      setNombre(deuda.nombre)
      setCapital(String(deuda.capital))
      setTasa(String(deuda.tasa_interes))
      setPeriodo(deuda.periodo_interes)
      setInteres(deuda.tipo_interes)
      setPlazoMeses(deuda.plazo_meses ? String(deuda.plazo_meses) : '')
      setCuotaMensual(deuda.cuota_mensual ? String(deuda.cuota_mensual) : '')
      setGastoFijoVinculado(deuda.gasto_fijo_id)
      setCompartir(Boolean(deuda.compartida_con_id))
      setFechaLimite(deuda.fecha_limite ?? '')
      setNotifActivo(deuda.notif_dias_antes !== null)
      setNotifDiasAntes(deuda.notif_dias_antes !== null ? String(deuda.notif_dias_antes) : '1')
      setStep('form')
      setLoadedEdit(true)
    }
  }, [isEdit, loadedEdit, id, cuentas, deudas])

  // Si vinimos de un botón "+ Agregar" específico (ej. desde la sección
  // "Tarjetas de crédito"), saltamos directo a ese tipo sin volver a preguntar.
  useEffect(() => {
    if (!isEdit && preTipo) chooseType(preTipo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDebt = tipo === 'deuda' || tipo === 'credito'
  const isBancario = subtipo !== null && SUBTIPOS_BANCARIOS.has(subtipo)
  const canShowFour = tipo === 'billetera_digital' || tipo === 'cuenta_bancaria' || tipo === 'tarjeta_debito' || tipo === 'tarjeta_credito'
  const capitalNum = Number(capital || 0)
  const tasaNum = Number(tasa || 0)
  const cuotaFija = Math.round(capitalNum * (tasaNum / 100))

  // Si venimos de un botón "+" específico (ej. "Deudas" → tipo=deuda), la
  // pantalla de tipo ("¿Qué quieres agregar?") nunca se mostró en esta
  // sesión — es un flujo aparte, no el paso anterior de este. Por eso el
  // botón atrás nunca debe "revelarla": en el primer paso de este flujo,
  // atrás significa salir, no retroceder a una pantalla que el usuario
  // nunca vio.
  const quickEntry = Boolean(!isEdit && preTipo)

  function back() {
    if (isEdit) { navigate(-1); return }
    if (step === 'subtype-bank' || step === 'subtype-debt') {
      if (quickEntry) navigate(-1)
      else setStep('type')
      return
    }
    if (step === 'interest') { setStep('subtype-debt'); return }
    if (step === 'form') {
      if (isBancario) { setStep('subtype-debt'); return } // saltó la pregunta de interés, así que atrás también la salta
      if (isDebt) { setStep('interest'); return }
      if (quickEntry) { navigate(-1); return }
      setStep(tipo === 'cuenta_bancaria' ? 'subtype-bank' : 'type')
      return
    }
    navigate(-1)
  }

  function chooseType(t2: AccTipo) {
    if (t2 === 'cdt' && !esPro) {
      setShowPaywall(t('cn_paywall_cdt'))
      return
    }
    // Cuentas (efectivo, débito, tarjetas...): el límite depende de en qué
    // SECCIÓN caería — todavía no sabemos si la marcarán como "ahorro"
    // (eso se decide más adelante en el formulario), así que este primer
    // aviso usa su sección por defecto; el chequeo real y definitivo pasa
    // otra vez justo antes de guardar, con el estado final ya decidido.
    if (!esPro) {
      const seccion = seccionCuenta(t2, modoAhorro)
      if (seccion && seccion !== 'cdt') {
        const usados = contarSeccion(cuentas, seccion)
        if (usados >= FREE_LIMITS[seccion]) {
          setShowPaywall(t('cn_paywall_limite_seccion', { n: FREE_LIMITS[seccion], seccion: SECCION_LABEL[seccion] }))
          return
        }
      }
      if (t2 === 'deuda' && deudas.filter((d) => d.tipo === 'deuda').length >= FREE_LIMITS.maxDeudas) {
        setShowPaywall(t('cn_paywall_limite_deudas', { n: FREE_LIMITS.maxDeudas }))
        return
      }
      if (t2 === 'credito' && deudas.filter((d) => d.tipo === 'credito').length >= FREE_LIMITS.maxCuentasPorCobrar) {
        setShowPaywall(t('cn_paywall_limite_cxc', { n: FREE_LIMITS.maxCuentasPorCobrar }))
        return
      }
    }
    setTipo(t2)
    signalTourAction('cuenta-tipo-elegido')
    if (t2 === 'cuenta_bancaria') setStep('subtype-bank')
    else if (t2 === 'deuda' || t2 === 'credito') setStep('subtype-debt')
    else setStep('form')
  }

  // "Bolsillo" no es un tipo aparte por dentro — es una cuenta bancaria
  // marcada como ahorro, con tasa EA — pero como opción, en la pantalla,
  // se siente como su propia cosa (así es como la gente piensa en un
  // Nu/Lulo Bank), no como un checkbox escondido más abajo en el form.
  function chooseBolsillo() {
    if (!esPro) {
      setShowPaywall(t('cn_paywall_bolsillo'))
      return
    }
    setTipo('cuenta_bancaria')
    setSubtipo('Cuenta de ahorros')
    setEsAhorro(true)
    setStep('form')
  }

  function chooseBanco(nombreBanco: string) {
    setBanco(nombreBanco || null)
    const found = BANCOS_TODOS.find((b) => b.nombre === nombreBanco) ?? bancosPersonalizados.find((b) => b.nombre === nombreBanco)
    setColorElegido(found?.color ?? null)
    if (!nombreBanco) setDiseno('clasico')
    // Auto-sugiere la moneda según el banco elegido — un banco de
    // EE.UU. casi siempre es una cuenta en dólares, uno de Europa en
    // euros, uno de México en pesos mexicanos. El resto no fuerza nada
    // (varios sí ofrecen cuentas en USD, y CashFlow no maneja otras
    // monedas todavía). Sigue siendo editable después — esto solo
    // precarga el valor más probable.
    const monedaSugerida = BANCO_MONEDA_DE[nombreBanco]
    if (monedaSugerida) setMoneda(monedaSugerida)
  }

  // Envoltorio de seguridad: si algo lanza una excepción a mitad de
  // guardar (red caída a medias, dato inesperado), el botón no se queda
  // pegado en "Guardando…" ni la pantalla se pone en blanco — se avisa.
  async function save() {
    try {
      await guardar()
    } catch (e) {
      setSaving(false)
      await appAlert(t('cn_error_guardar', { msg: e instanceof Error ? e.message : String(e) }))
    }
  }

  async function guardar() {
    if (!user || !tipo) return

    // Al editar una deuda o crédito: el valor total no puede quedar en 0
    // ni por debajo de lo que ya se pagó (quedaría un saldo negativo y
    // los pagos y proyecciones dejarían de tener sentido).
    if (isEdit && (tipo === 'deuda' || tipo === 'credito')) {
      const actual = deudas.find((d) => d.id === id)
      if (capitalNum <= 0) { await appAlert(t('cn_error_capital_cero')); return }
      if (actual && capitalNum < actual.capital_pagado) {
        await appAlert(t('cn_error_capital_menor_pagado', { pagado: fmt(actual.capital_pagado) }))
        return
      }
    }

    // Chequeo definitivo — el de chooseType() era solo un aviso temprano
    // asumiendo que la cuenta NO sería de ahorros; acá ya sabemos el
    // estado final de "esAhorro", así que si lo marcaron después y esa
    // sección (Ahorros) ya está llena en Free, se bloquea aquí.
    if (!isEdit && !esPro && tipo !== 'deuda' && tipo !== 'credito') {
      const seccion = seccionCuenta(tipo, esAhorro)
      if (seccion && seccion !== 'cdt') {
        const usados = contarSeccion(cuentas, seccion)
        if (usados >= FREE_LIMITS[seccion]) {
          setShowPaywall(t('cn_paywall_limite_seccion', { n: FREE_LIMITS[seccion], seccion: SECCION_LABEL[seccion] }))
          return
        }
      }
    }

    setSaving(true)
    let error = null

    if (tipo === 'efectivo' || tipo === 'billetera_digital' || tipo === 'cuenta_bancaria' || tipo === 'monedero' || tipo === 'tarjeta_debito') {
      const tasaEaNum = esAhorro ? Number(tasaEa || 0) : 0
      if (isEdit) {
        const r = await supabase.from('cuentas').update({
          nombre, saldo: Number(saldo || 0), four_x_mil: (tipo === 'efectivo' || tipo === 'monedero') ? false : four, es_ahorro: esAhorro, color: colorElegido ?? undefined,
          banco: (tipo && REQUIERE_BANCO.has(tipo)) ? banco : null, diseno_tarjeta: (tipo && REQUIERE_BANCO.has(tipo)) ? diseno : null,
          compartida_con_id: compartir ? parejaId : null, tasa_ea: tasaEaNum, moneda,
        }).eq('id', id)
        error = r.error
      } else {
        const icono = tipo === 'efectivo' ? 'cash' : tipo === 'billetera_digital' ? 'device-mobile' : tipo === 'monedero' ? 'piggy-bank' : tipo === 'tarjeta_debito' ? 'credit-card' : 'building-bank'
        const color = colorElegido ?? (tipo === 'efectivo' ? 'lime' : tipo === 'billetera_digital' ? 'lavender' : tipo === 'monedero' ? 'teal' : tipo === 'tarjeta_debito' ? 'blue' : 'yellow')
        const r = await supabase.from('cuentas').insert({
          user_id: user.id, tipo, subtipo, nombre: nombre || 'Nueva cuenta',
          saldo: Number(saldo || 0), icono, color, four_x_mil: (tipo === 'efectivo' || tipo === 'monedero') ? false : four, es_ahorro: esAhorro, activa: true,
          banco: (tipo && REQUIERE_BANCO.has(tipo)) ? banco : null, diseno_tarjeta: (tipo && REQUIERE_BANCO.has(tipo)) ? diseno : null,
          compartida_con_id: compartir ? parejaId : null, tasa_ea: tasaEaNum, moneda,
        })
        error = r.error
      }
    } else if (tipo === 'cdt') {
      const capitalCdt = Number(saldo || 0)
      if (isEdit) {
        const r = await supabase.from('cuentas').update({
          nombre, saldo: capitalCdt, color: colorElegido ?? undefined,
          banco, diseno_tarjeta: diseno, tasa_ea: Number(tasaEa || 0), plazo_dias: plazoDias, fecha_apertura: fechaApertura, moneda,
        }).eq('id', id)
        error = r.error
      } else {
        const r = await supabase.from('cuentas').insert({
          user_id: user.id, tipo, nombre: nombre || 'Nuevo CDT',
          saldo: capitalCdt, icono: 'lock', color: colorElegido ?? 'lavender', four_x_mil: false, es_ahorro: false, activa: true,
          banco, diseno_tarjeta: diseno, tasa_ea: Number(tasaEa || 0), plazo_dias: plazoDias, fecha_apertura: fechaApertura, moneda,
        })
        error = r.error
      }
    } else if (tipo === 'tarjeta_credito') {
      const cupo = Number(saldo || 0)
      const cuotaManejoNum = Number(cuotaManejo || 0)
      const tasaTarjetaNum = Number(tasaInteresTarjeta || 0)
      const corteNum = diaCorte ? Number(diaCorte) : null
      const pagoNum = diaPago ? Number(diaPago) : null
      if (isEdit) {
        const r = await supabase.from('cuentas').update({
          nombre, cupo_total: cupo, four_x_mil: four, color: colorElegido ?? undefined, banco, diseno_tarjeta: diseno,
          cuota_manejo: cuotaManejoNum, tasa_interes: tasaTarjetaNum, dia_corte: corteNum, dia_pago: pagoNum, moneda,
        }).eq('id', id)
        error = r.error
      } else {
        const r = await supabase.from('cuentas').insert({
          user_id: user.id, tipo, nombre: nombre || 'Nueva tarjeta',
          saldo: cupo, cupo_total: cupo, icono: 'credit-card', color: colorElegido ?? 'coral', four_x_mil: four, activa: true, banco, diseno_tarjeta: diseno,
          cuota_manejo: cuotaManejoNum, tasa_interes: tasaTarjetaNum, dia_corte: corteNum, dia_pago: pagoNum, moneda,
        })
        error = r.error
      }
    } else if (tipo === 'deuda' || tipo === 'credito') {
      const plazoNum = plazoMeses ? Number(plazoMeses) : null
      const cuotaNum = cuotaMensual ? Number(cuotaMensual) : null
      if (isEdit) {
        const r = await supabase.from('deudas_creditos').update({
          nombre, capital: capitalNum, tasa_interes: tasaNum, periodo_interes: periodo,
          plazo_meses: plazoNum, cuota_mensual: cuotaNum, gasto_fijo_id: gastoFijoVinculado,
          compartida_con_id: compartir ? parejaId : null, fecha_limite: fechaLimite || null, notif_dias_antes: (fechaLimite && notifActivo) ? Number(notifDiasAntes || 1) : null,
        }).eq('id', id)
        error = r.error

        // Mismo mecanismo que al crear — si puso algo en "agregar abono
        // retroactivo", se registra como un pago real de pagos_deuda
        // (nunca directo en capital_pagado, ver la nota grande de abajo
        // en la rama de creación) para que el trigger lo sume bien.
        const abonoRetro = Number(capitalPagadoInicial || 0)
        if (!error && id && abonoRetro > 0) {
          const rPago = await supabase.from('pagos_deuda').insert({
            deuda_id: id, monto_total: abonoRetro, monto_interes: 0, monto_capital: abonoRetro,
            fecha: todayLocal(), notas: t('cn_nota_abono_retro'),
          })
          error = rPago.error
        }
      } else {
        // capital_pagado NO se pone directo acá — hay un trigger
        // (sync_pago_deuda, ver 02_cashflow_schema.sql) que RECALCULA
        // ese campo cada vez que se agrega/edita/borra un pago real de
        // pagos_deuda, tomando la suma de ahí — nunca respeta un valor
        // puesto a mano en la fila de la deuda. Si se pusiera acá
        // directo (como hacía antes), se vería bien un rato, pero en
        // cuanto se registrara el PRIMER pago real después de crear la
        // deuda, el trigger lo pisaría solo y ese abono inicial
        // desaparecería sin ningún aviso — exactamente el mismo tipo de
        // bug que el de las columnas faltantes de Bryan, solo que acá
        // no truena, simplemente pierde el dato calladito. La forma
        // correcta: crear un pago real de pagos_deuda con lo que ya se
        // había abonado antes de empezar a usar CashFlow, así el trigger
        // lo suma para siempre junto con los pagos reales que vengan.
        const r = await supabase.from('deudas_creditos').insert({
          user_id: user.id, tipo, subtipo, nombre: nombre || (tipo === 'deuda' ? 'Nueva deuda' : 'Nuevo crédito'),
          capital: capitalNum,
          tipo_interes: interes ?? 'sin_interes', tasa_interes: tasaNum, periodo_interes: periodo,
          plazo_meses: plazoNum, cuota_mensual: cuotaNum, gasto_fijo_id: tipo === 'deuda' ? gastoFijoVinculado : null,
          fecha_inicio: todayLocal(), estado: 'activa', fecha_limite: fechaLimite || null, notif_dias_antes: (fechaLimite && notifActivo) ? Number(notifDiasAntes || 1) : null,
          compartida_con_id: compartir ? parejaId : null,
        }).select('id').single()
        error = r.error

        const abonoInicial = Number(capitalPagadoInicial || 0)
        if (!error && r.data && abonoInicial > 0) {
          const rPago = await supabase.from('pagos_deuda').insert({
            deuda_id: r.data.id, monto_total: abonoInicial, monto_interes: 0, monto_capital: abonoInicial,
            fecha: todayLocal(), notas: t('cn_nota_abono_inicial'),
          })
          error = rPago.error
        }
      }
    }

    setSaving(false)
    if (error) { await appAlert(t('cn_error_guardar', { msg: (error as { message: string }).message })); return }
    signalTourAction('cuenta-guardada')
    navigate(-1)
  }

  async function removeCuenta() {
    if (!tipo) return
    if (!(await appConfirm(t('cn_confirmar_borrar', { nombre }), { danger: true }))) return
    setDeleting(true)
    const table = (tipo === 'deuda' || tipo === 'credito') ? 'deudas_creditos' : 'cuentas'
    const { error } = await supabase.from(table).delete().eq('id', id)
    setDeleting(false)
    if (error) {
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        await appAlert(t('cn_error_borrar_fk'))
      } else {
        await appAlert(t('cn_error_borrar', { msg: error.message }))
      }
      return
    }
    await reload()
    navigate(-1)
  }

  // Si el subtipo ya es bancario, esa pregunta de interés se salta —
  // el flujo real para esa deuda solo tiene 2 pasos, no 3.
  const dots = isDebt ? (isBancario ? 2 : 3) : tipo === 'cuenta_bancaria' ? 2 : 1
  const doneDots = step === 'type' ? 1 : step === 'subtype-bank' ? 2 : step === 'subtype-debt' ? Math.min(2, dots) : step === 'interest' ? 3 : dots

  // Primer paso de un flujo rápido (entramos con ?tipo=... y aquí no hay
  // "atrás" real dentro del wizard) → no mostramos flecha, como en 'type'.
  const isQuickEntryFirstStep = quickEntry && (
    step === 'subtype-bank' ||
    step === 'subtype-debt' ||
    (step === 'form' && !isDebt && tipo !== 'cuenta_bancaria') // ej. tarjeta_credito: el form ES el primer paso
  )
  const showBack = step !== 'type' && !isQuickEntryFirstStep

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        {showBack ? (
          <button onClick={back} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div style={{ width: 34 }} />
        )}
        <div className="text-[15px] font-semibold font-display">
          {step === 'type' ? t('cn_que_agregar') : isEdit ? t('cn_editar') : nombre || (isDebt ? (tipo === 'deuda' ? t('cn_nueva_deuda') : t('cn_nuevo_credito')) : t('cn_nueva_cuenta'))}
        </div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      {step !== 'type' && !isEdit && (
        <div className="flex flex-shrink-0 gap-1.5 px-5 pb-3">
          {Array.from({ length: dots }, (_, idx) => idx + 1).map((i) => (
            <div key={i} className="h-0.75 flex-1 rounded" style={{ height: 3, background: i <= doneDots ? 'var(--lime)' : 'var(--card-2)' }} />
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:flex md:justify-center">
        <div className="md:w-[420px]">
        {step === 'type' && (
          <>
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              {modoAhorro ? t('cn_solo_ahorro') : t('cn_elige_tipo')}
            </div>
            {(modoAhorro ? TYPE_OPTS.filter((o) => TIPOS_AHORRO.includes(o.id)) : TYPE_OPTS).map((o) => (
              <button key={o.id} onClick={() => chooseType(o.id)} data-tour={o.id === 'efectivo' ? 'cn-tipo-efectivo' : undefined} className="flex w-full items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
                <IconCircle icono={ICON_MAP[o.icon]} color={o.color} size={38} />
                <div className="text-left">
                  <div className="text-[13px] font-medium">{t(TYPE_LABEL_KEYS[o.id].nombre)}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t(TYPE_LABEL_KEYS[o.id].desc)}</div>
                </div>
                <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-3)' }} />
              </button>
            ))}

            {modoAhorro && (
              <>
                <div className="mb-2 mt-5 flex items-center gap-2.5">
                  <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('cn_o_si_paga_interes')}</div>
                  <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
                </div>
                <button onClick={chooseBolsillo} className="flex w-full items-center gap-3 py-3">
                  <IconCircle icono="piggy-bank" color="teal" size={38} />
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      {t('cn_bolsillo')}
                      <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>PRO</span>
                    </div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t('cn_bolsillo_desc')}</div>
                  </div>
                  <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-3)' }} />
                </button>
              </>
            )}
          </>
        )}

        {step === 'subtype-bank' && (
          <>
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('cn_que_tipo_cuenta')}</div>
            {BANK_SUBTYPES.map((s) => (
              <button key={s} onClick={() => { setSubtipo(s); setStep('form') }} className="flex w-full items-center py-3 text-left text-[13px]" style={{ borderBottom: '1px solid var(--line)' }}>
                {s}
                <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-3)' }} />
              </button>
            ))}
          </>
        )}

        {step === 'subtype-debt' && (
          <>
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              {tipo === 'deuda' ? t('cn_a_quien_debes') : t('cn_a_quien_prestaste')}
            </div>
            {(tipo === 'deuda' ? DEBT_SUBTYPES : CREDIT_SUBTYPES).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSubtipo(s)
                  const def = DEFAULT_INTEREST[s]
                  if (SUBTIPOS_BANCARIOS.has(s)) {
                    // Solo hay una forma lógica de cobrar interés aquí — ni
                    // siquiera se pregunta, se usa esa y se sigue de una
                    // (pero sigue necesitando Pro, igual que antes).
                    if (!esPro) {
                      setShowPaywall(t('cn_paywall_interes_deudas'))
                      return
                    }
                    setInteres(def ?? 'sobre_saldo')
                    setStep('form')
                  } else {
                    setInteres(esPro || def === 'sin_interes' ? def ?? null : null)
                    setStep('interest')
                  }
                }}
                className="flex w-full items-center py-3 text-left text-[13px]"
                style={{ borderBottom: '1px solid var(--line)' }}
              >
                {s}
                <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-3)' }} />
              </button>
            ))}
          </>
        )}

        {step === 'interest' && (
          <>
            <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('cn_como_cobra_interes')}</div>
            {INTEREST_OPTS.map((o) => {
              const locked = o.id !== 'sin_interes' && !esPro
              return (
                <button
                  key={o.id}
                  onClick={() => locked
                    ? setShowPaywall(t('cn_paywall_interes_deudas'))
                    : setInteres(o.id)}
                  className="mb-2.5 w-full rounded-2xl p-3.5 text-left"
                  style={{ border: `1.5px solid ${interes === o.id ? 'var(--lime)' : 'var(--line)'}`, background: interes === o.id ? 'var(--lime-dim)' : 'var(--card)', opacity: locked ? 0.7 : 1 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                      {t(o.nombre)}
                      {locked && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>PRO</span>}
                    </div>
                    <div className="h-4.5 w-4.5 rounded-full" style={{ width: 18, height: 18, border: `1.5px solid ${interes === o.id ? 'var(--lime)' : 'var(--line)'}`, background: interes === o.id ? 'var(--lime)' : 'transparent' }} />
                  </div>
                  <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t(o.desc)}</div>
                </button>
              )
            })}
            <button
              onClick={() => interes && setStep('form')}
              disabled={!interes}
              className="mt-2 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
              style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
            >
              {t('cn_continuar')}
            </button>
          </>
        )}

        {step === 'form' && (
          <>
            {(tipo && REQUIERE_BANCO.has(tipo)) && (
              <>
                <FieldLabel>{t('cn_cual_banco')}</FieldLabel>
                <button
                  onClick={() => setShowBancoPicker(true)}
                  className="mb-1 flex w-full items-center gap-2.5 rounded-2xl px-4 py-3.5 text-left text-[13px]"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: banco ? 'var(--text-1)' : 'var(--text-3)' }}
                >
                  {banco && (
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: (COLORS[colorElegido ?? 'lavender'] ?? COLORS.lavender).fg }} />
                  )}
                  <span className="flex-1">{banco ?? t('cn_selecciona_banco')}</span>
                  <ChevronDown size={15} style={{ color: 'var(--text-3)' }} />
                </button>

                {banco && (
                  <>
                    <div className="mb-2 mt-3 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>{t('cn_diseno')}</div>
                    <div className="mb-4 flex gap-2.5">
                      {DISENOS_TARJETA.map((d) => {
                        const est = estiloTarjeta(colorElegido, d)
                        const label = d === 'clasico' ? t('cn_diseno_clasico') : d === 'oscuro' ? t('cn_diseno_oscuro') : t('cn_diseno_claro')
                        const sel = diseno === d
                        return (
                          <button
                            key={d}
                            onClick={() => setDiseno(d)}
                            className="relative overflow-hidden rounded-xl"
                            style={{ width: 76, height: 46, background: est.background, boxShadow: sel ? '0 0 0 2px var(--bg), 0 0 0 4px var(--lime)' : 'none' }}
                          >
                            <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 15% 0%, rgba(255,255,255,0.18), transparent 55%)' }} />
                            <div className="absolute bottom-1.5 left-2 text-[8px] font-semibold" style={{ color: est.text }}>{label}</div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Vista previa en vivo — chip, contactless, número
                        disfrazado con el saldo (así no se repite la plata
                        dos veces), titular, y una marca de red genérica
                        (dos círculos, no es Visa/Mastercard). */}
                    {(() => {
                      const est = estiloTarjeta(colorElegido, diseno)
                      return (
                        <div className="relative mb-4 overflow-hidden rounded-2xl p-4" style={{ aspectRatio: '1.586', background: est.background }}>
                          {diseno === 'oscuro' && (
                            <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px)' }} />
                          )}
                          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(255,255,255,0.22), transparent 55%)' }} />
                          <img
                            src={logoBlanco}
                            alt=""
                            className="absolute pointer-events-none select-none"
                            style={{ right: 6, top: '18%', width: 92, opacity: 0.2, filter: 'blur(1px)', transform: 'rotate(-18deg)' }}
                          />
                          <div className="relative flex h-full flex-col justify-between">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-[13px] font-bold font-display" style={{ color: est.text }}>{banco}</div>
                                <div className="mt-0.5 text-[7.5px] uppercase tracking-wide opacity-70" style={{ color: est.text }}>
                                  {tipo === 'tarjeta_credito' ? t('cn_credito_label') : t('cn_debito_label')}
                                </div>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: est.text, opacity: 0.8, transform: 'rotate(45deg)' }}>
                                <path d="M4 12a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M7 12a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                              </svg>
                            </div>

                            <div className="relative" style={{ width: 32, height: 24, borderRadius: 5, background: 'linear-gradient(135deg, #F3D98B, #C9A227)' }}>
                              <div className="absolute inset-1 rounded-sm" style={{ border: '1px solid rgba(0,0,0,0.22)' }} />
                            </div>

                            <div className="font-mono text-[13px] font-semibold tracking-[2px]" style={{ color: est.text, opacity: 0.9 }}>
                              {maskedNumero(Number(saldo || 0))}
                            </div>

                            <div className="flex items-end justify-between">
                              <div>
                                <div className="text-[6.5px] uppercase tracking-wide opacity-60" style={{ color: est.text }}>{t('cn_titular')}</div>
                                <div className="font-mono text-[10px] font-semibold uppercase" style={{ color: est.text }}>{getNombreCompleto(user) || t('cn_tu_nombre')}</div>
                              </div>
                              <div className="flex">
                                <div className="h-4 w-4 rounded-full" style={{ background: est.text, opacity: 0.55 }} />
                                <div className="-ml-2 h-4 w-4 rounded-full" style={{ background: '#fff', opacity: 0.85, mixBlendMode: 'overlay' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </>
            )}

            <FieldLabel>{t('cn_nombre_personalizado')}</FieldLabel>
            <InputRow
              icon={<Tag size={16} />}
              placeholder={
                tipo === 'deuda' ? t('cn_placeholder_deuda')
                : tipo === 'credito' ? t('cn_placeholder_credito')
                : (tipo && REQUIERE_BANCO.has(tipo)) ? t('cn_placeholder_banco_opcional')
                : tipo === 'monedero' ? t('cn_placeholder_monedero')
                : t('cn_placeholder_generico')
              }
              value={nombre}
              onChange={setNombre}
            />

            <FieldLabel>{t('cn_moneda')}</FieldLabel>
            <div className="mb-2.5 grid grid-cols-4 gap-2">
              {(['COP', 'USD', 'EUR', 'MXN'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMoneda(m)}
                  className="rounded-2xl py-2.5 text-center text-[12px] font-semibold"
                  style={moneda === m ? { background: 'var(--lime-dim)', color: 'var(--lime)', border: '1.5px solid var(--lime)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1.5px solid var(--line)' }}
                >
                  {m}
                </button>
              ))}
            </div>
            {moneda !== 'COP' && (
              <div className="mb-2.5 rounded-xl px-3 py-2 text-[10px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
                {t('cn_moneda_nota', { moneda })}
              </div>
            )}

            {isDebt ? (
              <>
                <FieldLabel>{tipo === 'deuda' ? t('cn_capital_debes') : t('cn_capital_prestaste')}</FieldLabel>
                <InputRow icon={<DollarSign size={16} />} placeholder="1.000.000" value={capital} onChange={(v) => setCapital(v.replace(/[^0-9]/g, ''))} numeric />

                <>
                  <FieldLabel>{isEdit ? t('cn_agregar_abono_retro') : (tipo === 'deuda' ? t('cn_ya_dado_cuotas') : t('cn_ya_pagado_algo'))}</FieldLabel>
                  <InputRow icon={<DollarSign size={16} />} placeholder={t('cn_placeholder_apenas_empiezas')} value={capitalPagadoInicial} onChange={(v) => setCapitalPagadoInicial(v.replace(/[^0-9]/g, ''))} numeric />
                  <div className="mb-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                    {isEdit ? t('cn_agregar_abono_retro_nota') : t('cn_si_ya_pagas')}
                  </div>
                </>

                <FieldLabel>{t('cn_fecha_corte')}</FieldLabel>
                <button
                  onClick={() => setShowFechaLimite(true)}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <CalendarClock size={16} style={{ color: 'var(--text-3)' }} />
                  <span className="text-[13px]" style={{ color: fechaLimite ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {fechaLimite ? parseLocalDate(fechaLimite).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : t('cn_selecciona_fecha')}
                  </span>
                </button>
                <div className="mb-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {t('cn_activa_notif_perfil')}
                </div>

                {fechaLimite && (
                  <>
                    <div className="mt-3 flex items-center justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                      <div className="text-[12.5px]">{t('cn_quieres_aviso')}</div>
                      <button onClick={() => setNotifActivo(!notifActivo)} className="relative flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: notifActivo ? 'var(--lime)' : 'var(--card-2)' }}>
                        <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: notifActivo ? 'var(--lime-text)' : 'var(--text-3)', left: notifActivo ? 18 : 2, transition: 'left .15s' }} />
                      </button>
                    </div>
                    {notifActivo && (
                      <>
                        <FieldLabel>{t('cn_cuantos_dias_antes')}</FieldLabel>
                        <InputRow icon={<CalendarClock size={16} />} placeholder={t('cn_ej', { v: 1 })} value={notifDiasAntes} onChange={(v) => setNotifDiasAntes(v.replace(/[^0-9]/g, ''))} numeric />
                      </>
                    )}
                  </>
                )}


                {interes !== 'sin_interes' && (
                  <>
                    <FieldLabel>{t('cn_tasa_interes')}</FieldLabel>
                    <InputRow icon={<Percent size={16} />} placeholder="20" value={tasa} onChange={(v) => setTasa(v.replace(/[^0-9.]/g, ''))} numeric />

                    <FieldLabel>{t('cn_cada_cuanto_cobra')}</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {PERIODOS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriodo(p)}
                          className="rounded-2xl px-3.5 py-2.5 text-[12px] font-medium"
                          style={periodo === p
                            ? { background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid var(--coral)' }
                            : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
                        >
                          {t(PERIODO_KEYS[p])}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {isBancario && (
                  <>
                    <FieldLabel>{t('cn_plazo_meses')}</FieldLabel>
                    <InputRow icon={<CalendarClock size={16} />} placeholder={t('cn_ej', { v: 60 })} value={plazoMeses} onChange={(v) => setPlazoMeses(v.replace(/[^0-9]/g, ''))} numeric />

                    <FieldLabel>{t('cn_cuota_mensual')}</FieldLabel>
                    <InputRow icon={<DollarSign size={16} />} placeholder={t('cn_placeholder_cuota_banco')} value={cuotaMensual} onChange={(v) => setCuotaMensual(v.replace(/[^0-9]/g, ''))} numeric />
                  </>
                )}

                {tipo === 'deuda' && (
                  <>
                    <FieldLabel>{t('cn_hace_parte_gastos_fijos')}</FieldLabel>
                    <div className="mb-1 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                      {t('cn_vinculo_nota')}
                    </div>
                    {gastosFijos.length === 0 ? (
                      <div className="rounded-2xl p-3.5 text-[11px]" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
                        {t('cn_sin_gastos_fijos')}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setGastoFijoVinculado(null)}
                          className="rounded-2xl px-3.5 py-3 text-left text-[12.5px] font-medium"
                          style={{ border: `1.5px solid ${gastoFijoVinculado === null ? 'var(--coral)' : 'var(--line)'}`, background: gastoFijoVinculado === null ? 'var(--coral-dim)' : 'var(--card)' }}
                        >
                          {t('cn_es_aparte')}
                        </button>
                        {gastosFijos.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setGastoFijoVinculado(g.id)}
                            className="flex items-center justify-between rounded-2xl px-3.5 py-3 text-left text-[12.5px] font-medium"
                            style={{ border: `1.5px solid ${gastoFijoVinculado === g.id ? 'var(--coral)' : 'var(--line)'}`, background: gastoFijoVinculado === g.id ? 'var(--coral-dim)' : 'var(--card)' }}
                          >
                            {g.nombre}
                            <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{fmt(g.monto)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {interes === 'fijo_capital' && capitalNum > 0 && tasaNum > 0 && (
                  <div className="mt-1.5 flex gap-2.5 rounded-2xl p-3.5" style={{ background: 'var(--coral-dim)', border: '1px solid var(--coral)' }}>
                    <AlertTriangle size={17} style={{ color: 'var(--coral)', flexShrink: 0, marginTop: 1 }} />
                    <div className="text-xs leading-relaxed">
                      {t('cn_interes_fijo_aviso', {
                        cuota: fmt(cuotaFija),
                        periodo: t(PERIODO_KEYS[periodo]).toLowerCase(),
                        capital: fmt(capitalNum),
                        no: t('cn_no_enfasis'),
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <FieldLabel>{tipo === 'tarjeta_credito' ? t('cn_cupo_total') : tipo === 'cdt' ? t('cn_capital_invertir') : t('cn_saldo_actual')}</FieldLabel>
                <InputRow icon={<DollarSign size={16} />} placeholder="0" value={saldo} onChange={(v) => setSaldo(v.replace(/[^0-9]/g, ''))} numeric />
              </>
            )}

            {tipo === 'cdt' && (
              <>
                <FieldLabel>{t('cn_tasa_ea_ofrecida')}</FieldLabel>
                <InputRow icon={<Percent size={16} />} placeholder={t('cn_ej', { v: '11.8' })} value={tasaEa} onChange={(v) => setTasaEa(v.replace(/[^0-9.]/g, ''))} numeric />

                <FieldLabel>{t('cn_plazo')}</FieldLabel>
                <div className="grid grid-cols-3 gap-2.5">
                  {[90, 180, 360].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlazoDias(p)}
                      className="rounded-2xl py-2.5 text-center text-[12px] font-semibold"
                      style={plazoDias === p
                        ? { background: 'var(--lavender-dim)', border: '1px solid var(--lavender)', color: 'var(--lavender)' }
                        : { background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}
                    >
                      {t('cn_dias', { n: p })}
                    </button>
                  ))}
                </div>

                <FieldLabel>{t('cn_fecha_apertura')}</FieldLabel>
                <InputRow icon={<CalendarClock size={16} />} placeholder="" value={fechaApertura} onChange={setFechaApertura} />

                {Number(saldo) > 0 && Number(tasaEa) > 0 && (
                  <div className="mt-3 rounded-2xl p-3.5" style={{ background: 'var(--card-2)' }}>
                    <div className="flex justify-between py-1 text-[11px]"><span style={{ color: 'var(--text-2)' }}>{t('cn_capital')}</span><span className="font-mono">{fmt(Number(saldo))}</span></div>
                    <div className="flex justify-between py-1 text-[11px]"><span style={{ color: 'var(--text-2)' }}>{t('cn_interes_estimado')}</span><span className="font-mono" style={{ color: 'var(--lavender)' }}>+{fmt(proyeccionInteres(Number(saldo), Number(tasaEa), plazoDias))}</span></div>
                    <div className="mt-1 flex justify-between border-t pt-2 text-[11.5px] font-bold" style={{ borderColor: 'var(--line)' }}>
                      <span>{t('cn_recibes_el', { fecha: fechaVencimiento(fechaApertura, plazoDias).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' }) })}</span>
                      <span className="font-mono">{fmt(montoFinalCDT(Number(saldo), Number(tasaEa), plazoDias))}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {tipo === 'tarjeta_credito' && (
              <>
                <FieldLabel>{t('cn_cuota_manejo')}</FieldLabel>
                <InputRow icon={<DollarSign size={16} />} placeholder={t('cn_placeholder_no_cobra')} value={cuotaManejo} onChange={(v) => setCuotaManejo(v.replace(/[^0-9]/g, ''))} numeric />

                <FieldLabel>{t('cn_interes_mensual')}</FieldLabel>
                <InputRow icon={<Percent size={16} />} placeholder={t('cn_ej', { v: '2.4' })} value={tasaInteresTarjeta} onChange={(v) => setTasaInteresTarjeta(v.replace(/[^0-9.]/g, ''))} numeric />

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>{t('cn_dia_corte')}</FieldLabel>
                    <InputRow icon={<CalendarClock size={16} />} placeholder={t('cn_ej', { v: 20 })} value={diaCorte} onChange={(v) => setDiaCorte(v.replace(/[^0-9]/g, '').slice(0, 2))} numeric />
                  </div>
                  <div>
                    <FieldLabel>{t('cn_dia_limite_pago')}</FieldLabel>
                    <InputRow icon={<CalendarClock size={16} />} placeholder={t('cn_ej', { v: 5 })} value={diaPago} onChange={(v) => setDiaPago(v.replace(/[^0-9]/g, '').slice(0, 2))} numeric />
                  </div>
                </div>
                <div className="mb-2 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {t('cn_proyeccion_corte_nota')}
                </div>
              </>
            )}

            {!isDebt && !(tipo && REQUIERE_BANCO.has(tipo)) && (
              <>
                <FieldLabel>{t('cn_color')}</FieldLabel>
                <div className="mb-1 flex flex-wrap gap-2.5">
                  {Object.entries(COLORS).map(([key, col]) => {
                    const sel = (colorElegido ?? (tipo === 'efectivo' ? 'lime' : tipo === 'monedero' ? 'teal' : 'lavender')) === key
                    return (
                      <button
                        key={key}
                        onClick={() => setColorElegido(key)}
                        className="flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ background: col.fg, boxShadow: sel ? '0 0 0 2px var(--bg), 0 0 0 4px ' + col.fg : 'none' }}
                        title={key}
                      >
                        {sel && <Check size={15} style={{ color: 'var(--bg)' }} />}
                      </button>
                    )
                  })}
                </div>
                <div className="mb-2 text-[10px]" style={{ color: 'var(--text-3)' }}>{t('cn_color_nota')}</div>
              </>
            )}

            {canShowFour && (
              <>
                <FieldLabel>{t('cn_4x1000_titulo')}</FieldLabel>
                <div className="flex items-start justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{t('cn_4x1000_descontar')}</div>
                    <div className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('cn_4x1000_nota')}</div>
                  </div>
                  <button onClick={() => setFour(!four)} className="relative mt-0.5 flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: four ? 'var(--lime)' : 'var(--card-2)' }}>
                    <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: four ? 'var(--lime-text)' : 'var(--text-3)', left: four ? 18 : 2, transition: 'left .15s' }} />
                  </button>
                </div>
              </>
            )}

            {!isDebt && tipo !== 'tarjeta_credito' && tipo !== 'cdt' && (
              <>
                <FieldLabel>{t('cn_cuenta_ahorros_titulo')}</FieldLabel>
                <div className="flex items-start justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{t('cn_dedicarla_ahorrar')}</div>
                    <div className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('cn_ahorro_nota')}</div>
                  </div>
                  <button onClick={() => setEsAhorro(!esAhorro)} className="relative mt-0.5 flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: esAhorro ? 'var(--lime)' : 'var(--card-2)' }}>
                    <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: esAhorro ? 'var(--lime-text)' : 'var(--text-3)', left: esAhorro ? 18 : 2, transition: 'left .15s' }} />
                  </button>
                </div>

                {esAhorro && tipo !== 'efectivo' && (
                  esPro ? (
                    <>
                      <FieldLabel>{t('cn_te_paga_interes')}</FieldLabel>
                      <InputRow icon={<Percent size={16} />} placeholder={t('cn_placeholder_tasa_ea')} value={tasaEa} onChange={(v) => setTasaEa(v.replace(/[^0-9.]/g, ''))} numeric />
                      {Number(tasaEa) > 0 && Number(saldo) > 0 && (
                        <div className="mb-2 mt-2 rounded-xl p-3 text-[10.5px] leading-relaxed" style={{ background: 'var(--teal-dim, rgba(95,224,200,.14))', color: 'var(--teal)' }}>
                          {t('cn_proyeccion_interes', { mes: fmt(proyeccionInteres(Number(saldo), Number(tasaEa), 30)), anio: fmt(proyeccionInteres(Number(saldo), Number(tasaEa), 365)) })}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setShowPaywall(t('cn_paywall_interes_reason'))}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-2xl p-3 text-left"
                      style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}
                    >
                      <Percent size={15} style={{ color: 'var(--lime)', flexShrink: 0 }} />
                      <div className="text-[11px]" style={{ color: 'var(--lime)' }}>{t('cn_paywall_interes')}</div>
                    </button>
                  )
                )}
              </>
            )}

            {parejaId && tipo !== 'tarjeta_credito' && (
              <>
                <FieldLabel>{t('cn_pro_duo')}</FieldLabel>
                <div className="flex items-start justify-between rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{t('cn_compartir_con', { pareja: partnerName ?? t('cn_tu_pareja') })}</div>
                    <div className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                      {isDebt
                        ? t('cn_compartir_deuda_nota')
                        : t('cn_compartir_cuenta_nota')}
                    </div>
                  </div>
                  <button onClick={() => setCompartir(!compartir)} className="relative mt-0.5 flex-shrink-0 rounded-full" style={{ width: 38, height: 22, background: compartir ? 'var(--lavender)' : 'var(--card-2)' }}>
                    <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: compartir ? 'var(--bg)' : 'var(--text-3)', left: compartir ? 18 : 2, transition: 'left .15s' }} />
                  </button>
                </div>
              </>
            )}


            <button onClick={save} data-tour="cn-guardar" disabled={saving} className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
              {saving ? t('cn_guardando') : isEdit ? t('cn_guardar_cambios') : t('cn_guardar')}
            </button>

            {isEdit && (
              <button
                onClick={removeCuenta}
                disabled={deleting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
              >
                <Trash2 size={15} /> {deleting ? t('cn_borrando') : t('cn_borrar')}
              </button>
            )}
          </>
        )}
        </div>
      </div>

      {showFechaLimite && (
        <CenterModal onClose={() => setShowFechaLimite(false)} maxWidth={320}>
          <CalendarPicker value={fechaLimite || todayLocal()} onChange={(v) => { setFechaLimite(v); setShowFechaLimite(false) }} />
        </CenterModal>
      )}
      {showPaywall && <ProPaywallSheet reason={showPaywall} onClose={() => setShowPaywall(null)} />}

      {showBancoPicker && (() => {
        const q = bancoQuery.trim().toLowerCase()
        const cerrarPicker = () => { setShowBancoPicker(false); setBancoQuery('') }
        const gruposBase = verTodosContinentes ? BANCOS_GRUPOS : BANCOS_GRUPOS.filter((g) => g.id === miContinente)
        const gruposFiltrados = gruposBase
          .map((g) => ({ ...g, bancos: q ? g.bancos.filter((b) => b.nombre.toLowerCase().includes(q)) : g.bancos }))
          .filter((g) => g.bancos.length > 0)
        const personalizadosFiltrados = q ? bancosPersonalizados.filter((b) => b.nombre.toLowerCase().includes(q)) : bancosPersonalizados
        const sinResultados = q.length > 0 && personalizadosFiltrados.length === 0 && gruposFiltrados.length === 0
        return (
        <CenterModal onClose={cerrarPicker} maxWidth={380}>
          <div className="mb-3 text-center text-[14px] font-bold font-display">{t('cn_cual_banco')}</div>
          {/* Buscador — filtra dentro de lo que ya es visible (respeta el
          candado Pro de continentes: a un usuario Free buscando "Santander"
          no le aparece el de España si solo tiene desbloqueada Sudamérica). */}
          <div className="mb-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
            <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              value={bancoQuery}
              onChange={(e) => setBancoQuery(e.target.value)}
              placeholder={t('cn_buscar_banco')}
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--text-1)' }}
            />
            {bancoQuery && (
              <button onClick={() => setBancoQuery('')} style={{ color: 'var(--text-3)' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto pb-0.5">
            {personalizadosFiltrados.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bancos_tus_bancos')}</div>
                {personalizadosFiltrados.map((b) => {
                  const sel = banco === b.nombre
                  const col = COLORS[b.color] ?? COLORS.lavender
                  return (
                    <button
                      key={b.id}
                      onClick={() => { chooseBanco(b.nombre); cerrarPicker() }}
                      className="flex w-full items-center gap-2.5 py-2.5 text-left text-[13px]"
                      style={{ borderBottom: '1px solid var(--line)' }}
                    >
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: col.fg }} />
                      <span className="flex-1">{b.nombre}</span>
                      {sel && <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
            {gruposFiltrados.map((g) => (
              <div key={g.id} className="mb-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t(GRUPO_BANCO_LABEL_KEYS[g.id])}</div>
                {g.bancos.map((b) => {
                  const sel = banco === b.nombre
                  const col = COLORS[b.color] ?? COLORS.lavender
                  return (
                    <button
                      key={b.nombre}
                      onClick={() => { chooseBanco(b.nombre); cerrarPicker() }}
                      className="flex w-full items-center gap-2.5 py-2.5 text-left text-[13px]"
                      style={{ borderBottom: '1px solid var(--line)' }}
                    >
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: col.fg }} />
                      <span className="flex-1">{b.nombre}</span>
                      {sel && <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            ))}
            {sinResultados && (
              <div className="py-4 text-center text-[11.5px]" style={{ color: 'var(--text-3)' }}>{t('cn_banco_sin_resultados')}</div>
            )}
            {!q && (
              <>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('cn_otro')}</div>
                <button
                  onClick={() => { chooseBanco(BANCO_OTRO); cerrarPicker() }}
                  className="mb-1 flex w-full items-center gap-2.5 py-2.5 text-left text-[13px]"
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: COLORS.lavender.fg }} />
                  <span className="flex-1">{BANCO_OTRO}</span>
                  {banco === BANCO_OTRO && <Check size={15} style={{ color: 'var(--lime)', flexShrink: 0 }} />}
                </button>
              </>
            )}
            {/* Candado Pro de continentes — solo aparece cuando de verdad
            estamos filtrando (hay país guardado y el usuario no lo ha
            desbloqueado ya). Sin país guardado no filtramos nada arriba,
            así que tampoco tiene sentido mostrar este bloque. */}
            {!verTodosContinentes && (
              esPro ? (
                <button
                  onClick={() => setBancosDesbloqueados(true)}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3"
                  style={{ background: 'var(--lime-dim)', border: '1px dashed var(--lime)' }}
                >
                  <Globe2 size={16} style={{ color: 'var(--lime)', flexShrink: 0 }} />
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--lime)' }}>{t('cn_ver_otros_continentes')}</span>
                </button>
              ) : (
                <button
                  onClick={() => { cerrarPicker(); setShowPaywall(t('bancos_desbloquear_paywall_razon')) }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3"
                  style={{ background: 'var(--card-2)', border: '1px dashed var(--line)' }}
                >
                  <Lock size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text-3)' }}>{t('cn_desbloquear_otros_continentes')}</span>
                </button>
              )
            )}
          </div>
        </CenterModal>
        )
      })()}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{children}</div>
}

function InputRow({ icon, placeholder, value, onChange, numeric }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  const isPlainDigits = numeric && value && /^\d+$/.test(value)
  return (
    <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--text-3)' }}>{icon}</span>
      <input
        value={isPlainDigits ? Number(value).toLocaleString('es-CO') : value}
        inputMode={numeric ? 'numeric' : 'text'}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: 'var(--text-1)' }}
      />
    </div>
  )
}

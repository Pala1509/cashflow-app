import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Lock, TrendingUp, ArrowLeftRight, Wand2, ChevronRight } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useAuth } from '../lib/AuthContext'
import Avatar from '../components/Avatar'
import { ICONS } from './Cuentas'
import { parseLocalDate } from '../lib/date'
import { calcularGastosHormigaProducto } from '../lib/gastosHormiga'
import { calcularProyeccion, calcularComparacionMensual } from '../lib/analisisMensual'
import ProPaywallSheet from '../components/ProPaywallSheet'
import SaludFinancieraCard from '../components/SaludFinancieraCard'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import { useTasasCambio } from '../hooks/useTasasCambio'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const FREC_DIAS: Record<string, number> = {
  quincenal: 15, mensual: 30, trimestral: 90, semestral: 180, anual: 365,
}

export default function Resumen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, idioma } = useIdioma()
  const { cuentas, deudas, metas, categorias, transacciones, ingresosFijos, presupuestos, totalCash, esPro, loading } = useFinanzas()
  const { convertirCOP } = useTasasCambio()
  const [showPaywall, setShowPaywall] = useState(false)

  const tarjetas = cuentas.filter((c) => c.tipo === 'tarjeta_credito')
  const cuentasCash = cuentas.filter((c) => c.tipo !== 'tarjeta_credito')

  const tienes = totalCash
  // Convertido a COP — una tarjeta de crédito en USD no puede sumarse
  // cruda junto a una en COP.
  const debesTarjetas = tarjetas.reduce((s, c) => s + convertirCOP((c.cupo_total ?? 0) - c.saldo, c.moneda), 0)
  const debesDeudas = deudas.filter((d) => d.tipo === 'deuda').reduce((s, d) => s + (d.capital - d.capital_pagado), 0)
  const debes = debesTarjetas + debesDeudas
  const creditos = deudas.filter((d) => d.tipo === 'credito')
  const teDeben = creditos.reduce((s, c) => s + (c.capital - c.capital_pagado), 0)
  const neto = tienes - debes + teDeben
  // Con un valor muy lopsided (ej. debes $19M vs tienes $300mil) el % real
  // redondea a 1 y la franja "tienes" de la barra de abajo prácticamente
  // desaparece — Felo lo reportó como "no se ve el otro verde". Se deja un
  // mínimo de 6% visible para cada lado (nunca 0), sacrificando exactitud
  // milimétrica de la barra a cambio de que ambas franjas siempre se vean.
  const pctTienesReal = tienes + debes > 0 ? (tienes / (tienes + debes)) * 100 : 50
  const pctTienes = Math.round(Math.min(94, Math.max(6, pctTienesReal)))

  // Antes sumaba TODO lo que la app hubiera traído de una vez (3 meses
  // para Free, últimas 50 para Pro) — no era realmente "este mes". Mismo
  // fix que ya se hizo en Inicio.
  const ahora = new Date()
  const delMesActual = transacciones.filter((t) => {
    const d = parseLocalDate(t.fecha)
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
  })
  const ingresosRecientes = delMesActual.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egresosRecientes = delMesActual.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  // La proyección de fin de mes antes se comparaba SOLO contra el sueldo
  // fijo configurado en Balance — ignoraba cualquier ingreso real que
  // entrara durante el mes (ventas, regalos, un trabajo extra...). Ahora
  // se compara contra: lo que YA entró de verdad este mes (variable +
  // fijo ya cobrado) + lo que falta por entrar de los ingresos fijos que
  // todavía no se han marcado como recibidos en su ciclo actual.
  const ingresosFijosPendientes = ingresosFijos.reduce((s, i) => {
    const ciclo = FREC_DIAS[i.frecuencia] ?? 30
    const cortePagos = new Date()
    cortePagos.setDate(cortePagos.getDate() - ciclo)
    const cobradoCiclo = transacciones
      .filter((t) => t.ingreso_fijo_id === i.id && parseLocalDate(t.fecha) >= cortePagos)
      .reduce((sum, t) => sum + t.monto, 0)
    return cobradoCiclo >= i.monto ? s : s + (i.monto - cobradoCiclo)
  }, 0)
  const proyeccionIngresosMes = ingresosRecientes + ingresosFijosPendientes

  const ahorroTotal = metas.reduce((s, g) => s + g.monto_actual, 0)
  const ahorroObjetivo = metas.reduce((s, g) => s + g.monto_objetivo, 0)

  const gastosHormiga = calcularGastosHormigaProducto(transacciones)
  const proyeccion = calcularProyeccion(transacciones)
  const comparacion = calcularComparacionMensual(transacciones).slice(0, 3)

  return (
    <div className="px-5 pt-3 md:px-8 md:pt-6">
      <div className="mb-1 flex items-center justify-between pt-2 md:justify-center">
        <div style={{ width: 34 }} className="md:hidden" />
        <div className="text-[15px] font-semibold font-display">{t('resumen_titulo')}</div>
        <div className="md:hidden">
          <Avatar user={user} size={34} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      {loading && <div className="py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>{t('resumen_cargando')}</div>}

      <div className="lg:mx-auto lg:max-w-[900px]">
        {/* Texto en negro puro, mismo criterio que Cuentas/Deudas. La barra
        SÍ vive sobre su propio track (--card-2), pero ese track está dentro
        de la tarjeta lima — el segmento --lime de la barra es el mismo
        verde que el fondo, así que a simple vista "desaparece" contra la
        tarjeta (Felo lo notó: "el verde es el mismo entonces no se ve").
        Un borde negro alrededor de la barra la separa del fondo aunque los
        colores internos coincidan. */}
        <div className="mt-1.5 rounded-3xl p-5" style={{ background: 'var(--card-lime)' }}>
          <div className="text-xs" style={{ color: '#000000', opacity: 0.65 }}>{t('resumen_patrimonio_neto')}</div>
          <div className="mt-1 text-[28px] font-bold font-display font-mono" style={{ color: '#000000' }}>{fmt(neto)}</div>
          <div className="mt-3.5 flex h-2 overflow-hidden rounded-full" style={{ background: 'var(--card-2)', border: '1.5px solid #000000' }}>
            <div style={{ width: `${pctTienes}%`, background: 'var(--lime)' }} />
            <div style={{ width: `${100 - pctTienes}%`, background: 'var(--coral)' }} />
          </div>
          <div className="mt-2 flex justify-between text-[10.5px] font-semibold">
            <span style={{ color: '#000000' }}>● {t('resumen_tienes', { monto: fmt(tienes) })}</span>
            <span style={{ color: '#000000' }}>● {t('resumen_debes', { monto: fmt(debes) })}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
            <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('resumen_ingresos_recientes')}</div>
            <div className="mt-0.5 font-mono text-base font-bold font-display" style={{ color: 'var(--lime)' }}>{fmt(ingresosRecientes)}</div>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: 'var(--card)' }}>
            <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('resumen_egresos_recientes')}</div>
            <div className="mt-0.5 font-mono text-base font-bold font-display" style={{ color: 'var(--coral)' }}>{fmt(egresosRecientes)}</div>
          </div>
        </div>

        <div className="mb-5.5 mt-6" style={{ borderTop: '1px solid var(--line)' }} />

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <div>
            <Block title={t('seccion_cuentas_efectivo')} linkLabel={t('resumen_gestionar')} onLink={() => navigate('/cuentas')}>
              {cuentasCash.length === 0 && <Empty>{t('resumen_vacio_cuentas')}</Empty>}
              {cuentasCash.map((c) => (
                <Line key={c.id} color="var(--lime)" label={c.nombre} value={fmt(c.saldo)} />
              ))}
            </Block>

            <Block title={t('seccion_deudas_creditos')} linkLabel={t('resumen_gestionar')} onLink={() => navigate('/deudas')}>
              {deudas.length === 0 && tarjetas.length === 0 && <Empty>{t('resumen_vacio_deudas')}</Empty>}
              {tarjetas.map((c) => (
                <Line key={c.id} color="var(--coral)" label={`${c.nombre}${t('resumen_usado')}`} value={fmt((c.cupo_total ?? 0) - c.saldo)} valueColor="var(--coral)" />
              ))}
              {deudas.filter((d) => d.tipo === 'deuda').map((d) => (
                <Line key={d.id} color="var(--coral)" label={d.nombre} value={fmt(d.capital - d.capital_pagado)} valueColor="var(--coral)" />
              ))}
              {creditos.map((c) => (
                <Line key={c.id} color="var(--yellow)" label={c.nombre} value={fmt(c.capital - c.capital_pagado)} valueColor="var(--yellow)" />
              ))}
            </Block>
          </div>

          <div>
            <Block title={t('seccion_metas_ahorro')} linkLabel={t('resumen_gestionar')} onLink={() => navigate('/balance')}>
              <div className="mb-2 text-[11px]" style={{ color: 'var(--text-2)' }}>
                {t('resumen_acumulado_de', { actual: fmt(ahorroTotal), objetivo: fmt(ahorroObjetivo) })}
              </div>
              {metas.length === 0 && <Empty>{t('resumen_vacio_metas')}</Empty>}
              {metas.map((g) => {
                const pct = g.monto_objetivo > 0 ? Math.round((g.monto_actual / g.monto_objetivo) * 100) : 0
                const color = g.color === 'coral' ? 'var(--coral)' : g.color === 'yellow' ? 'var(--yellow)' : g.color === 'lavender' ? 'var(--lavender)' : 'var(--lime)'
                return (
                  <div key={g.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
                    <span className="w-24 flex-shrink-0 truncate text-[11.5px]">{g.nombre}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right font-mono text-[10.5px]" style={{ color: 'var(--text-2)' }}>{pct}%</span>
                  </div>
                )
              })}
            </Block>

            <Block title={t('seccion_presupuestos')} linkLabel={t('resumen_gestionar')} onLink={() => navigate('/presupuestos')}>
              {!esPro ? (
                <Empty>{t('resumen_presupuestos_pro')}</Empty>
              ) : presupuestos.length === 0 ? (
                <Empty>{t('resumen_sin_presupuestos')}</Empty>
              ) : (
                presupuestos.map((p) => {
                  const cat = categorias.find((c) => c.id === p.categoria_id)
                  const gastado = delMesActual
                    .filter((t) => t.tipo === 'egreso' && t.categoria_id === p.categoria_id)
                    .reduce((s, t) => s + t.monto + t.monto_4x1000, 0)
                  const pct = p.monto_limite > 0 ? Math.round((gastado / p.monto_limite) * 100) : 0
                  const excedido = gastado > p.monto_limite
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: excedido ? 'var(--coral)' : 'var(--lime)' }} />
                      <span className="w-24 flex-shrink-0 truncate text-[11.5px]">{nombreCategoria(cat?.nombre, idioma) || t('resumen_categoria_generica')}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: excedido ? 'var(--coral)' : 'var(--lime)' }} />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right font-mono text-[10.5px]" style={{ color: excedido ? 'var(--coral)' : 'var(--text-2)' }}>{pct}%</span>
                    </div>
                  )
                })
              )}
            </Block>
          </div>
        </div>

        <div className="mb-5.5 mt-6" style={{ borderTop: '1px solid var(--line)' }} />

        {/* Salud financiera: puntaje de 0 a 100, disponible para todos */}
        <SaludFinancieraCard />

        {/* Flujo de caja día a día — disponible para todos (90 días es Pro) */}
        <button
          onClick={() => navigate('/resumen/flujo')}
          className="mb-5 flex w-full items-center gap-3 rounded-xl p-3.5 text-left"
          style={{ background: 'var(--card)' }}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0 flex-1 text-[12.5px] font-semibold">{t('flujo_resumen_link')}</div>
          <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
        </button>

        <div className="mb-2.5 flex items-center gap-2" data-tour="control-total">
          <div className="text-sm font-semibold">{t('resumen_control_total')}</div>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
            PRO
          </span>
        </div>

        {!esPro ? (
          <button onClick={() => setShowPaywall(true)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
              <Lock size={18} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold">{t('resumen_paywall_titulo')}</div>
              <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('resumen_paywall_desc')}</div>
            </div>
          </button>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>

            {/* ---- Proyección de fin de mes ---- */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>
                <TrendingUp size={13} /> {t('resumen_proyeccion_titulo')}
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--card)' }}>
                <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                  {t('resumen_llevas_gastado', { gastado: fmt(proyeccion.gastadoHastaHoy), dia: proyeccion.diasTranscurridos, total: proyeccion.diasDelMes })}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t('resumen_a_este_ritmo')}</span>
                </div>
                <div className="mt-0.5 font-mono text-[17px] font-bold" style={{ color: proyeccion.proyeccionFinDeMes > proyeccionIngresosMes && proyeccionIngresosMes > 0 ? 'var(--coral)' : 'var(--lime)' }}>
                  {fmt(proyeccion.proyeccionFinDeMes)}
                </div>
                {proyeccionIngresosMes > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: proyeccion.proyeccionFinDeMes > proyeccionIngresosMes ? 'var(--coral-dim)' : 'var(--lime-dim)' }}>
                    <span className="text-[10px]" style={{ color: proyeccion.proyeccionFinDeMes > proyeccionIngresosMes ? 'var(--coral)' : 'var(--lime)' }}>
                      {proyeccion.proyeccionFinDeMes > proyeccionIngresosMes ? t('resumen_terminarias_negativo') : t('resumen_terminarias_positivo')}
                    </span>
                    <span className="font-mono text-[12.5px] font-bold" style={{ color: proyeccion.proyeccionFinDeMes > proyeccionIngresosMes ? 'var(--coral)' : 'var(--lime)' }}>
                      {proyeccion.proyeccionFinDeMes > proyeccionIngresosMes ? '-' : '+'}{fmt(Math.abs(proyeccionIngresosMes - proyeccion.proyeccionFinDeMes))}
                    </span>
                  </div>
                )}
                {proyeccionIngresosMes > 0 && proyeccion.proyeccionFinDeMes > proyeccionIngresosMes && (
                  <div className="mt-1.5 text-[9.5px]" style={{ color: 'var(--coral)' }}>{t('resumen_mas_de_lo_que_entra', { monto: fmt(proyeccionIngresosMes) })}</div>
                )}
              </div>
            </div>

            {/* ---- Comparación con el mes anterior ---- */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>
                <ArrowLeftRight size={13} /> {t('resumen_vs_mes_anterior')}
              </div>
              {comparacion.length === 0 ? (
                <div className="rounded-xl p-3 text-[11px]" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>{t('resumen_sin_historial')}</div>
              ) : (
                <div className="rounded-xl p-3" style={{ background: 'var(--card)' }}>
                  {comparacion.map((c) => {
                    const cat = categorias.find((cc) => cc.id === c.categoriaId)
                    const subio = c.diferencia > 0
                    return (
                      <div key={c.categoriaId ?? 'sin-cat'} className="flex items-center justify-between py-1.5 text-[11px]">
                        <span className="truncate" style={{ color: 'var(--text-2)' }}>{nombreCategoria(cat?.nombre, idioma) || t('resumen_sin_categoria')}</span>
                        <span className="flex-shrink-0 font-mono" style={{ color: subio ? 'var(--coral)' : 'var(--lime)' }}>
                          {subio ? '↑' : '↓'} {fmt(Math.abs(c.diferencia))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ---- Gastos hormiga ---- */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>
                <Bug size={13} /> {t('resumen_gastos_hormiga')}
              </div>
              {gastosHormiga.items.length === 0 ? (
                <div className="rounded-xl p-3 text-[11px]" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>{t('resumen_hormiga_vas_bien')}</div>
              ) : (
                <>
                  <div className="mb-2 rounded-xl p-3" style={{ background: 'var(--coral-dim)', border: '1px solid var(--coral)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--coral)' }}>{t('resumen_hormiga_vas', { monto: fmt(gastosHormiga.total) })}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{gastosHormiga.consejo}</div>
                  </div>
                  {gastosHormiga.items.slice(0, 5).map((g) => {
                    const cat = categorias.find((c) => c.id === g.categoriaId)
                    const Icon = ICONS[cat?.icono ?? 'otros'] ?? Bug
                    return (
                      <div key={g.nombre} className="mb-2 flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--card)' }}>
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium">{g.nombre}</div>
                          <div className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{nombreCategoria(cat?.nombre, idioma) || t('resumen_sin_categoria')} · {t('resumen_compras', { cantidad: g.cantidad, promedio: fmt(g.promedio) })}</div>
                        </div>
                        <div className="ml-auto font-mono text-[12.5px]" style={{ color: 'var(--coral)' }}>{fmt(g.total)}</div>
                      </div>
                    )
                  })}
                  {gastosHormiga.items.length > 5 && (
                    <div className="text-center text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {t('resumen_hormiga_y_mas', { n: gastosHormiga.items.length - 5 })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ---- Simulador "¿Qué pasaría si...?" ---- */}
            <button
              onClick={() => navigate('/resumen/simulador')}
              className="flex items-center gap-3 rounded-xl p-3.5 text-left"
              style={{ background: 'var(--card)' }}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
                <Wand2 size={15} />
              </div>
              <div className="min-w-0 flex-1 text-[12.5px] font-semibold">{t('resumen_simula_futuro')}</div>
              <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
            </button>
          </div>
        )}

        <div className="pb-1" />
      </div>

      {/* Espaciador explícito — mismo criterio que Cuentas/Deudas/Balance,
          para que la tab bar fija de celular no tape el final del scroll. */}
      <div className="h-28 md:h-6" />

      {showPaywall && (
        <ProPaywallSheet
          reason={t('resumen_paywall_hormiga')}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  )
}

function Block({ title, linkLabel, onLink, children }: { title: string; linkLabel: string; onLink: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--card)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12.5px] font-semibold">{title}</div>
        <button onClick={onLink} className="text-[11px]" style={{ color: 'var(--text-2)' }}>{linkLabel}</button>
      </div>
      {children}
    </div>
  )
}

function Line({ color, label, value, valueColor }: { color: string; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono" style={{ color: valueColor }}>{value}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-1 text-[11px]" style={{ color: 'var(--text-3)' }}>{children}</div>
}

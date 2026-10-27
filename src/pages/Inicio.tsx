import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useNavigate } from 'react-router-dom'
import WaveChart from '../components/WaveChart'
import Avatar from '../components/Avatar'
import { getNombre } from '../lib/profile'
import { parseLocalDate } from '../lib/date'
import { ICONS } from './Cuentas'
import { MoreHorizontal, Mail, Check } from 'lucide-react'
import ProBanner from '../components/ProBanner'
import FlujoCajaCard from '../components/FlujoCajaCard'
import { emailConfirmado, diasRestantesConfirmacion } from '../lib/emailConfirm'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import { useTasasCambio } from '../hooks/useTasasCambio'
import SwipeBorrar from '../components/SwipeBorrar'
import { supabase } from '../lib/supabase'
import { appAlert } from '../lib/dialogs'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 100, h = 28
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={28} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Inicio() {
  const { user, resendConfirmation } = useAuth()
  const { cuentas, categorias, transacciones, metas, deudas, presupuestos, loading, error, totalCash, esPro, reload } = useFinanzas()
  const navigate = useNavigate()
  const [resendSent, setResendSent] = useState(false)
  const [resending, setResending] = useState(false)
  const { t, idioma } = useIdioma()
  const { tasas, tasaDe, historialDe } = useTasasCambio()

  // Borrado rápido desde "Movimientos recientes" (deslizar de derecha a
  // izquierda). Igual que en Movimientos.tsx; el saldo de la cuenta lo
  // ajusta el trigger sync_saldo_cuenta en la base.
  async function borrarMovimiento(id: string) {
    const { error: errBorrar } = await supabase.from('transacciones').delete().eq('id', id)
    if (errBorrar) { await appAlert(t('mv_error_borrar', { msg: errBorrar.message })); return }
    await reload()
  }
  // Fecha del registro más reciente (cualquiera de las monedas sirve,
  // se actualizan juntas el mismo día) — para el "Actualizado {fecha}"
  // junto al título de la sección.
  const ultimaActualizacionTasas = tasas.length > 0
    ? new Date(tasas.reduce((latest, t2) => (t2.actualizado_en > latest ? t2.actualizado_en : latest), tasas[0].actualizado_en))
    : null

  const nombre = getNombre(user)

  // "Recientes" antes sumaba TODO lo que la app había traído de una vez
  // (3 meses para Free, últimas 50 para Pro) — por eso casi coincidía con
  // el número de la gráfica de arriba pero no exacto, y se sentía como un
  // dato repetido sin explicación. Ahora sí es literalmente "este mes",
  // igual criterio que ya usan Balance y Movimientos.
  const ahora = new Date()
  const delMesActual = transacciones.filter((t) => {
    const d = parseLocalDate(t.fecha)
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
  })
  const ingresosMes = delMesActual.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egresosMes = delMesActual.filter((t) => t.tipo === 'egreso').reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  function catInfo(id: string | null) {
    return nombreCategoria(categorias.find((c) => c.id === id)?.nombre, idioma) || t('inicio_otros')
  }
  function accInfo(id: string) {
    return cuentas.find((c) => c.id === id)
  }

  const now = new Date()
  const gastadoPorCategoria = (categoriaId: string) =>
    transacciones
      .filter((t) => t.tipo === 'egreso' && t.categoria_id === categoriaId)
      .filter((t) => { const d = parseLocalDate(t.fecha); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
      .reduce((s, t) => s + t.monto + t.monto_4x1000, 0)

  const movimientosList = (
    <>
      {loading && <div className="py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>{t('inicio_cargando')}</div>}

      {!loading && transacciones.length === 0 && (
        <div className="py-8 text-center text-xs" style={{ color: 'var(--text-3)' }}>
          {t('inicio_sin_movimientos')}
        </div>
      )}

      {transacciones.slice(0, 8).map((mov) => {
        const esTransferencia = mov.tipo === 'transferencia'
        const acc = accInfo(mov.cuenta_id)
        const accDestino = mov.cuenta_destino_id ? accInfo(mov.cuenta_destino_id) : null
        return (
          <SwipeBorrar key={mov.id} etiqueta={t('cn_borrar')} onBorrar={() => borrarMovimiento(mov.id)} onTap={() => navigate(`/movimiento/${mov.id}/editar`)}>
          <div className="flex w-full cursor-pointer items-center justify-between py-2.5 text-left" style={{ borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="text-[13px] font-medium">
                {esTransferencia ? `${acc?.nombre ?? '?'} → ${accDestino?.nombre ?? '?'}` : (mov.descripcion || catInfo(mov.categoria_id))}
              </div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                {esTransferencia ? t('inicio_transferencia') : `${catInfo(mov.categoria_id)}${acc ? ` · ${acc.nombre}` : ''}`} · {mov.fecha}
              </div>
            </div>
            <div className="font-mono text-[13px]" style={{ color: esTransferencia ? 'var(--lavender)' : mov.tipo === 'ingreso' ? 'var(--lime)' : 'var(--text-1)' }}>
              {esTransferencia ? '' : mov.tipo === 'ingreso' ? '+' : '–'}{fmt(mov.monto + mov.monto_4x1000)}
            </div>
          </div>
          </SwipeBorrar>
        )
      })}
    </>
  )

  return (
    <div className="px-5 pt-3 md:px-8 md:pt-6">
      <div className="mb-1 flex items-center justify-between pt-2 md:justify-center">
        <div style={{ width: 34 }} className="md:hidden" />
        <div className="text-[15px] font-semibold font-display">{t('inicio_titulo')}</div>
        <div className="md:hidden">
          <Avatar user={user} size={34} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      {user && !emailConfirmado(user) && (() => {
        const dias = diasRestantesConfirmacion(user)
        return (
          <button
            onClick={async () => {
              if (resending || !user.email) return
              setResending(true)
              const { error } = await resendConfirmation(user.email)
              setResending(false)
              if (!error) setResendSent(true)
            }}
            disabled={resending}
            className="mb-3 flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left disabled:opacity-70"
            style={{ background: dias <= 1 ? 'var(--coral-dim)' : 'var(--yellow-dim)' }}
          >
            {resendSent ? (
              <Check size={15} style={{ color: dias <= 1 ? 'var(--coral)' : 'var(--yellow)', flexShrink: 0 }} />
            ) : (
              <Mail size={15} style={{ color: dias <= 1 ? 'var(--coral)' : 'var(--yellow)', flexShrink: 0 }} />
            )}
            <span className="text-[11px] leading-relaxed" style={{ color: dias <= 1 ? 'var(--coral)' : 'var(--yellow)' }}>
              {resendSent
                ? t('inicio_correo_reenviado')
                : t('inicio_confirmar_correo', { dias, n: dias })}
            </span>
          </button>
        )
      })()}

      {error && (
        <div className="mt-4 rounded-2xl p-3 text-xs" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
          {t('inicio_error_cargando', { error })}
        </div>
      )}

      {/* ---- Layout: una sola columna en celular, dos columnas en tablet ---- */}
      <div className="lg:mt-3 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div>
          <div className="mt-4 text-xs lg:mt-0" style={{ color: 'var(--text-2)' }}>{t('inicio_hola', { nombre })}</div>
          <div data-tour="balance-total">
            <div className="mb-1 text-xs" style={{ color: 'var(--text-2)' }}>{t('inicio_balance_total')}</div>
            <div className="text-3xl font-bold font-display font-mono">{fmt(totalCash)}</div>
          </div>

          <div className="mt-4">
            <WaveChart transacciones={transacciones} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {/* Ingresos: el mismo lima de marca de siempre (--lime, igual al
            "$741.197" de arriba) como fondo — Felo pidió que fuera el verde
            real de la app, no uno inventado. Sobre un lima tan brillante el
            blanco casi no contrasta (~1.2:1) mientras que el negro sí
            (~10:1+), así que texto en negro puro — igual que en la tarjeta
            de egresos, para que las dos se lean como un mismo patrón. Felo
            pidió que el círculo siguiera esa misma elección (negro/blanco),
            así que el círculo también pasa a negro, con la flecha en el
            lima brillante (ya no --lime-pos: sobre negro el lima puro se ve
            perfecto y no hace falta oscurecerlo). */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--lime)' }}>
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: '#000000', color: 'var(--lime)' }}>↓</div>
              <div className="truncate text-lg font-bold font-display font-mono" style={{ color: '#000000' }}>{fmt(ingresosMes)}</div>
              <div className="text-[10.5px]" style={{ color: '#000000', opacity: 0.75 }}>{t('inicio_ingresos_recientes')}</div>
            </div>
            {/* Egresos: mismo patrón pero en rojo/negro — --coral ya es lo
            bastante claro para que el negro se lea encima (a diferencia del
            verde, acá si usamos el rojo de marca de siempre). */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--coral)' }}>
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: '#000000', color: 'var(--coral)' }}>↑</div>
              <div className="truncate text-lg font-bold font-display font-mono" style={{ color: '#000000' }}>{fmt(egresosMes)}</div>
              <div className="text-[10.5px]" style={{ color: '#000000', opacity: 0.7 }}>{t('inicio_egresos_recientes')}</div>
            </div>
          </div>

          {/* Flujo de caja: cuánta plata tendrás en los próximos 30 días y
          si se ve un hueco. Un toque abre la pantalla completa. */}
          <FlujoCajaCard />

          <div className="mb-2.5 mt-6 flex items-center justify-between">
            <div className="text-sm font-semibold">{t('inicio_movimientos_recientes')}</div>
            <button onClick={() => navigate('/movimientos')} className="text-[11.5px]" style={{ color: 'var(--lime)' }}>{t('inicio_ver_todos')}</button>
          </div>

          {movimientosList}

          {tasas.length > 0 && (
            <>
              <div className="mb-2.5 mt-6 flex items-center justify-between">
                <div className="text-sm font-semibold">{t('inicio_tasas_titulo')}</div>
                {ultimaActualizacionTasas && (
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {t('inicio_tasa_actualizada', { fecha: ultimaActualizacionTasas.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' }) })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>$</div>
                  <div className="truncate text-[15px] font-bold font-display font-mono">{fmt(tasaDe('USD'))}</div>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-2)' }}>{t('inicio_usd_hoy')}</div>
                  <div className="mt-1.5">
                    <MiniSparkline data={historialDe('USD').map((h) => h.tasa_cop)} color="var(--lime)" />
                  </div>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: 'var(--lavender-dim)', color: 'var(--lavender)' }}>€</div>
                  <div className="truncate text-[15px] font-bold font-display font-mono">{fmt(tasaDe('EUR'))}</div>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-2)' }}>{t('inicio_eur_hoy')}</div>
                  <div className="mt-1.5">
                    <MiniSparkline data={historialDe('EUR').map((h) => h.tasa_cop)} color="var(--lavender)" />
                  </div>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>$</div>
                  <div className="truncate text-[15px] font-bold font-display font-mono">{fmt(tasaDe('MXN'))}</div>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-2)' }}>{t('inicio_mxn_hoy')}</div>
                  <div className="mt-1.5">
                    <MiniSparkline data={historialDe('MXN').map((h) => h.tasa_cop)} color="var(--yellow)" />
                  </div>
                </div>
              </div>
            </>
          )}

          {!esPro && <ProBanner />}
        </div>

        {/* ---- Columna derecha: solo aparece en tablet/desktop (md y arriba) ---- */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12.5px] font-semibold">{t('inicio_metas_ahorro')}</div>
              <button onClick={() => navigate('/balance')} className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('inicio_ver_todas')}</button>
            </div>
            {metas.length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('inicio_sin_metas')}</div>}
            {metas.slice(0, 4).map((g) => {
              const pct = g.monto_objetivo > 0 ? Math.round((g.monto_actual / g.monto_objetivo) * 100) : 0
              const color = g.color === 'coral' ? 'var(--coral)' : g.color === 'yellow' ? 'var(--yellow)' : g.color === 'lavender' ? 'var(--lavender)' : 'var(--lime)'
              return (
                <div key={g.id} className="flex items-center gap-2.5 py-1.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
                  <span className="w-20 flex-shrink-0 truncate text-[11px]">{g.nombre}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                  </div>
                  <span className="w-8 flex-shrink-0 text-right font-mono text-[10px]" style={{ color: 'var(--text-2)' }}>{pct}%</span>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--card)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12.5px] font-semibold">{t('inicio_deudas_creditos')}</div>
              <button onClick={() => navigate('/deudas')} className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('inicio_ver_todas')}</button>
            </div>
            {deudas.length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('inicio_sin_deudas')}</div>}
            {deudas.slice(0, 4).map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 text-[11.5px]">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.tipo === 'deuda' ? 'var(--coral)' : 'var(--yellow)' }} />
                  <span className="truncate">{d.nombre}</span>
                </span>
                <span className="flex-shrink-0 font-mono" style={{ color: d.tipo === 'deuda' ? 'var(--coral)' : 'var(--yellow)' }}>
                  {fmt(d.capital - d.capital_pagado)}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--card)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12.5px] font-semibold">{t('inicio_presupuestos')}</div>
              <button onClick={() => navigate('/presupuestos')} className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('inicio_ver')}</button>
            </div>
            {presupuestos.length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('inicio_sin_presupuestos')}</div>}
            {presupuestos.slice(0, 3).map((p) => {
              const cat = categorias.find((c) => c.id === p.categoria_id)
              const Icon = cat ? (ICONS[cat.icono] ?? MoreHorizontal) : MoreHorizontal
              const gastado = gastadoPorCategoria(p.categoria_id)
              const pct = Math.round((gastado / p.monto_limite) * 100)
              const excedido = gastado > p.monto_limite
              return (
                <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                  <Icon size={13} style={{ color: excedido ? 'var(--coral)' : 'var(--text-2)', flexShrink: 0 }} />
                  <span className="w-16 flex-shrink-0 truncate text-[11px]">{nombreCategoria(cat?.nombre, idioma) || t('inicio_otros')}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: excedido ? 'var(--coral)' : pct >= 80 ? 'var(--yellow)' : 'var(--lime)' }} />
                  </div>
                  <span className="w-8 flex-shrink-0 text-right font-mono text-[10px]" style={{ color: excedido ? 'var(--coral)' : 'var(--text-2)' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Espaciador explícito — mismo criterio que Cuentas/Deudas/Balance/
          Resumen, para que la tab bar fija de celular no tape el final
          del scroll. */}
      <div className="h-28 md:h-6" />
    </div>
  )
}

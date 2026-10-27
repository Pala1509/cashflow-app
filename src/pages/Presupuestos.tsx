import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, AlertTriangle, Pencil } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { parseLocalDate } from '../lib/date'
import { sortCategorias } from '../lib/categorias'
import ProPaywallSheet from '../components/ProPaywallSheet'
import { ICONS, COLORS } from './Cuentas'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

export default function Presupuestos() {
  const navigate = useNavigate()
  const { categorias, transacciones, presupuestos, esPro, loading } = useFinanzas()
  const { t, idioma } = useIdioma()

  const now = new Date()
  const gastadoPorCategoria = (categoriaId: string) => {
    return transacciones
      .filter((t) => t.tipo === 'egreso' && t.categoria_id === categoriaId)
      .filter((t) => {
        const d = parseLocalDate(t.fecha)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((s, t) => s + t.monto + t.monto_4x1000, 0)
  }

  const categoriasEgreso = sortCategorias(categorias.filter((c) => c.tipo === 'egreso'))
  const conPresupuesto = categoriasEgreso.filter((c) => presupuestos.some((p) => p.categoria_id === c.id))
  const sinPresupuesto = categoriasEgreso.filter((c) => !presupuestos.some((p) => p.categoria_id === c.id))

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('ps_titulo')}</div>
        <button onClick={() => navigate('/balance')} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 lg:mx-auto lg:w-full lg:max-w-[900px]">
        <div className="mb-4 mt-1 text-[11.5px]" style={{ color: 'var(--text-2)' }}>{t('ps_subtitulo', { mes: now.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { month: 'long' }) })}</div>

        {loading && <div className="py-8 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('ps_cargando')}</div>}

        {conPresupuesto.length > 0 && (
          <>
            <div className="mb-2 mt-2 text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{t('ps_con_limite')}</div>
            <div className="lg:grid lg:grid-cols-3 lg:gap-2.5">
            {conPresupuesto.map((c) => {
              const p = presupuestos.find((p) => p.categoria_id === c.id)!
              const gastado = gastadoPorCategoria(c.id)
              const pct = Math.round((gastado / p.monto_limite) * 100)
              const excedido = gastado > p.monto_limite
              const Icon = ICONS[c.icono] ?? ICONS.otros
              const barColor = excedido ? 'var(--coral)' : pct >= 80 ? 'var(--yellow)' : 'var(--lime)'
              return (
                <button key={c.id} onClick={() => navigate(`/presupuestos/nuevo?categoria=${c.id}`)} className="mb-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left lg:mb-0 lg:flex-col lg:items-stretch lg:gap-0" style={{ background: 'var(--card)', border: excedido ? '1px solid var(--coral)' : '1px solid var(--line)' }}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full lg:mb-2.5" style={{ background: (COLORS[c.color] ?? COLORS.lavender).fg }}>
                    <Icon size={17} style={{ color: 'var(--bg)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {nombreCategoria(c.nombre, idioma)}
                        {excedido && <AlertTriangle size={12} style={{ color: 'var(--coral)' }} />}
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{fmt(gastado)} / {fmt(p.monto_limite)}</div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    </div>
                    <div className="mt-1.5 text-[10.5px]" style={{ color: excedido ? 'var(--coral)' : 'var(--text-2)' }}>
                      {excedido ? t('ps_superado_por', { monto: fmt(gastado - p.monto_limite) }) : t('ps_pct_usado', { pct })}
                    </div>
                  </div>
                  <Pencil size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} className="lg:hidden" />
                </button>
              )
            })}
            </div>
          </>
        )}

        {sinPresupuesto.length > 0 && (
          <>
            <div className="mb-2 mt-5 text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{t('ps_sin_limite')}</div>
            <div className="grid grid-cols-3 gap-2.5">
              {sinPresupuesto.map((c) => {
                const Icon = ICONS[c.icono] ?? ICONS.otros
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/presupuestos/nuevo?categoria=${c.id}`)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-center"
                    style={{ background: 'var(--card)', border: '1px dashed var(--line)' }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
                      <Icon size={17} />
                    </div>
                    <div className="text-[10.5px] leading-tight" style={{ color: 'var(--text-2)' }}>{nombreCategoria(c.nombre, idioma)}</div>
                    <div className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{t('ps_mas_limite')}</div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {!loading && !esPro && (
        <ProPaywallSheet
          reason={t('ps_paywall')}
          onClose={() => navigate('/balance')}
        />
      )}
    </div>
  )
}

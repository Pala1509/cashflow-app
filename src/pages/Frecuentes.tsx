import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Star, Trash2, AlertTriangle } from 'lucide-react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useFinanzas } from '../hooks/useFinanzas'
import { useMovimientosFrecuentes } from '../hooks/useMovimientosFrecuentes'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'
import type { MovimientoFrecuente } from '../lib/database.types'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Pantalla de gestión de "movimientos frecuentes" (los chips de un toque
// que aparecen al crear un movimiento — ver MovimientoNuevo.tsx). La
// función eliminar() ya existía en el hook desde que se creó esta
// funcionalidad, simplemente no estaba conectada a ningún botón todavía
// — este es ese botón.
export default function Frecuentes() {
  const navigate = useNavigate()
  const { t, idioma } = useIdioma()
  const { cuentas, categorias, gastosFijos, ingresosFijos } = useFinanzas()
  const { frecuentes, loading, eliminar } = useMovimientosFrecuentes()

  // Mismo chequeo que usarFrecuenteRapido() en MovimientoNuevo.tsx —
  // si esto da false, ese frecuente no se puede autoguardar con un
  // toque y cae al flujo manual. Se muestra acá para que quede claro
  // por qué, en vez de que parezca que el toque rápido "no funciona".
  function estaCompleto(f: MovimientoFrecuente): boolean {
    const cuenta = f.cuenta_id ? cuentas.some((c) => c.id === f.cuenta_id) : false
    if (!cuenta) return false
    if (f.gasto_fijo_id) return gastosFijos.some((g) => g.id === f.gasto_fijo_id && g.activo)
    if (f.ingreso_fijo_id) return ingresosFijos.some((i) => i.id === f.ingreso_fijo_id && i.activo)
    return f.categoria_id ? categorias.some((c) => c.id === f.categoria_id) : false
  }

  function subtitulo(f: MovimientoFrecuente): string {
    const partes: string[] = []
    if (f.gasto_fijo_id) {
      const g = gastosFijos.find((x) => x.id === f.gasto_fijo_id)
      partes.push(g ? g.nombre : t('frecuentes_vinculo_borrado'))
    } else if (f.ingreso_fijo_id) {
      const i = ingresosFijos.find((x) => x.id === f.ingreso_fijo_id)
      partes.push(i ? i.nombre : t('frecuentes_vinculo_borrado'))
    } else if (f.categoria_id) {
      const cat = categorias.find((c) => c.id === f.categoria_id)
      partes.push(cat ? nombreCategoria(cat.nombre, idioma) : t('frecuentes_vinculo_borrado'))
    }
    const cuenta = f.cuenta_id ? cuentas.find((c) => c.id === f.cuenta_id) : null
    partes.push(cuenta ? cuenta.nombre : t('frecuentes_vinculo_borrado'))
    return partes.join(' · ')
  }

  async function confirmarBorrar(f: MovimientoFrecuente) {
    if (!(await appConfirm(t('frecuentes_confirmar_borrar', { nombre: f.nombre }), { danger: true }))) return
    try {
      await eliminar(f.id)
    } catch (e) {
      await appAlert(t('frecuentes_error_borrar', { msg: e instanceof Error ? e.message : String(e) }))
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('frecuentes_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:flex md:justify-center">
        <div className="md:w-[420px]">
          <div className="mb-5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
            {t('frecuentes_nota')}
          </div>

          {loading && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('frecuentes_cargando')}</div>}
          {!loading && frecuentes.length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('frecuentes_ninguno')}</div>}

          {frecuentes.map((f) => {
            const completo = estaCompleto(f)
            return (
              <div key={f.id} className="mb-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: f.tipo === 'egreso' ? 'var(--coral-dim)' : 'var(--lime-dim)', color: f.tipo === 'egreso' ? 'var(--coral)' : 'var(--lime)' }}
                >
                  <Star size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{f.nombre}</div>
                  <div className="truncate text-[11px]" style={{ color: 'var(--text-3)' }}>{subtitulo(f)}</div>
                  {!completo && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: 'var(--coral)' }}>
                      <AlertTriangle size={10} /> {t('frecuentes_incompleto')}
                    </div>
                  )}
                </div>
                <div
                  className="flex-shrink-0 text-right font-mono text-[13px] font-semibold"
                  style={{ color: f.tipo === 'egreso' ? 'var(--coral)' : 'var(--lime)' }}
                >
                  {fmt(f.monto)}
                </div>
                <button
                  onClick={() => confirmarBorrar(f)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

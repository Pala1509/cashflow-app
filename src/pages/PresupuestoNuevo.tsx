import { useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, DollarSign, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { ICONS } from './Cuentas'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'

export default function PresupuestoNuevo() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const categoriaId = params.get('categoria')
  const { categorias, presupuestos, reload } = useFinanzas()
  const { t, idioma } = useIdioma()

  const categoria = categorias.find((c) => c.id === categoriaId)
  const existente = presupuestos.find((p) => p.categoria_id === categoriaId)
  const [monto, setMonto] = useState(existente ? String(existente.monto_limite) : '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!categoria) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-3)' }}>{t('pn_categoria_no_encontrada')}</div>
      </div>
    )
  }

  const Icon = ICONS[categoria.icono] ?? ICONS.otros
  const now = new Date()

  async function save() {
    if (!user || !categoriaId) return
    const montoNum = Number(monto || 0)
    if (montoNum <= 0) return
    setSaving(true)
    const { error } = await supabase.from('presupuestos').upsert(
      { user_id: user.id, categoria_id: categoriaId, monto_limite: montoNum, mes: now.getMonth() + 1, anio: now.getFullYear() },
      { onConflict: 'user_id,categoria_id,mes,anio' }
    )
    setSaving(false)
    if (error) { await appAlert(t('pn_error_guardar', { msg: error.message })); return }
    await reload()
    navigate(-1)
  }

  async function remove() {
    if (!existente) return
    if (!(await appConfirm(t('pn_confirmar_quitar')))) return
    setDeleting(true)
    const { error } = await supabase.from('presupuestos').delete().eq('id', existente.id)
    setDeleting(false)
    if (error) { await appAlert(t('pn_error_quitar', { msg: error.message })); return }
    await reload()
    navigate(-1)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{nombreCategoria(categoria.nombre, idioma)}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-5 mt-2 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
            <Icon size={22} />
          </div>
        </div>

        <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{t('pn_limite_mensual')}</div>
        <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--text-3)' }}><DollarSign size={16} /></span>
          <input
            inputMode="numeric"
            value={monto ? Number(monto).toLocaleString('es-CO') : ''}
            onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="w-full bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text-1)' }}
          />
        </div>
        <div className="mt-2 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
          {t('pn_nota')}
        </div>

        <button
          onClick={save}
          disabled={saving || Number(monto || 0) <= 0}
          className="mt-5 w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          {saving ? t('pn_guardando') : existente ? t('pn_actualizar') : t('pn_guardar')}
        </button>

        {existente && (
          <button
            onClick={remove}
            disabled={deleting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
          >
            <Trash2 size={15} /> {deleting ? t('pn_quitando') : t('pn_quitar')}
          </button>
        )}
      </div>
    </div>
  )
}

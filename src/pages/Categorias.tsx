import { useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Plus, X as XSmall, Lock, Check, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import ProPaywallSheet from '../components/ProPaywallSheet'
import CenterModal from '../components/CenterModal'
import { ICONS, COLORS, GRUPOS } from './Cuentas'
import type { Categoria } from '../lib/database.types'
import { useIdioma } from '../lib/IdiomaContext'
import { nombreCategoria } from '../lib/categoriaI18n'

// Íconos disponibles para elegir al crear una categoría (se excluyen los
// que son específicos de cuentas/tarjetas, esos no aplican aquí).
const ICONOS_CATEGORIA = Object.keys(ICONS).filter(
  (k) => !['cash', 'device-mobile', 'building-bank', 'credit-card', 'scale', 'arrow-back-up', 'dots', 'otros'].includes(k)
)

export default function Categorias() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categorias, loading, reload, esPro } = useFinanzas()
  const { t, idioma } = useIdioma()
  const [showPaywall, setShowPaywall] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)

  const [tab, setTab] = useState<'ingreso' | 'egreso'>('egreso')

  const deEsteTipo = categorias.filter((c) => c.tipo === tab)
  const sinGrupo = deEsteTipo.filter((c) => !c.grupo)

  const grupos = GRUPOS
    .map((g) => ({ ...g, items: deEsteTipo.filter((c) => c.grupo === g.id) }))
    .filter((g) => g.items.length > 0)

  async function remove(id: string) {
    if (!(await appConfirm(t('ct_confirmar_eliminar'), { danger: true }))) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) { await appAlert(t('ct_error_eliminar', { msg: error.message })); return }
    await reload()
  }

  function Grid({ items, onEdit }: { items: Categoria[]; onEdit: (c: Categoria) => void }) {
    return (
      <div className="grid grid-cols-4 gap-2.5">
        {items.map((c) => {
          const Icon = ICONS[c.icono] ?? ICONS.otros
          const col = COLORS[c.color] ?? COLORS.lavender
          return (
            <div key={c.id} className="relative flex flex-col items-center gap-1.5 text-center">
              {!c.predeterminada && (
                <button
                  onClick={() => remove(c.id)}
                  className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full"
                  style={{ width: 18, height: 18, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-3)' }}
                >
                  <XSmall size={10} />
                </button>
              )}
              <button onClick={() => onEdit(c)} className="relative flex flex-col items-center gap-1.5 text-center">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full" style={{ background: col.fg }}>
                  <Icon size={20} style={{ color: 'var(--bg)' }} />
                  {/* Lapicito siempre visible, siempre en el mismo lugar
                  (abajo-derecha) para TODAS las categorías — antes
                  cambiaba de posición según si era personalizada (con X
                  de borrar arriba-derecha) o predeterminada, y se veía
                  inconsistente entre categorías en la misma pantalla. */}
                  <span
                    className="absolute flex items-center justify-center rounded-full"
                    style={{ width: 16, height: 16, right: -4, bottom: -4, background: 'var(--lime)', color: 'var(--lime-text)', border: '1.5px solid var(--bg)' }}
                  >
                    <Pencil size={8} />
                  </span>
                </div>
                <div className="text-[9.5px] leading-tight" style={{ color: 'var(--text-2)' }}>{nombreCategoria(c.nombre, idioma)}</div>
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('ct_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-shrink-0 gap-2 px-5 pb-3 pt-2">
        <button onClick={() => setTab('egreso')} className="flex-1 rounded-2xl py-2.5 text-[12.5px] font-semibold" style={tab === 'egreso' ? { background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid var(--coral)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}>
          {t('mv_egresos')}
        </button>
        <button onClick={() => setTab('ingreso')} className="flex-1 rounded-2xl py-2.5 text-[12.5px] font-semibold" style={tab === 'ingreso' ? { background: 'var(--lime-dim)', color: 'var(--lime)', border: '1px solid var(--lime)' } : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--line)' }}>
          {t('mv_ingresos')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <button
          onClick={() => (esPro ? setShowNueva(true) : setShowPaywall(true))}
          className="mb-5 flex w-full items-center gap-2.5 rounded-2xl px-4 py-3.5"
          style={{ background: esPro ? 'var(--lime-dim)' : 'var(--card)', border: `1px dashed ${esPro ? 'var(--lime)' : 'var(--line)'}` }}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: esPro ? 'var(--lime)' : 'var(--card-2)', color: esPro ? 'var(--lime-text)' : 'var(--text-3)' }}>
            {esPro ? <Plus size={16} /> : <Lock size={14} />}
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: esPro ? 'var(--lime)' : 'var(--text-3)' }}>
            {esPro ? (tab === 'egreso' ? t('ct_nueva_de_egreso') : t('ct_nueva_de_ingreso')) : t('ct_personalizadas_pro')}
          </span>
        </button>

        {loading && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('ct_cargando')}</div>}
        {!loading && deEsteTipo.length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('ct_sin_categorias', { tab: t(tab === 'egreso' ? 'ct_tab_egreso' : 'ct_tab_ingreso') })}</div>}

        {grupos.map((g) => (
          <div key={g.id} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: (COLORS[g.color] ?? COLORS.lavender).fg }} />
              <div className="text-[12.5px] font-semibold">{g.nombre}</div>
            </div>
            <Grid items={g.items} onEdit={setEditando} />
          </div>
        ))}

        {sinGrupo.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--text-3)' }} />
              <div className="text-[12.5px] font-semibold">{t('ct_personalizadas')}</div>
            </div>
            <Grid items={sinGrupo} onEdit={setEditando} />
          </div>
        )}
      </div>

      {showPaywall && <ProPaywallSheet reason={t('ct_paywall')} onClose={() => setShowPaywall(false)} />}

      {showNueva && (
        <NuevaCategoriaModal
          tab={tab}
          userId={user?.id}
          onClose={() => setShowNueva(false)}
          onCreated={async () => { setShowNueva(false); await reload() }}
        />
      )}

      {editando && (
        <EditarCategoriaModal
          categoria={editando}
          onClose={() => setEditando(null)}
          onSaved={async () => { setEditando(null); await reload() }}
        />
      )}
    </div>
  )
}

export function NuevaCategoriaModal({ tab, userId, onClose, onCreated }: { tab: 'ingreso' | 'egreso'; userId: string | undefined; onClose: () => void; onCreated: () => void }) {
  const { t } = useIdioma()
  const gruposDisponibles = GRUPOS.filter((g) => (tab === 'ingreso' ? g.id === 'ingresos' : g.id !== 'ingresos'))
  const [nombre, setNombre] = useState('')
  const [grupoId, setGrupoId] = useState<string | null>(tab === 'ingreso' ? 'ingresos' : null)
  const [icono, setIcono] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grupoSel = GRUPOS.find((g) => g.id === grupoId)

  async function guardar() {
    if (!userId || !nombre.trim() || !grupoId || !icono) return
    setSaving(true)
    const { error } = await supabase.from('categorias').insert({
      user_id: userId, nombre: nombre.trim(), tipo: tab, icono, grupo: grupoId, color: grupoSel?.color ?? 'lavender',
    })
    setSaving(false)
    if (error) {
      // Código 23505 = unique_violation — ya existe una categoría con ese
      // nombre y tipo. Mensaje amigable en vez del error crudo de Postgres.
      if (error.code === '23505') { await appAlert(t('ct_error_nombre_duplicado', { tipo: t(tab === 'ingreso' ? 'mov_ingreso' : 'mov_egreso').toLowerCase() })); return }
      await appAlert(t('ct_error_crear', { msg: error.message }))
      return
    }
    onCreated()
  }

  return (
    <CenterModal onClose={onClose} maxWidth={380}>
      <div className="mb-4 text-center text-[15px] font-semibold font-display">{tab === 'egreso' ? t('ct_nueva_de_egreso') : t('ct_nueva_de_ingreso')}</div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_nombre')}</div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={t('ct_placeholder_nombre')}
        className="mb-4 w-full rounded-2xl px-3.5 py-3 text-[13px] outline-none"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
      />

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_division')}</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {gruposDisponibles.map((g) => {
          const col = COLORS[g.color] ?? COLORS.lavender
          const sel = grupoId === g.id
          return (
            <button
              key={g.id}
              onClick={() => setGrupoId(g.id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-medium"
              style={{ background: sel ? col.dim : 'var(--card)', border: `1px solid ${sel ? col.fg : 'var(--line)'}`, color: sel ? col.fg : 'var(--text-2)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: col.fg }} />
              {g.nombre}
            </button>
          )
        })}
      </div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_icono')}</div>
      <div className="mb-5 grid max-h-52 grid-cols-6 gap-2 overflow-y-auto pr-1">
        {ICONOS_CATEGORIA.map((key) => {
          const Icon = ICONS[key]
          const sel = icono === key
          const col = grupoSel ? (COLORS[grupoSel.color] ?? COLORS.lavender) : null
          return (
            <button
              key={key}
              onClick={() => setIcono(key)}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: sel && col ? col.fg : 'var(--card-2)', color: sel && col ? 'var(--bg)' : 'var(--text-2)', boxShadow: sel ? '0 0 0 2px var(--lime)' : 'none' }}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      <button
        onClick={guardar}
        disabled={saving || !nombre.trim() || !grupoId || !icono}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold disabled:opacity-40"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
      >
        {saving ? t('ct_guardando') : <><Check size={15} /> {t('ct_crear')}</>}
      </button>
    </CenterModal>
  )
}

// Editar una categoría ya existente — antes solo se podían crear
// personalizadas y borrarlas, no había forma de corregir un nombre o
// cambiar el ícono/grupo de ninguna categoría (ni siquiera las
// personalizadas). Se puede abrir desde aquí (tocando la categoría en
// vez de solo la X de borrar) o desde el selector de categoría al
// crear un movimiento (ver CatSheet en MovimientoNuevo.tsx). Renombrar
// no cuenta contra el límite de categorías personalizadas de Free —
// solo crear nuevas sí, por eso esto no lleva paywall.
export function EditarCategoriaModal({ categoria, onClose, onSaved }: { categoria: Categoria; onClose: () => void; onSaved: () => void }) {
  const { t } = useIdioma()
  const gruposDisponibles = GRUPOS.filter((g) => (categoria.tipo === 'ingreso' ? g.id === 'ingresos' : g.id !== 'ingresos'))
  const [nombre, setNombre] = useState(categoria.nombre)
  const [grupoId, setGrupoId] = useState<string | null>(categoria.grupo)
  const [icono, setIcono] = useState<string | null>(categoria.icono)
  const [saving, setSaving] = useState(false)

  const grupoSel = GRUPOS.find((g) => g.id === grupoId)

  async function guardar() {
    if (!nombre.trim() || !grupoId || !icono) return
    setSaving(true)
    const { error } = await supabase.from('categorias').update({
      nombre: nombre.trim(), icono, grupo: grupoId, color: grupoSel?.color ?? categoria.color,
    }).eq('id', categoria.id)
    setSaving(false)
    if (error) {
      if (error.code === '23505') { await appAlert(t('ct_error_nombre_duplicado', { tipo: t(categoria.tipo === 'ingreso' ? 'mov_ingreso' : 'mov_egreso').toLowerCase() })); return }
      await appAlert(t('ct_error_guardar', { msg: error.message }))
      return
    }
    onSaved()
  }

  return (
    <CenterModal onClose={onClose} maxWidth={380}>
      <div className="mb-4 text-center text-[15px] font-semibold font-display">{t('ct_editar_titulo')}</div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_nombre')}</div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={t('ct_placeholder_nombre')}
        className="mb-4 w-full rounded-2xl px-3.5 py-3 text-[13px] outline-none"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-1)' }}
      />

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_division')}</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {gruposDisponibles.map((g) => {
          const col = COLORS[g.color] ?? COLORS.lavender
          const sel = grupoId === g.id
          return (
            <button
              key={g.id}
              onClick={() => setGrupoId(g.id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-medium"
              style={{ background: sel ? col.dim : 'var(--card)', border: `1px solid ${sel ? col.fg : 'var(--line)'}`, color: sel ? col.fg : 'var(--text-2)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: col.fg }} />
              {g.nombre}
            </button>
          )
        })}
      </div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('ct_icono')}</div>
      <div className="mb-5 grid max-h-52 grid-cols-6 gap-2 overflow-y-auto pr-1">
        {ICONOS_CATEGORIA.map((key) => {
          const Icon = ICONS[key]
          const sel = icono === key
          const col = grupoSel ? (COLORS[grupoSel.color] ?? COLORS.lavender) : null
          return (
            <button
              key={key}
              onClick={() => setIcono(key)}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: sel && col ? col.fg : 'var(--card-2)', color: sel && col ? 'var(--bg)' : 'var(--text-2)', boxShadow: sel ? '0 0 0 2px var(--lime)' : 'none' }}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      <button
        onClick={guardar}
        disabled={saving || !nombre.trim() || !grupoId || !icono}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold disabled:opacity-40"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
      >
        {saving ? t('ct_guardando') : <><Check size={15} /> {t('ct_guardar_cambios')}</>}
      </button>
    </CenterModal>
  )
}

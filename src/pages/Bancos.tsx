import { useState } from 'react'
import { appConfirm, appAlert } from '../lib/dialogs'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Plus, X as XSmall, Lock, Check, Building2, Search, Globe2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useBancosPersonalizados } from '../hooks/useBancosPersonalizados'
import { usePais } from '../hooks/usePais'
import { useBancosDesbloqueados } from '../hooks/useBancosDesbloqueados'
import { continenteDe } from '../lib/paises'
import ProPaywallSheet from '../components/ProPaywallSheet'
import CenterModal from '../components/CenterModal'
import { COLORS, BANCOS_GRUPOS } from './Cuentas'
import { useIdioma } from '../lib/IdiomaContext'
import type { ClaveTraduccion } from '../lib/i18n'
import type { BancoPersonalizado } from '../lib/database.types'

const GRUPOS_CONTINENTE: { id: string; labelKey: ClaveTraduccion }[] = [
  { id: 'norteamerica', labelKey: 'cn_grupo_norteamerica' },
  { id: 'centroamerica', labelKey: 'cn_grupo_centroamerica' },
  { id: 'sudamerica', labelKey: 'cn_grupo_sudamerica' },
  { id: 'europa', labelKey: 'cn_grupo_europa' },
  { id: 'asia', labelKey: 'cn_grupo_asia' },
]
// Mismas 5 claves que arriba, solo que como Record en vez de array —
// más cómodo para el lookup por id de BANCOS_GRUPOS.map() más abajo.
const GRUPO_LABEL_KEYS: Record<string, ClaveTraduccion> = Object.fromEntries(GRUPOS_CONTINENTE.map((g) => [g.id, g.labelKey]))

export default function Bancos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  const { esPro } = useFinanzas()
  const { bancos, loading, reload } = useBancosPersonalizados()
  const [showPaywall, setShowPaywall] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const { pais } = usePais()
  const miContinente = continenteDe(pais)
  const [bancosDesbloqueados, setBancosDesbloqueados] = useBancosDesbloqueados()
  const verTodosContinentes = !miContinente || (esPro && bancosDesbloqueados)

  const q = busqueda.trim().toLowerCase()
  const gruposBase = verTodosContinentes ? BANCOS_GRUPOS : BANCOS_GRUPOS.filter((g) => g.id === miContinente)
  const gruposFiltrados = gruposBase
    .map((g) => ({ ...g, bancos: q ? g.bancos.filter((b) => b.nombre.toLowerCase().includes(q)) : g.bancos }))
    .filter((g) => g.bancos.length > 0)
  const sinResultados = q.length > 0 && gruposFiltrados.length === 0

  async function remove(id: string) {
    if (!(await appConfirm(t('bancos_confirmar_borrar'), { danger: true }))) return
    const { error } = await supabase.from('bancos_personalizados').delete().eq('id', id)
    if (error) { await appAlert(t('bancos_error_borrar', { msg: error.message })); return }
    await reload()
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('bancos_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-5 rounded-2xl p-3.5 text-[11px] leading-relaxed" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
          {t('bancos_nota_predeterminados')}
        </div>

        <button
          onClick={() => (esPro ? setShowNueva(true) : setShowPaywall(true))}
          className="mb-5 flex w-full items-center gap-2.5 rounded-2xl px-4 py-3.5"
          style={{ background: esPro ? 'var(--lime-dim)' : 'var(--card)', border: `1px dashed ${esPro ? 'var(--lime)' : 'var(--line)'}` }}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: esPro ? 'var(--lime)' : 'var(--card-2)', color: esPro ? 'var(--lime-text)' : 'var(--text-3)' }}>
            {esPro ? <Plus size={16} /> : <Lock size={14} />}
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: esPro ? 'var(--lime)' : 'var(--text-3)' }}>
            {esPro ? t('bancos_nuevo') : t('bancos_paywall_titulo_corto')}
          </span>
        </button>

        {loading && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('bancos_cargando')}</div>}
        {!loading && bancos.length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('bancos_ninguno_agregado')}</div>}

        {bancos.length > 0 && (
          <div className="mb-6 grid grid-cols-4 gap-2.5">
            {bancos.map((b) => {
              const col = COLORS[b.color] ?? COLORS.lavender
              return (
                <div key={b.id} className="relative flex flex-col items-center gap-1.5 text-center">
                  <button
                    onClick={() => remove(b.id)}
                    className="absolute -right-1 -top-1 z-10 flex items-center justify-center rounded-full"
                    style={{ width: 18, height: 18, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-3)' }}
                  >
                    <XSmall size={10} />
                  </button>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: col.fg }}>
                    <Building2 size={18} style={{ color: 'var(--bg)' }} />
                  </div>
                  <div className="text-[9.5px] leading-tight" style={{ color: 'var(--text-2)' }}>{b.nombre}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Los ~70 bancos que ya trae CashFlow por defecto — de solo
        lectura acá (no se pueden editar ni borrar, viven en código, ver
        BANCOS_GRUPOS en Cuentas.tsx). Están para que el usuario pueda
        confirmar de un vistazo si el suyo ya está antes de agregarlo
        como personalizado y terminar con dos entradas del mismo banco. */}
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bancos_predeterminados_titulo')}</div>

        <div className="mb-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
          <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t('bancos_buscar')}
            className="w-full bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ color: 'var(--text-3)' }}>
              <XSmall size={14} />
            </button>
          )}
        </div>

        {gruposFiltrados.map((g) => (
          <div key={g.id} className="mb-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--lime)' }}>{t(GRUPO_LABEL_KEYS[g.id])}</div>
            {g.bancos.map((b) => {
              const col = COLORS[b.color] ?? COLORS.lavender
              return (
                <div key={b.nombre} className="flex items-center gap-2.5 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: col.fg }} />
                  <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{b.nombre}</span>
                </div>
              )
            })}
          </div>
        ))}
        {sinResultados && (
          <div className="py-4 text-center text-[11.5px]" style={{ color: 'var(--text-3)' }}>{t('cn_banco_sin_resultados')}</div>
        )}

        {/* Candado Pro de continentes — de entrada solo mostramos los
        bancos del continente del usuario (según el país guardado en su
        perfil); este interruptor es GLOBAL: lo mismo que se prenda acá
        aplica también en el selector de banco al crear una cuenta
        (CuentaNueva.tsx), porque ambos leen useBancosDesbloqueados(). */}
        {!verTodosContinentes && (
          <div className="mt-2 rounded-2xl p-3.5" style={{ background: 'var(--card-2)' }}>
            <div className="mb-1 text-[12.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{t('bancos_desbloquear_titulo')}</div>
            <div className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('bancos_desbloquear_desc')}</div>
            {esPro ? (
              <button
                onClick={() => setBancosDesbloqueados(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-3.5 py-3"
                style={{ background: 'var(--lime-dim)', border: '1px dashed var(--lime)' }}
              >
                <Globe2 size={16} style={{ color: 'var(--lime)' }} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--lime)' }}>{t('cn_ver_otros_continentes')}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPaywall(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-3.5 py-3"
                style={{ background: 'var(--card)', border: '1px dashed var(--line)' }}
              >
                <Lock size={14} style={{ color: 'var(--text-3)' }} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-3)' }}>{t('cn_desbloquear_otros_continentes')}</span>
              </button>
            )}
          </div>
        )}
        {esPro && bancosDesbloqueados && miContinente && (
          <button
            onClick={() => setBancosDesbloqueados(false)}
            className="mt-2 w-full text-center text-[11px] underline"
            style={{ color: 'var(--text-3)' }}
          >
            {t('bancos_volver_mi_continente')}
          </button>
        )}
      </div>

      {showPaywall && <ProPaywallSheet reason={t('bancos_paywall_razon')} onClose={() => setShowPaywall(false)} />}

      {showNueva && (
        <NuevoBancoModal
          userId={user?.id}
          existentes={bancos}
          onClose={() => setShowNueva(false)}
          onCreated={async () => { setShowNueva(false); await reload() }}
        />
      )}
    </div>
  )
}

function NuevoBancoModal({ userId, existentes, onClose, onCreated }: { userId: string | undefined; existentes: BancoPersonalizado[]; onClose: () => void; onCreated: () => void }) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState('')
  const [grupoId, setGrupoId] = useState('sudamerica')
  const [color, setColor] = useState('lavender')
  const [saving, setSaving] = useState(false)

  const yaExiste = existentes.some((b) => b.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())

  async function guardar() {
    if (!userId || !nombre.trim() || yaExiste) return
    setSaving(true)
    const { error } = await supabase.from('bancos_personalizados').insert({
      user_id: userId, nombre: nombre.trim(), grupo: grupoId, color,
    })
    setSaving(false)
    if (error) { await appAlert(t('bancos_error_crear', { msg: error.message })); return }
    onCreated()
  }

  return (
    <CenterModal onClose={onClose} maxWidth={380}>
      <div className="mb-4 text-center text-[15px] font-semibold font-display">{t('bancos_nuevo')}</div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bancos_nombre')}</div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={t('bancos_placeholder_nombre')}
        className="mb-1 w-full rounded-2xl px-3.5 py-3 text-[13px] outline-none"
        style={{ background: 'var(--card)', border: `1px solid ${yaExiste ? 'var(--coral)' : 'var(--line)'}`, color: 'var(--text-1)' }}
      />
      {yaExiste && <div className="mb-3 text-[10.5px]" style={{ color: 'var(--coral)' }}>{t('bancos_ya_existe')}</div>}
      {!yaExiste && <div className="mb-4" />}

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bancos_continente')}</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {GRUPOS_CONTINENTE.map((g) => {
          const sel = grupoId === g.id
          return (
            <button
              key={g.id}
              onClick={() => setGrupoId(g.id)}
              className="rounded-full px-3 py-2 text-[11px] font-medium"
              style={{ background: sel ? 'var(--lime-dim)' : 'var(--card)', border: `1px solid ${sel ? 'var(--lime)' : 'var(--line)'}`, color: sel ? 'var(--lime)' : 'var(--text-2)' }}
            >
              {t(g.labelKey)}
            </button>
          )
        })}
      </div>

      <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('bancos_color')}</div>
      <div className="mb-5 flex flex-wrap gap-2.5">
        {Object.entries(COLORS).map(([key, col]) => {
          const sel = color === key
          return (
            <button
              key={key}
              onClick={() => setColor(key)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: col.fg, boxShadow: sel ? '0 0 0 2px var(--bg), 0 0 0 4px ' + col.fg : 'none' }}
            >
              {sel && <Check size={15} style={{ color: 'var(--bg)' }} />}
            </button>
          )
        })}
      </div>

      <button
        onClick={guardar}
        disabled={saving || !nombre.trim() || yaExiste}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold disabled:opacity-40"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
      >
        {saving ? t('bancos_guardando') : <><Check size={15} /> {t('bancos_crear')}</>}
      </button>
    </CenterModal>
  )
}

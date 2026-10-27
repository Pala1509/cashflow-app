import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, User, Lock, Bell, DollarSign, Grid3x3, Landmark,
  Languages, Download, ShieldCheck, FileText, HelpCircle, Info, LogOut, ChevronRight, Sparkles, Heart, CircleCheck, Compass, Sun, Moon, Trash2, AlertTriangle, Star, Mic,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { supabase } from '../lib/supabase'
import { appAlert } from '../lib/dialogs'
import { iniciarTour } from '../lib/tourTrigger'
import { useTema } from '../hooks/useTema'
import { useVersionApp } from '../lib/version'
import { siriDisponible } from '../lib/siri'
import { useIdioma } from '../lib/IdiomaContext'
import { useProDuo } from '../hooks/useProDuo'
import { getNombre } from '../lib/profile'
import Avatar from '../components/Avatar'
import CenterModal from '../components/CenterModal'

export default function Perfil() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { reload } = useFinanzas()
  const { tema, cambiarTema } = useTema(user?.id ?? null)
  const { idioma, cambiarIdioma, t } = useIdioma()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showIdioma, setShowIdioma] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showBorrarTodo, setShowBorrarTodo] = useState(false)
  const [showEliminarCuenta, setShowEliminarCuenta] = useState(false)
  const version = useVersionApp()

  const nombre = getNombre(user)
  const sub = user?.email || (user?.phone ? `+${user.phone}` : '')

  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('perfil_titulo')}</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:flex md:justify-center">
        <div className="md:w-[420px]">
        <div className="flex flex-col items-center py-3.5 pb-5.5">
          <div className="relative">
            <Avatar user={user} size={76} onClick={() => navigate('/perfil/editar?foto=1')} />
            <button
              onClick={() => navigate('/perfil/editar?foto=1')}
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ width: 24, height: 24, background: 'var(--card)', border: '2px solid var(--bg)', color: 'var(--text-2)' }}
            >
              <Camera size={11} />
            </button>
          </div>
          <div className="mt-3 text-[17px] font-bold font-display">
            {nombre}{user?.user_metadata?.apellido ? ` ${user.user_metadata.apellido}` : ''}
          </div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>{sub}</div>
        </div>

        <CashFlowProBanner />
        <ProDuoInline />

        <GroupLabel>{t('perfil_cuenta')}</GroupLabel>
        <Group>
          <Row icon={<User size={16} />} label={t('perfil_editar_perfil')} onClick={() => navigate('/perfil/editar')} />
          <Row icon={<Lock size={16} />} label={t('perfil_seguridad_pin')} onClick={() => navigate('/perfil/seguridad')} />
          <Row icon={<Bell size={16} />} label={t('perfil_notificaciones')} onClick={() => navigate('/perfil/notificaciones')} last />
        </Group>

        <GroupLabel>{t('perfil_preferencias')}</GroupLabel>
        <Group>
          <Row icon={<DollarSign size={16} />} label={t('perfil_moneda')} value="COP" onClick={() => navigate('/perfil/moneda')} />
          <Row icon={<Landmark size={16} />} label={t('perfil_bancos')} onClick={() => navigate('/perfil/bancos')} />
          <Row icon={<Grid3x3 size={16} />} label={t('perfil_categorias')} onClick={() => navigate('/perfil/categorias')} />
          <Row icon={<Star size={16} />} label={t('perfil_frecuentes')} onClick={() => navigate('/perfil/frecuentes')} />
          {siriDisponible() && <Row icon={<Mic size={16} />} label={t('perfil_siri')} onClick={() => navigate('/perfil/siri')} />}
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--text-2)', width: 20 }}>{tema === 'light' ? <Sun size={16} /> : <Moon size={16} />}</span>
              <span className="text-[13px]">{t('perfil_modo_oscuro')}</span>
            </div>
            <button
              onClick={() => cambiarTema(tema === 'dark' ? 'light' : 'dark')}
              className="relative flex-shrink-0 rounded-full"
              style={{ width: 38, height: 22, background: tema === 'dark' ? 'var(--lime)' : 'var(--card-2)' }}
            >
              <div className="absolute top-0.5 rounded-full" style={{ width: 18, height: 18, background: tema === 'dark' ? 'var(--lime-text)' : 'var(--text-3)', left: tema === 'dark' ? 18 : 2, transition: 'left .15s' }} />
            </button>
          </div>
          <Row icon={<Languages size={16} />} label={t('perfil_idiomas')} value={idioma === 'es' ? 'Español' : 'English'} onClick={() => setShowIdioma(true)} last />
        </Group>

        <GroupLabel>{t('perfil_datos')}</GroupLabel>
        <Group>
          <Row icon={<Download size={16} />} label={t('perfil_exportar_datos')} onClick={() => navigate('/perfil/exportar')} />
          <Row icon={<ShieldCheck size={16} />} label={t('perfil_privacidad')} onClick={() => navigate('/perfil/privacidad')} />
          <Row icon={<FileText size={16} />} label={t('perfil_terminos')} onClick={() => navigate('/perfil/terminos')} last />
        </Group>
        <button
          onClick={() => setShowBorrarTodo(true)}
          className="mt-2.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          style={{ background: 'var(--coral-dim)', border: '1px solid var(--coral-dim)' }}
        >
          <Trash2 size={16} style={{ color: 'var(--coral)' }} />
          <span className="flex-1 text-[13px] font-semibold" style={{ color: 'var(--coral)' }}>{t('perfil_borrar_todo')}</span>
        </button>
        <button
          onClick={() => setShowEliminarCuenta(true)}
          className="mt-2 w-full py-2 text-center text-[11.5px] underline"
          style={{ color: 'var(--text-3)' }}
        >
          {t('perfil_eliminar_cuenta')}
        </button>

        <GroupLabel>{t('perfil_soporte')}</GroupLabel>
        <Group>
          <Row icon={<HelpCircle size={16} />} label={t('perfil_ayuda')} onClick={() => navigate('/perfil/ayuda')} />
          <Row
            icon={<Compass size={16} />}
            label={t('perfil_ver_tour')}
            onClick={() => { navigate('/inicio'); setTimeout(() => iniciarTour(), 150) }}
          />
          <Row icon={<Info size={16} />} label={t('perfil_acerca_de')} value={`v${version}`} onClick={() => navigate('/perfil/acerca')} last />
        </Group>

        <button
          onClick={() => setShowConfirm(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-semibold"
          style={{ background: 'var(--coral-dim)', border: '1px solid var(--coral-dim)', color: 'var(--coral)' }}
        >
          <LogOut size={16} /> {t('perfil_cerrar_sesion')}
        </button>
        <a
          href={`mailto:hola@vantalabstudio.com?subject=${encodeURIComponent('Quiero eliminar mi cuenta de CashFlow')}&body=${encodeURIComponent(`Hola,\n\nQuiero solicitar la eliminación completa de mi cuenta y datos de CashFlow.\n\nCorreo de mi cuenta: ${user?.email ?? ''}`)}`}
          className="mt-4 block text-center text-[11.5px]"
          style={{ color: 'var(--text-3)' }}
        >
          {t('perfil_eliminar_cuenta')}
        </a>
        </div>
      </div>

      {showConfirm && (
        <CenterModal onClose={() => setShowConfirm(false)}>
            <div className="mb-3.5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--coral-dim)', border: '1.5px solid var(--coral)', color: 'var(--coral)' }}>
                <LogOut size={24} />
              </div>
            </div>
            <div className="text-center text-[15px] font-semibold font-display">{t('perfil_confirmar_salir')}</div>
            <div className="mt-1.5 text-center text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {t('perfil_confirmar_salir_sub')}
            </div>
            <div className="mt-4.5 flex gap-2.5">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
                {t('perfil_cancelar')}
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: 'var(--coral)', color: '#2b0906' }}
              >
                {loggingOut ? t('perfil_saliendo') : t('perfil_cerrar_sesion')}
              </button>
            </div>
        </CenterModal>
      )}

      {showEliminarCuenta && (
        <EliminarCuentaModal onClose={() => setShowEliminarCuenta(false)} onDone={async () => { setShowEliminarCuenta(false); await signOut() }} />
      )}

      {showBorrarTodo && (
        <BorrarTodoModal userId={user?.id} onClose={() => setShowBorrarTodo(false)} onDone={async () => { setShowBorrarTodo(false); await reload(); navigate('/inicio') }} />
      )}

      {showIdioma && (
        <CenterModal onClose={() => setShowIdioma(false)} maxWidth={300}>
          <div className="mb-3 text-center text-[13px] font-semibold">{t('perfil_idiomas')}</div>
          {(['es', 'en'] as const).map((op) => (
            <button
              key={op}
              onClick={() => { cambiarIdioma(op); setShowIdioma(false) }}
              className="mb-2 flex w-full items-center justify-between rounded-2xl px-4 py-3"
              style={idioma === op ? { background: 'var(--lime-dim)', border: '1px solid var(--lime)', color: 'var(--lime)' } : { background: 'var(--card-2)', border: '1px solid transparent', color: 'var(--text-1)' }}
            >
              <span className="text-[13px]">{op === 'es' ? 'Español' : 'English'}</span>
              {idioma === op && <CircleCheck size={16} />}
            </button>
          ))}
        </CenterModal>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4.5 text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{children}</div>
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--card)' }}>{children}</div>
}

function Row({ icon, label, value, onClick, noChevron, last }: { icon: React.ReactNode; label: string; value?: string; onClick?: () => void; noChevron?: boolean; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}
    >
      <span style={{ color: 'var(--text-2)', width: 20 }}>{icon}</span>
      <span className="flex-1 text-[13px]">{label}</span>
      {value && <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{value}</span>}
      {!noChevron && <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
    </button>
  )
}

function ProDuoInline() {
  const navigate = useNavigate()
  const { esPro, reload } = useFinanzas()
  const { row, partnerName, canjearCodigo, error } = useProDuo()
  const [codigo, setCodigo] = useState('')
  const [canjeando, setCanjeando] = useState(false)
  const [ok, setOk] = useState(false)

  async function handleCanjear() {
    if (!codigo.trim()) return
    setCanjeando(true)
    const success = await canjearCodigo(codigo)
    setCanjeando(false)
    if (success) {
      setOk(true)
      await reload()
    }
  }

  // Ya eres Pro y tienes un vínculo (invitación pendiente o pareja
  // vinculada) — un renglón compacto que lleva al detalle.
  if (esPro && row) {
    return (
      <button
        onClick={() => navigate('/perfil/pro-duo')}
        className="mb-5 -mt-2.5 flex w-full items-center gap-3 rounded-2xl p-3.5"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--pink-dim)', color: 'var(--pink)' }}>
          <Heart size={14} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[12px] font-semibold">Pro Dúo</div>
          <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            {row.estado === 'activo' ? `Vinculado con ${partnerName ?? 'tu pareja'}` : 'Invitación enviada — esperando que la canjeen'}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
      </button>
    )
  }

  // Ya eres Pro (de cualquier forma) — no hay nada que canjear.
  if (esPro) return null

  if (ok) {
    return (
      <div className="mb-5 -mt-2.5 flex items-center gap-2.5 rounded-2xl p-3.5" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
        <CircleCheck size={16} />
        <div className="text-[11.5px] font-medium">¡Listo! Ya tienes CashFlow Pro.</div>
      </div>
    )
  }

  return (
    <div className="mb-5 -mt-2.5 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold">
        <Heart size={13} style={{ color: 'var(--pink)' }} /> ¿Tienes un código de invitación?
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Ej: FELO-4K21"
          className="w-full bg-transparent font-mono text-[13px] outline-none"
          style={{ color: 'var(--text-1)', letterSpacing: '0.04em' }}
        />
        <button onClick={handleCanjear} disabled={canjeando || !codigo.trim()} className="flex-shrink-0 text-[12.5px] font-bold disabled:opacity-40" style={{ color: 'var(--lime)' }}>
          {canjeando ? '...' : 'Canjear'}
        </button>
      </div>
      {error && <div className="mt-2 text-[10.5px]" style={{ color: 'var(--coral)' }}>{error}</div>}
    </div>
  )
}

function CashFlowProBanner() {
  const navigate = useNavigate()
  const { esPro } = useFinanzas()

  if (esPro) {
    return (
      <button
        onClick={() => navigate('/perfil/pro')}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl p-4"
        style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
          <Sparkles size={18} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--lime)' }}>CashFlow Pro activo</div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>Tienes todo desbloqueado</div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--lime)' }} />
      </button>
    )
  }

  return (
    <button
      onClick={() => navigate('/perfil/pro')}
      className="mb-5 flex w-full items-center gap-3 rounded-2xl p-4"
      style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
        <Sparkles size={18} />
      </div>
      <div className="flex-1 text-left">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--lime)' }}>Pásate a CashFlow Pro</div>
        <div className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>Cuentas, metas y categorías ilimitadas</div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--lime)' }} />
    </button>
  )
}

// Borra TODO el contenido financiero del usuario (cuentas, movimientos,
// deudas, metas, gastos/ingresos fijos, presupuestos y categorías —
// incluyendo las personalizadas) para arrancar de cero, sin tener que
// borrar la cuenta de verdad. El perfil (nombre, foto, Pro, idioma) NO
// se toca — esto es solo la plata.
//
// Orden de borrado importa: transacciones tiene una FK "on delete
// restrict" hacia cuentas (no se puede borrar una cuenta con movimientos
// todavía apuntándole), así que transacciones va primero. deudas_creditos
// y metas_ahorro cascadean solas hacia pagos_deuda/aportes_meta. Las
// categorías van al final — se re-siembran solas la próxima vez que
// useFinanzas cargue (ver DEFAULT_CATEGORIAS en useFinanzas.ts), así que
// no hay que preocuparse por dejar la app sin categorías.
function BorrarTodoModal({ userId, onClose, onDone }: { userId: string | undefined; onClose: () => void; onDone: () => void }) {
  const { t } = useIdioma()
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const palabraClave = t('perfil_borrar_palabra_clave')
  const listo = texto.trim().toUpperCase() === palabraClave.toUpperCase()

  async function confirmar() {
    if (!userId || !listo) return
    setBorrando(true)
    const tablas = ['transacciones', 'deudas_creditos', 'metas_ahorro', 'gastos_fijos', 'ingresos_fijos', 'presupuestos', 'cuentas', 'categorias']
    for (const tabla of tablas) {
      const { error } = await supabase.from(tabla).delete().eq('user_id', userId)
      if (error) {
        setBorrando(false)
        await appAlert(t('perfil_error_borrar_todo', { tabla, msg: error.message }))
        return
      }
    }
    setBorrando(false)
    onDone()
  }

  return (
    <CenterModal onClose={onClose}>
      <div className="mb-3.5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--coral-dim)', border: '1.5px solid var(--coral)', color: 'var(--coral)' }}>
          <AlertTriangle size={24} />
        </div>
      </div>
      <div className="text-center text-[15px] font-semibold font-display">{t('perfil_borrar_todo_titulo')}</div>
      <div className="mt-1.5 text-center text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {t('perfil_borrar_todo_sub')}
      </div>
      <div className="mt-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>
        {t('perfil_borrar_todo_instruccion', { palabra: palabraClave })}
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={palabraClave}
        className="mt-2.5 w-full rounded-2xl px-4 py-3 text-center text-[14px] font-bold tracking-wide outline-none"
        style={{ background: 'var(--card-2)', border: `1.5px solid ${listo ? 'var(--coral)' : 'var(--line)'}`, color: 'var(--text-1)' }}
      />
      <div className="mt-4.5 flex gap-2.5">
        <button onClick={onClose} className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
          {t('perfil_cancelar')}
        </button>
        <button
          onClick={confirmar}
          disabled={!listo || borrando}
          className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--coral)', color: '#2b0906' }}
        >
          {borrando ? t('perfil_borrando_todo') : t('perfil_borrar_todo')}
        </button>
      </div>
    </CenterModal>
  )
}

// Eliminar la cuenta DE VERDAD (requisito de App Store y Google Play): a
// diferencia de "Borrar todo", esto borra también el usuario de inicio de
// sesión, vía la Edge Function `eliminar-cuenta` (necesita service role,
// por eso no se hace desde el cliente). La cuenta es de Vanta, así que el
// aviso dice que aplica a todas las apps de Vanta Lab que use.
function EliminarCuentaModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useIdioma()
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const palabraClave = t('perfil_eliminar_palabra_clave')
  const listo = texto.trim().toUpperCase() === palabraClave.toUpperCase()

  async function confirmar() {
    if (!listo) return
    setBorrando(true)
    const { data, error } = await supabase.functions.invoke('eliminar-cuenta', { method: 'POST' })
    setBorrando(false)
    if (error || !data?.ok) {
      await appAlert(t('perfil_error_eliminar_cuenta', { msg: data?.error ?? error?.message ?? '' }))
      return
    }
    await appAlert(t('perfil_cuenta_eliminada'))
    onDone()
  }

  return (
    <CenterModal onClose={onClose}>
      <div className="mb-3.5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--coral-dim)', border: '1.5px solid var(--coral)', color: 'var(--coral)' }}>
          <AlertTriangle size={24} />
        </div>
      </div>
      <div className="text-center text-[15px] font-semibold font-display">{t('perfil_eliminar_cuenta_titulo')}</div>
      <div className="mt-1.5 text-center text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {t('perfil_eliminar_cuenta_sub')}
      </div>
      <div className="mt-4 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>
        {t('perfil_borrar_todo_instruccion', { palabra: palabraClave })}
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={palabraClave}
        className="mt-2.5 w-full rounded-2xl px-4 py-3 text-center text-[14px] font-bold tracking-wide outline-none"
        style={{ background: 'var(--card-2)', border: `1.5px solid ${listo ? 'var(--coral)' : 'var(--line)'}`, color: 'var(--text-1)' }}
      />
      <div className="mt-4.5 flex gap-2.5">
        <button onClick={onClose} className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
          {t('perfil_cancelar')}
        </button>
        <button
          onClick={confirmar}
          disabled={!listo || borrando}
          className="flex-1 rounded-2xl py-3.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--coral)', color: '#2b0906' }}
        >
          {borrando ? t('perfil_borrando_todo') : t('perfil_eliminar_cuenta_boton')}
        </button>
      </div>
    </CenterModal>
  )
}

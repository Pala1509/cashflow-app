import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Wallet, Scale, SlidersHorizontal, LayoutDashboard, Plus, WifiOff, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import Logo from './Logo'
import Avatar from './Avatar'
import DialogHost from './DialogHost'
import TourOverlay from './TourOverlay'
import { useAuth } from '../lib/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { pendingCount, syncOutbox } from '../lib/offlineSync'
import { useNotificacionesEngine } from '../hooks/useNotificacionesEngine'
import { usePushRegistration } from '../hooks/usePushRegistration'
import { useWidgetLaunch } from '../hooks/useWidgetLaunch'
import { useSiriAuto } from '../hooks/useSiriAuto'
import { tourVisto, marcarTourVisto } from '../lib/onboardingStatus'
import { _registerTourTrigger } from '../lib/tourTrigger'
import { useTema } from '../hooks/useTema'
import { useIdioma } from '../lib/IdiomaContext'

// Barra de celular: 5 destinos parejos — el FAB ya no vive adentro de la
// barra, flota aparte (abajo-derecha) para que quepan las 5 pestañas sin
// apretarse. labelKey en vez de texto fijo — se traduce en el render.
const MOBILE_TABS = [
  { path: '/inicio', labelKey: 'nav_inicio' as const, icon: Activity },
  { path: '/cuentas', labelKey: 'nav_cuentas' as const, icon: Wallet },
  { path: '/deudas', labelKey: 'nav_deudas' as const, icon: Scale },
  { path: '/balance', labelKey: 'nav_balance' as const, icon: SlidersHorizontal },
  { path: '/resumen', labelKey: 'nav_resumen' as const, icon: LayoutDashboard },
]

// Rail de tablet/desktop: mismos 5 destinos arriba, Perfil aparte abajo
// del todo (ver el botón dedicado más abajo en el JSX).
const RAIL_ITEMS = MOBILE_TABS

export default function AppShell() {
  const location = useLocation()
  const { pathname } = location
  // Cuentas/Deudas comparten la misma pantalla de "Nueva cuenta" —
  // sin esto, crear una tarjeta desde Deudas resaltaba "Cuentas" en el
  // nav (por la URL /cuentas/nueva), aunque volvieras a Deudas al
  // terminar. Con este estado le decimos al nav de dónde viniste de
  // verdad, para que resalte la pestaña correcta mientras llenas el
  // formulario.
  const activePath = (location.state as { from?: string } | null)?.from ?? pathname
  const navigate = useNavigate()
  const { user } = useAuth()
  const online = useOnlineStatus()
  useNotificacionesEngine()
  usePushRegistration(user?.id ?? null)
  useWidgetLaunch()
  useTema(user?.id ?? null)
  const { t } = useIdioma()
  const [pendientes, setPendientes] = useState(0)
  const [mostrarTour, setMostrarTour] = useState(false)
  useSiriAuto(user?.id ?? null, mostrarTour)

  useEffect(() => {
    pendingCount().then(setPendientes)
    if (online) syncOutbox((n) => setPendientes(n)).then(() => pendingCount().then(setPendientes))
  }, [online])

  // La primera vez que entras a la cuenta (nunca antes), el tour arranca
  // solo. También se registra un disparador global para que el botón
  // "Ver el tour de nuevo" en Perfil pueda arrancarlo desde ahí.
  useEffect(() => {
    if (!user) return
    let cancelado = false
    tourVisto(user.id).then((visto) => { if (!cancelado && !visto) setMostrarTour(true) })
    _registerTourTrigger(() => setMostrarTour(true))
    return () => { cancelado = true; _registerTourTrigger(null) }
  }, [user])

  async function cerrarTour() {
    setMostrarTour(false)
    if (user) await marcarTourVisto(user.id)
  }

  function handleFab() {
    navigate('/movimiento/nuevo')
  }

  return (
    <div className="relative flex h-full" style={{ background: 'var(--bg)' }}>
      <DialogHost />
      {mostrarTour && <TourOverlay onDone={cerrarTour} />}
      {/* ---- Rail lateral: solo tablet/desktop (md y arriba) ---- */}
      <div
        className="hidden md:flex md:w-[84px] md:flex-shrink-0 md:flex-col md:items-center md:gap-2 md:py-6"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--line)' }}
      >
        <div className="mb-5">
          <Logo size={38} rounded={12} />
        </div>

        {RAIL_ITEMS.map((tab) => {
          const active = activePath.startsWith(tab.path)
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              data-tour={tab.path === '/cuentas' ? 'tab-cuentas' : tab.path === '/deudas' ? 'tab-deudas' : undefined}
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: active ? 'var(--lime-dim)' : 'transparent', color: active ? 'var(--lime)' : 'var(--text-3)' }}
              title={t(tab.labelKey)}
            >
              <Icon size={20} />
            </button>
          )
        })}

        <button
          onClick={handleFab}
          data-tour="fab-agregar"
          className="mt-3 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
          title="Agregar"
        >
          <Plus size={20} />
        </button>

        <div className="mt-auto">
          <Avatar user={user} size={38} onClick={() => navigate('/perfil')} />
        </div>
      </div>

      {/* ---- Contenido ---- */}
      {/* paddingTop con env(safe-area-inset-top): sin esto, en iOS el
      WebView se extiende de verdad hasta debajo de la isla dinámica/notch
      (a diferencia de Android, donde nunca hizo falta este ajuste) — el
      header de cada pantalla (avatar, saludo, título) quedaba pegado o
      montado sobre los íconos nativos de arriba (hora, batería). Puesto
      acá arriba de todo para que cubra también el aviso de "sin conexión"
      cuando aparece, no solo el contenido normal de cada pantalla. Mismo
      patrón que ya se usaba abajo para el gesto/home indicator (ver
      env(safe-area-inset-bottom) más abajo en este mismo archivo). */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {(!online || pendientes > 0) && (
          <div
            className="flex flex-shrink-0 items-center justify-center gap-2 py-1.5 text-[10.5px] font-medium"
            style={{ background: online ? 'var(--lime-dim)' : 'var(--yellow-dim)', color: online ? 'var(--lime)' : 'var(--yellow)' }}
          >
            {online ? <RefreshCw size={11} /> : <WifiOff size={11} />}
            {online
              ? t('offline_sincronizando', { n: pendientes })
              : pendientes > 0
              ? t('offline_sin_conexion_pendientes', { n: pendientes })
              : t('offline_sin_conexion')}
          </div>
        )}
        <div className="scroll-bottom-clear min-h-0 flex-1 overflow-y-auto">
          <div key={pathname} className="page-transition h-full">
            <Outlet />
          </div>
        </div>

        {/* ---- Tab bar inferior: solo celular (se oculta en md y arriba) ----
        Usamos "fixed" (no "absolute") a propósito: el contenedor padre tiene
        overflow-hidden, y un elemento "absolute" queda recortado por ese
        overflow aunque esté "bottom-0" — eso era lo que se comía la barra
        y el contenido en celular. "fixed" se ancla al viewport real y no
        lo afecta ningún overflow-hidden de arriba. */}
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center px-1 pt-2.5 backdrop-blur-md md:hidden"
          style={{ background: 'color-mix(in srgb, var(--card) 92%, transparent)', borderTop: '1px solid var(--line)', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {MOBILE_TABS.map((tab) => {
            const active = activePath.startsWith(tab.path)
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                data-tour={tab.path === '/cuentas' ? 'tab-cuentas' : tab.path === '/deudas' ? 'tab-deudas' : undefined}
                className="flex flex-1 flex-col items-center gap-1 text-[9px]"
                style={{ color: active ? 'var(--lime)' : 'var(--text-3)' }}
              >
                <Icon size={18} />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>

        {/* ---- FAB flotante: abajo-derecha, con levitación — vive aparte de
        la tab bar (antes estaba encajado en el centro de la barra). Mismo
        "fixed" por la misma razón del overflow-hidden de arriba. ---- */}
        <button
          onClick={handleFab}
          data-tour="fab-agregar"
          className="fixed z-30 flex items-center justify-center rounded-full fab-levitar md:hidden"
          style={{
            right: '1.1rem',
            bottom: 'max(5.5rem, calc(4.75rem + env(safe-area-inset-bottom)))',
            width: 52, height: 52,
            background: 'var(--lime)', color: 'var(--lime-text)',
            boxShadow: '0 8px 24px rgba(198,255,77,0.4)',
          }}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}

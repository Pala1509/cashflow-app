import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import AuthScreen from './pages/AuthScreen'
import ResetPassword from './pages/ResetPassword'
import EmailBloqueado from './components/EmailBloqueado'
import { emailVencido } from './lib/emailConfirm'
import { IdiomaProvider } from './lib/IdiomaContext'
import AppShell from './components/AppShell'
import Logo from './components/Logo'
import BootSplash from './components/BootSplash'
import AgregarRapido from './pages/AgregarRapido'
import { leerAccionWidget } from './lib/widget'
import Inicio from './pages/Inicio'
import Cuentas from './pages/Cuentas'
import Deudas from './pages/Deudas'
import CuentaNueva from './pages/CuentaNueva'
import Balance from './pages/Balance'
import BalanceNuevo from './pages/BalanceNuevo'
import Resumen from './pages/Resumen'
import Perfil from './pages/Perfil'
import EditarPerfil from './pages/EditarPerfil'
import Moneda from './pages/Moneda'
import SeguridadPin from './pages/SeguridadPin'
import Categorias from './pages/Categorias'
import Bancos from './pages/Bancos'
import Frecuentes from './pages/Frecuentes'
import Siri from './pages/Siri'
import ExportarDatos from './pages/ExportarDatos'
import CashFlowPro from './pages/CashFlowPro'
import { Ayuda, Privacidad, Terminos, AcercaDe, Notificaciones } from './pages/InfoScreens'
import PinGate from './components/PinGate'
import MovimientoNuevo from './pages/MovimientoNuevo'
import Movimientos from './pages/Movimientos'
import DeudaPago from './pages/DeudaPago'
import Presupuestos from './pages/Presupuestos'
import PresupuestoNuevo from './pages/PresupuestoNuevo'
import Simulador from './pages/Simulador'
import FlujoCaja from './pages/FlujoCaja'
import ErrorBoundary from './components/ErrorBoundary'
import ProDuo from './pages/ProDuo'
import { useAndroidBackButton } from './hooks/useAndroidBackButton'

function SetupNeeded() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg)' }}>
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold font-display"
        style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
      >
        !
      </div>
      <div className="text-base font-bold font-display">Faltan tus credenciales de Supabase</div>
      <div className="mt-3 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
        1. Copia <code>.env.example</code> a <code>.env.local</code><br />
        2. Pon tu <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (Settings → API en tu proyecto de Supabase)<br />
        3. Detén el servidor (Ctrl+C) y corre <code>npm run dev</code> de nuevo — Vite solo lee el .env al arrancar.
      </div>
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Logo size={64} rounded={18} />
      </div>
    )
  }
  if (!session) return <Navigate to="/auth" replace />
  // Se le deja entrar sin confirmar el correo — pero solo por un tiempo
  // (ver el banner de cuenta regresiva en Inicio). Pasado ese plazo, se
  // bloquea todo hasta que confirme — sin perder ningún dato.
  if (emailVencido(user)) return <EmailBloqueado />
  return <PinGate>{children}</PinGate>
}

function Routed() {
  const { session, user, loading } = useAuth()
  useAndroidBackButton()
  // Splash animado (logo + barra + frases) durante los primeros ~2s de
  // cada arranque en frío — no en cada navegación interna, solo cuando
  // este componente se monta de verdad (recargar la página / abrir la
  // app). El chequeo de sesión real (`loading` de useAuth) corre en
  // paralelo por su cuenta; si por algo tardara más que el splash
  // simbólico, `Protected` más abajo ya tiene su propio respaldo con
  // el logo solo mientras se resuelve.
  const [splashDone, setSplashDone] = useState(false)

  // Ventanita flotante de "agregar rápido" (QuickAddActivity, ver
  // android/.../QuickAddActivity.java) — se detecta leyendo el mismo
  // extra de intent que ya usaba el widget mediano ("ingreso"/"egreso"),
  // que desde ahora es exclusivo de esta Activity (el widget ya no
  // manda a MainActivity con ese extra). 'checking' es el estadito
  // inicial mientras se resuelve la llamada nativa — dura un instante,
  // y como la Activity ya es translúcida, no se nota nada raro en ese
  // momento. Se revisa ANTES que el splash a propósito: la ventanita no
  // debe pasar por los 2s del splash animado, ni por Routes completo.
  const [accionRapida, setAccionRapida] = useState<'ingreso' | 'egreso' | 'none' | 'checking'>('checking')
  useEffect(() => {
    leerAccionWidget().then(setAccionRapida)
  }, [])

  if (accionRapida === 'checking') return null

  if (accionRapida === 'ingreso' || accionRapida === 'egreso') {
    return (
      <IdiomaProvider userId={user?.id ?? null}>
        <AgregarRapido tipo={accionRapida} />
      </IdiomaProvider>
    )
  }

  if (!splashDone) {
    return <BootSplash onDone={() => setSplashDone(true)} />
  }

  // IdiomaProvider va aquí arriba, envolviendo TODA la app — no solo las
  // rutas ya logueadas. AuthScreen y ResetPassword viven fuera de
  // Protected (hace falta poder verlas sin sesión) pero también usan
  // useIdioma() para traducirse; con el Provider más abajo, esas dos
  // pantallas se caían en blanco (useIdioma() lanza un error si no
  // encuentra el Provider en el árbol). Sin usuario logueado (userId
  // null), el Provider simplemente no busca nada en la BD y usa 'es'
  // por default — normal para cualquier pantalla de login.
  return (
    <IdiomaProvider userId={user?.id ?? null}>
      <Routes>
      <Route
        path="/auth"
        element={!loading && session ? <Navigate to="/inicio" replace /> : <AuthScreen />}
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="inicio" element={<Inicio />} />
        <Route path="cuentas" element={<Cuentas />} />
        <Route path="deudas" element={<Deudas />} />
        <Route path="balance" element={<Balance />} />
        <Route path="resumen" element={<Resumen />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="perfil/editar" element={<EditarPerfil />} />
        <Route path="perfil/moneda" element={<Moneda />} />
        <Route path="perfil/seguridad" element={<SeguridadPin />} />
        <Route path="perfil/categorias" element={<Categorias />} />
        <Route path="perfil/frecuentes" element={<Frecuentes />} />
        <Route path="perfil/siri" element={<Siri />} />
        <Route path="perfil/bancos" element={<Bancos />} />
        <Route path="perfil/exportar" element={<ExportarDatos />} />
        <Route path="perfil/pro" element={<CashFlowPro />} />
        <Route path="perfil/pro-duo" element={<ProDuo />} />
        <Route path="perfil/notificaciones" element={<Notificaciones />} />
        <Route path="perfil/ayuda" element={<Ayuda />} />
        <Route path="perfil/privacidad" element={<Privacidad />} />
        <Route path="perfil/terminos" element={<Terminos />} />
        <Route path="perfil/acerca" element={<AcercaDe />} />

        {/* Antes eran pantallas completas aparte, sin el NAV — ahora viven
        aquí adentro para que el rail/tab bar nunca desaparezca, ni
        siquiera creando o editando algo. */}
        <Route path="movimiento/nuevo" element={<MovimientoNuevo />} />
        <Route path="movimiento/:id/editar" element={<MovimientoNuevo />} />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="deuda/:id/pago" element={<DeudaPago />} />
        <Route path="presupuestos" element={<Presupuestos />} />
        <Route path="presupuestos/nuevo" element={<PresupuestoNuevo />} />
        <Route path="resumen/simulador" element={<Simulador />} />
        <Route path="resumen/flujo" element={<FlujoCaja />} />
        <Route path="balance/nuevo" element={<BalanceNuevo />} />
        <Route path="balance/:id/editar" element={<BalanceNuevo />} />
        <Route path="cuentas/nueva" element={<CuentaNueva />} />
        <Route path="cuentas/:id/editar" element={<CuentaNueva />} />
      </Route>
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
    </IdiomaProvider>
  )
}

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routed />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}

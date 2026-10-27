import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { SplashScreen } from '@capacitor/splash-screen'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signUpWithEmail: (email: string, password: string, nombre: string, apellido: string, telefono: string, pais: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      // El splash nativo (logo de CashFlow) se queda puesto hasta este punto
      // exacto — así el usuario nunca ve un texto de "Cargando", solo pasa
      // del splash directo a la app ya lista.
      SplashScreen.hide().catch(() => {})
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signUpWithEmail: AuthContextValue['signUpWithEmail'] = async (email, password, nombre, apellido, telefono, pais) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // pais viaja en raw_user_meta_data igual que nombre/apellido/telefono —
      // handle_new_user() en Supabase lo copia a profiles.pais al crear la
      // cuenta, para poder mostrarle de entrada solo bancos de su continente.
      options: { data: { nombre, apellido, telefono, pais } },
    })
    return { error: error?.message ?? null }
  }

  const signInWithEmail: AuthContextValue['signInWithEmail'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  // Envía el código OTP por SMS. Requiere tener un proveedor SMS (ej. Twilio)
  // configurado en Supabase > Authentication > Providers > Phone.
  const signInWithPhone: AuthContextValue['signInWithPhone'] = async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error: error?.message ?? null }
  }

  const verifyPhoneOtp: AuthContextValue['verifyPhoneOtp'] = async (phone, token) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    return { error: error?.message ?? null }
  }

  // Manda el correo con el link de "restablecer contraseña" — el link
  // lleva a /reset-password (ver App.tsx), una pantalla pública que no
  // necesita sesión activa, porque Supabase te da una sesión temporal de
  // "recuperación" solo con hacer clic en el link.
  const resetPasswordForEmail: AuthContextValue['resetPasswordForEmail'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  // Se usa ya con la sesión de recuperación activa (después de abrir el
  // link del correo) para poner la contraseña nueva de verdad.
  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  // Reenvía el correo de "confirma tu cuenta" — se usa tanto en el
  // registro como en el aviso de "confírmalo antes de que se acabe el
  // plazo" que aparece en Inicio.
  const resendConfirmation: AuthContextValue['resendConfirmation'] = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithPhone,
        verifyPhoneOtp,
        resetPasswordForEmail,
        updatePassword,
        resendConfirmation,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

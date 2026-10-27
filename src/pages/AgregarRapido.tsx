import { useEffect, useState } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { useIdioma } from '../lib/IdiomaContext'
import { supabase } from '../lib/supabase'
import { todayLocal } from '../lib/date'
import { cerrarVentanaRapida } from '../lib/widget'
import { ICONS, COLORS } from './Cuentas'
import { nombreCategoria } from '../lib/categoriaI18n'
import { Check, DollarSign, X } from 'lucide-react'
import Logo from '../components/Logo'
import fondoRapido from '../assets/splash/cashflow_background.webp'

// Estilo de fondo compartido por las 4 variantes de esta pantalla — la
// misma imagen que ya usa el login (AuthScreen.tsx). Se intentó dejar
// esto de verdad translúcido (ver los 3 arreglos en QuickAddActivity.java
// y styles.xml — Window forzado a transparente, splash de Capacitor
// apagado, splash nativo de Android 12+ apagado) pero ni con los 3 juntos
// se logró ver la pantalla de inicio detrás — algo en el pipeline de
// renderizado del WebView dentro de una Activity translúcida lo sigue
// pintando opaco, y sin poder ver logs de un dispositivo real no hay
// forma de seguir cazando la causa exacta. Esto es lo pragmático: una
// imagen de fondo bonita en vez de intentar ver el home screen detrás.
const fondoStyle = { backgroundImage: `url(${fondoRapido})`, backgroundSize: 'cover', backgroundPosition: 'center' } as const

// Pantalla mínima montada dentro de QuickAddActivity (ventana translúcida
// aparte de la app completa — ver App.tsx y QuickAddActivity.java). Sin
// AppShell, sin barra de navegación, sin splash: el objetivo es que tocar
// "+ Ingreso"/"- Egreso" en el widget termine en 2-3 toques, no en varias
// pantallas. Precarga la categoría y cuenta más usadas para que, en el
// caso más simple, solo haga falta escribir el monto y tocar Guardar.
export default function AgregarRapido({ tipo }: { tipo: 'ingreso' | 'egreso' }) {
  const { user, loading: authLoading } = useAuth()
  const { t, idioma } = useIdioma()
  const { cuentas, topCategorias, loading, reload } = useFinanzas()
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  // Sin esto, el body{background:var(--bg)} global (opaco a propósito
  // para el resto de la app) tapa por completo la pantalla de inicio que
  // debería verse oscurecida detrás de esta ventanita — ver index.css.
  useEffect(() => {
    document.body.classList.add('modo-rapido')
    return () => document.body.classList.remove('modo-rapido')
  }, [])

  // El splash nativo de Capacitor (launchAutoHide: false en
  // capacitor.config.ts) se dispara solo en CUALQUIER Activity de
  // Capacitor, no solo en MainActivity — normalmente AuthContext.tsx lo
  // oculta una vez resuelve la sesión, pero acá no hay que esperar a
  // nada de auth para que esta ventanita ya se vea bien, así que se
  // llama aparte y de inmediato, sin depender de esa carrera.
  useEffect(() => {
    SplashScreen.hide().catch(() => {})
  }, [])

  const accent = tipo === 'egreso'
    ? { fg: 'var(--coral)', dim: 'var(--coral-dim)', text: '#2b0906' }
    : { fg: 'var(--lime)', dim: 'var(--lime-dim)', text: 'var(--lime-text)' }

  const topCats = !loading ? topCategorias(tipo, 3) : []
  const cuentasDisponibles = cuentas.filter((c) => c.tipo !== 'tarjeta_credito')

  // Preselecciona lo más usado — así con solo el monto ya alcanza para
  // guardar, y los chips quedan solo para cuando quieras cambiarlo.
  useEffect(() => {
    if (!categoriaId && topCats.length > 0) setCategoriaId(topCats[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topCats.length])
  useEffect(() => {
    if (!cuentaId && cuentasDisponibles.length > 0) setCuentaId(cuentasDisponibles[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentasDisponibles.length])

  const selAcc = cuentasDisponibles.find((c) => c.id === cuentaId)
  const amt = Number(monto || 0)
  const applyFour = tipo === 'egreso' && Boolean(selAcc?.four_x_mil)
  const tax = applyFour ? Math.round(amt * 0.004) : 0

  async function guardar() {
    if (!user || amt <= 0 || !categoriaId || !cuentaId) return
    setSaving(true)
    setErrorMsg(null)
    const { error } = await supabase.from('transacciones').insert({
      user_id: user.id,
      tipo,
      monto: amt,
      monto_4x1000: tax,
      categoria_id: categoriaId,
      cuenta_id: cuentaId,
      cuenta_destino_id: null,
      gasto_fijo_id: null,
      ingreso_fijo_id: null,
      descripcion: null,
      lugar: null,
      fecha: todayLocal(),
    })
    setSaving(false)
    if (error) { setErrorMsg(t('rapido_error', { msg: error.message })); return }
    setGuardado(true)
    await reload()
    // Medio segundo para que se alcance a ver el check antes de cerrar —
    // si se cierra al instante se siente como que no pasó nada.
    setTimeout(() => cerrarVentanaRapida(), 650)
  }

  // Mientras se resuelve la sesión (debería ser casi instantáneo, ya
  // viene de la app principal).
  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={fondoStyle}>
        <Logo size={36} rounded={10} />
      </div>
    )
  }

  // Sin sesión (caso raro — implicaría que nunca abriste la app de
  // verdad) — no tiene sentido intentar guardar nada.
  if (!user) {
    return (
      <div className="flex h-full items-center justify-center px-6" style={fondoStyle} onClick={() => cerrarVentanaRapida()}>
        <div className="w-full max-w-xs rounded-3xl p-5 text-center" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }} onClick={(e) => e.stopPropagation()}>
          <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{t('rapido_sin_sesion')}</div>
        </div>
      </div>
    )
  }

  if (guardado) {
    return (
      <div className="flex h-full items-center justify-center px-6" style={fondoStyle}>
        <div className="flex w-full max-w-xs flex-col items-center rounded-3xl p-6" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
          <div className="check-pop flex h-12 w-12 items-center justify-center rounded-full" style={{ background: accent.dim, color: accent.fg }}>
            <Check size={22} />
          </div>
          <div className="mt-3 text-[13px] font-semibold">{t('rapido_guardado')}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full items-end justify-center px-4 pb-8 md:items-center md:pb-0"
      style={fondoStyle}
      onClick={() => cerrarVentanaRapida()}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold font-display" style={{ color: accent.fg }}>
            {tipo === 'egreso' ? t('rapido_titulo_egreso') : t('rapido_titulo_ingreso')}
          </div>
          <button onClick={() => cerrarVentanaRapida()} style={{ color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        <div className="mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--text-3)' }}><DollarSign size={18} /></span>
          <input
            autoFocus
            inputMode="numeric"
            value={monto ? Number(monto).toLocaleString('es-CO') : ''}
            onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="w-full bg-transparent text-[22px] font-bold outline-none"
            style={{ color: 'var(--text-1)' }}
          />
        </div>

        {loading ? (
          <div className="mb-4 py-2 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>{t('rapido_cargando')}</div>
        ) : (
          <>
            {topCats.length > 0 && (
              <>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('rapido_categoria')}</div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {topCats.map((c) => {
                    const Icon = ICONS[c.icono] ?? ICONS.otros
                    const col = COLORS[c.color] ?? COLORS.lavender
                    const sel = categoriaId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCategoriaId(c.id)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] font-medium"
                        style={{ background: sel ? col.dim : 'var(--card)', border: `1.5px solid ${sel ? col.fg : 'var(--line)'}`, color: sel ? col.fg : 'var(--text-2)' }}
                      >
                        <Icon size={13} /> {nombreCategoria(c.nombre, idioma)}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {cuentasDisponibles.length > 0 && (
              <>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('rapido_cuenta')}</div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {cuentasDisponibles.slice(0, 4).map((c) => {
                    const sel = cuentaId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCuentaId(c.id)}
                        className="rounded-full px-3 py-2 text-[11.5px] font-medium"
                        style={{ background: sel ? accent.dim : 'var(--card)', border: `1.5px solid ${sel ? accent.fg : 'var(--line)'}`, color: sel ? accent.fg : 'var(--text-2)' }}
                      >
                        {c.nombre}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {errorMsg && <div className="mb-3 text-[11px]" style={{ color: 'var(--coral)' }}>{errorMsg}</div>}

        <button
          onClick={guardar}
          disabled={saving || amt <= 0 || !categoriaId || !cuentaId}
          className="w-full rounded-2xl py-3.5 text-[13.5px] font-bold disabled:opacity-40"
          style={{ background: accent.fg, color: accent.text }}
        >
          {saving ? t('rapido_guardando') : t('rapido_guardar')}
        </button>
      </div>
    </div>
  )
}

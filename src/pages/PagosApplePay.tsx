import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Zap, ExternalLink } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useFinanzas } from '../hooks/useFinanzas'
import { supabase } from '../lib/supabase'
import { siriActivado, activarSiri } from '../lib/siri'

// Perfil → Pagos con Apple Pay. Explica cómo crear (una sola vez) la
// automatización de Atajos que anota sola cada compra con Apple Pay, usando
// la acción "Registrar pago" de CashFlow (ver CashFlowSiri.swift y la Edge
// Function pago-wallet). Abajo, cada tarjeta de Wallet que ya se usó y a
// qué cuenta de CashFlow va.

interface TarjetaWallet { id: string; tarjeta: string; cuenta_id: string | null; ultimo_uso: string | null }

// Paso a paso. (Un enlace de iCloud no sirve: iOS importa solo la acción,
// sin el disparador de Wallet, así que la automatización se arma a mano.)
const PASOS: { titulo: string; detalle: string }[] = [
  { titulo: 'Abre Atajos y crea una automatización', detalle: 'Toca + y en el buscador escribe "Wallet". Escoge Wallet: "Al realizar un pago sin contacto con mi tarjeta". Queda "Cuando se use Cualquier tarjeta" (o escoge solo las tuyas, como LuloBank o Nu).' },
  { titulo: 'Déjalo automático', detalle: 'Toca la flechita junto a "Cualquier tarjeta": deja Automatización prendido, Confirmar antes de ejecutar apagado y apaga Notificar (CashFlow ya te avisa).' },
  { titulo: 'Agrega la acción de CashFlow', detalle: 'Abajo en Buscar escribe "CashFlow" y toca Registrar pago. Queda: "Registrar pago en Comercio por Importe con Tarjeta".' },
  { titulo: 'Conecta los datos del pago', detalle: 'Toca Comercio → escoge el botón azul Transacción → tócalo otra vez → Comercio. Repite: Importe → Transacción → Cantidad. Tarjeta → Transacción → Tarjeta o pase. Toca ✕ y luego ‹ para guardar.' },
]

export default function PagosApplePay() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cuentas } = useFinanzas()
  const [tarjetas, setTarjetas] = useState<TarjetaWallet[]>([])
  const [conectado, setConectado] = useState<boolean | null>(null)

  useEffect(() => {
    siriActivado().then(async (ok) => {
      // La acción usa el mismo token que Siri: si no está, se crea solo.
      if (!ok && user) { try { await activarSiri(user.id); ok = true } catch { /* sin red */ } }
      setConectado(ok)
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase.from('tarjetas_wallet').select('id, tarjeta, cuenta_id, ultimo_uso').eq('user_id', user.id).order('ultimo_uso', { ascending: false })
      .then(({ data }) => setTarjetas((data ?? []) as TarjetaWallet[]))
  }, [user])

  async function asociar(id: string, cuentaId: string) {
    setTarjetas((ts) => ts.map((t) => (t.id === id ? { ...t, cuenta_id: cuentaId || null } : t)))
    await supabase.from('tarjetas_wallet').update({ cuenta_id: cuentaId || null }).eq('id', id)
  }

  const cuentasUsables = cuentas.filter((c) => c.activa !== false && c.tipo !== 'cdt')

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} aria-label="Atrás" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">Pagos con Apple Pay</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="cf-sin-barra min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div className="mx-auto max-w-[480px]">
          <div className="mt-3 flex flex-col gap-3 rounded-[22px] p-5" style={{ background: 'var(--lime-dim)', border: '1px solid var(--lime)' }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--lime)' }}><Zap size={24} color="var(--lime-text)" /></div>
            <div className="text-[20px] font-bold font-display" style={{ color: 'var(--text-1)' }}>Tus compras con Apple Pay se anotan solas</div>
            <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Pagas con el iPhone o el reloj y a los segundos te llega: <b style={{ color: 'var(--text-1)' }}>"Gasto anotado · D1 · $8.900 · Alimentos · Nu"</b>. Se configura una sola vez.
            </div>
            {conectado === false && <div className="text-[12.5px]" style={{ color: 'var(--coral)' }}>Conéctate a internet para activar los pagos automáticos.</div>}
          </div>

          <div className="mb-2 mt-6 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Cómo activarlo (una sola vez)</div>
          <div className="flex flex-col gap-2.5">
            {PASOS.map((p, i) => (
              <div key={i} className="flex gap-3 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <span className="flex flex-shrink-0 items-center justify-center text-[13px] font-bold" style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--lime)', color: 'var(--lime-text)' }}>{i + 1}</span>
                <div className="flex flex-col gap-1">
                  <span className="text-[14.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{p.titulo}</span>
                  <span className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{p.detalle}</span>
                </div>
              </div>
            ))}
          </div>

          <a href="shortcuts://" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold" style={{ height: 52, background: 'var(--lime)', color: 'var(--lime-text)' }}>
            Abrir Atajos <ExternalLink size={16} />
          </a>

          <div className="mb-2 mt-7 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Tus tarjetas de Wallet</div>
          {tarjetas.length === 0 ? (
            <div className="rounded-2xl p-4 text-[13px] leading-relaxed" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
              Cuando pagues por primera vez con una tarjeta, aparece aquí y escoges a qué cuenta de CashFlow va. CashFlow adivina por el nombre (Nu, Lulo, Nequi…), pero lo puedes corregir.
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
              {tarjetas.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <CreditCard size={18} color="var(--text-2)" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{t.tarjeta}</span>
                  <select aria-label={`Cuenta para ${t.tarjeta}`} value={t.cuenta_id ?? ''} onChange={(e) => asociar(t.id, e.target.value)}
                    className="max-w-[150px] rounded-xl px-2 text-[13px] outline-none" style={{ height: 38, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--text-1)' }}>
                    <option value="">Escoger cuenta</option>
                    {cuentasUsables.map((c) => <option key={c.id} value={c.id}>{c.nombre.trim()}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Solo se anotan los pagos hechos con Apple Pay. Si tu banco no manda el valor, CashFlow te avisa para que lo pongas. Si un pago ya lo habías anotado, no se repite.
          </div>
        </div>
      </div>
    </div>
  )
}

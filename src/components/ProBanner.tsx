import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Sparkles, ArrowRight } from 'lucide-react'
import logoBlanco from '../assets/logos/logo-blanco-transparente-web.png'

export default function ProBanner() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/perfil/pro')}
      className="relative mt-5 block w-full overflow-hidden rounded-3xl p-5 text-left"
      style={{ background: 'linear-gradient(135deg, #C6FF4D 0%, #8FE000 60%, #6FBF00 100%)' }}
    >
      <div className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.16)' }} />
      <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
      <img
        src={logoBlanco}
        alt=""
        className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 select-none"
        style={{ opacity: 0.16, transform: 'rotate(-12deg)' }}
      />

      <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: 'rgba(26,36,0,0.15)' }}>
        <Sparkles size={17} style={{ color: 'var(--lime-text)' }} />
      </div>

      <div className="relative mt-3 text-[16px] font-bold leading-tight font-display" style={{ color: 'var(--lime-text)' }}>
        Desbloquea todo CashFlow
      </div>
      <div className="relative mt-1 text-[12px] leading-snug" style={{ color: '#2b3800' }}>
        {/* En iOS no se muestran precios hasta que existan compras de App Store (ver CashFlowPro.tsx). */}
        Cuentas ilimitadas, presupuestos, gastos hormiga y más{Capacitor.getPlatform() === 'ios' ? '.' : ' — desde $16.900/mes.'}
      </div>

      <div className="relative mt-3.5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold" style={{ background: 'var(--lime-text)', color: 'var(--lime)' }}>
        Ver CashFlow Pro <ArrowRight size={13} />
      </div>
    </button>
  )
}

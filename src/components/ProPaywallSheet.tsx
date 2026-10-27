import { useNavigate } from 'react-router-dom'
import { Lock, X } from 'lucide-react'
import CenterModal from './CenterModal'

export default function ProPaywallSheet({ reason, onClose }: { reason: string; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <CenterModal onClose={onClose}>
      <div className="flex justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
          <Lock size={20} />
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-3)' }}><X size={18} /></button>
      </div>
      <div className="mt-3.5 text-[16px] font-bold font-display">Esto es de CashFlow Pro</div>
      <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{reason}</div>
      <button
        onClick={() => navigate('/perfil/pro')}
        className="mt-4.5 w-full rounded-2xl py-3.5 text-[13px] font-bold"
        style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
      >
        Ver CashFlow Pro
      </button>
      <button onClick={onClose} className="mt-2.5 w-full py-1 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
        Ahora no
      </button>
    </CenterModal>
  )
}

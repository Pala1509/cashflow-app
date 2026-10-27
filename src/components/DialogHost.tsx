import { useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { _registerDialogBridge, type ConfirmOptions } from '../lib/dialogs'
import CenterModal from './CenterModal'

type Pending =
  | { type: 'confirm'; message: string; opts?: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'alert'; message: string; resolve: () => void }

export default function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    _registerDialogBridge({
      confirm: (message, opts) => new Promise<boolean>((resolve) => setPending({ type: 'confirm', message, opts, resolve })),
      alertMsg: (message) => new Promise<void>((resolve) => setPending({ type: 'alert', message, resolve })),
    })
    return () => _registerDialogBridge(null)
  }, [])

  if (!pending) return null

  function close(result: boolean) {
    if (!pending) return
    if (pending.type === 'confirm') pending.resolve(result)
    else pending.resolve()
    setPending(null)
  }

  const danger = pending.type === 'confirm' && Boolean(pending.opts?.danger)

  return (
    <CenterModal onClose={() => close(false)} maxWidth={320}>
      <div className="flex flex-col items-center px-1 py-1 text-center">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: danger ? 'var(--coral-dim)' : 'var(--lime-dim)', color: danger ? 'var(--coral)' : 'var(--lime)' }}
        >
          {danger ? <AlertTriangle size={22} /> : <Info size={22} />}
        </div>
        <div className="text-[13.5px] leading-relaxed">{pending.message}</div>
        <div className="mt-5 flex w-full gap-2.5">
          {pending.type === 'confirm' && (
            <button
              onClick={() => close(false)}
              className="flex-1 rounded-2xl py-3 text-[13px] font-semibold"
              style={{ background: 'var(--card-2)', color: 'var(--text-2)', border: '1px solid var(--line)' }}
            >
              {pending.opts?.cancelLabel ?? 'Cancelar'}
            </button>
          )}
          <button
            onClick={() => close(true)}
            className="flex-1 rounded-2xl py-3 text-[13px] font-bold"
            style={danger ? { background: 'var(--coral)', color: '#2b0906' } : { background: 'var(--lime)', color: 'var(--lime-text)' }}
          >
            {pending.type === 'confirm' ? (pending.opts?.confirmLabel ?? 'Aceptar') : 'Entendido'}
          </button>
        </div>
      </div>
    </CenterModal>
  )
}

export default function CenterModal({
  onClose,
  children,
  maxWidth = 340,
}: {
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-h-[80%] overflow-y-auto rounded-3xl p-5"
        style={{ maxWidth, background: 'var(--bg)', border: '1px solid var(--line)' }}
      >
        {children}
      </div>
    </div>
  )
}

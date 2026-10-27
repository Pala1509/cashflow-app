import { useRef, useState } from 'react'
import { X, Check, ZoomIn } from 'lucide-react'

const OUTPUT_SIZE = 512
const FRAME_SIZE = 260

export default function PhotoCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [imgUrl] = useState(() => URL.createObjectURL(file))
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
  }
  function onPointerUp() {
    dragRef.current = null
  }

  function confirm() {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Círculo de recorte
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    const scale = OUTPUT_SIZE / FRAME_SIZE
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    const baseScale = Math.max(FRAME_SIZE / naturalW, FRAME_SIZE / naturalH) * zoom
    const drawW = naturalW * baseScale * scale
    const drawH = naturalH * baseScale * scale
    const drawX = OUTPUT_SIZE / 2 - drawW / 2 + pos.x * scale
    const drawY = OUTPUT_SIZE / 2 - drawH / 2 + pos.y * scale

    ctx.drawImage(img, drawX, drawY, drawW, drawH)
    ctx.restore()

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div className="mb-5 text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Ajusta tu foto</div>

      <div
        className="relative overflow-hidden rounded-full touch-none"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE, background: 'var(--card)', border: '2px solid var(--lime)', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          ref={imgRef}
          src={imgUrl}
          alt="Vista previa"
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%,-50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            width: 'auto',
            height: FRAME_SIZE,
            maxWidth: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      <div className="mt-6 flex w-full max-w-xs items-center gap-3">
        <ZoomIn size={16} style={{ color: 'var(--text-3)' }} />
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>Arrastra la foto para moverla · desliza para hacer zoom</div>

      <div className="mt-7 flex gap-3">
        <button
          onClick={onCancel}
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}
        >
          <X size={18} />
        </button>
        <button
          onClick={confirm}
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

interface DragToConfirmButtonProps {
  label: string
  pendingLabel: string
  onConfirm: () => void
  disabled?: boolean
  pending?: boolean
}

const COMPLETE_THRESHOLD = 0.85

// A drag gesture, not a tap, is required to fire onConfirm — chosen
// specifically over a confirmation dialog, which reflexive tapping can blow
// straight through. Keyboard users aren't excluded: a native <button> still
// fires a click event on Enter/Space, and that synthetic click's `detail` is
// 0 (a real pointer-originated click's `detail` is always >= 1) — so the
// click handler below only ever confirms via keyboard, while every
// pointer-driven confirm has to come through the drag-distance check in the
// pointer handlers.
export function DragToConfirmButton({ label, pendingLabel, onConfirm, disabled, pending }: DragToConfirmButtonProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const maxDragRef = useRef(0)
  const wasPending = useRef(pending)

  useEffect(() => {
    // The request finished without the modal closing out from under us —
    // that only happens on failure (see CartContext#placeOrder, which keeps
    // the modal open and sets checkoutError instead) — so reset the handle
    // to let the customer drag again.
    if (wasPending.current && !pending) setDragX(0)
    wasPending.current = pending
  }, [pending])

  const locked = Boolean(disabled || pending)

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (locked) return
    const track = trackRef.current
    if (!track) return
    maxDragRef.current = track.offsetWidth - e.currentTarget.offsetWidth
    startXRef.current = e.clientX
    setDragging(true)
    try {
      // Keeps receiving move/up events even if the pointer strays outside
      // the (small) handle mid-drag — real browsers all support this; the
      // try/catch is only for environments that don't (some jsdom versions
      // in tests) so a missing/throwing implementation there doesn't break
      // the drag, just loses tracking once the pointer leaves the handle.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // See above — safe to ignore.
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!dragging) return
    const delta = e.clientX - startXRef.current
    setDragX(Math.max(0, Math.min(delta, maxDragRef.current)))
  }

  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    if (maxDragRef.current > 0 && dragX / maxDragRef.current >= COMPLETE_THRESHOLD) {
      setDragX(maxDragRef.current)
      onConfirm()
    } else {
      setDragX(0)
    }
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (e.detail === 0 && !locked) onConfirm()
  }

  const percent = maxDragRef.current > 0 ? (dragX / maxDragRef.current) * 100 : 0

  return (
    <div ref={trackRef} className={`drag-confirm-track${locked ? ' locked' : ''}`}>
      <div className="drag-confirm-fill" style={{ width: `${percent}%` }} />
      <span className="drag-confirm-label">{pending ? pendingLabel : label}</span>
      <button
        type="button"
        className="drag-confirm-handle"
        aria-label={label}
        disabled={locked}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        →
      </button>
    </div>
  )
}

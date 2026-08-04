import { useEffect, useRef, useState } from 'react'

interface Props {
  onCancelOrder: () => void
}

// The order-details card's kebab menu — mirrors vendor-web's component of
// the same name (duplicated per ADR 0001, not shared). Customers only ever
// have one action available here (cancel), but it still gets the same
// menu treatment rather than a bare button, for the same reason vendor-web
// does: a corner kebab reads as "more actions live here" without crowding
// the card, and this can grow later without another redesign.
export function OrderDetailActionsMenu({ onCancelOrder }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="item-actions-menu order-detail-actions-menu" ref={ref}>
      <button
        type="button"
        className="kebab-btn"
        aria-label="Order actions menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <div className="item-actions-dropdown" role="menu">
          <button
            role="menuitem"
            type="button"
            className="menu-item-danger"
            onClick={() => {
              setOpen(false)
              onCancelOrder()
            }}
          >
            Cancel order
          </button>
        </div>
      )}
    </div>
  )
}

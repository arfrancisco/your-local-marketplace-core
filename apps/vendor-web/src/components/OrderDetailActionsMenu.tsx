import { useEffect, useRef, useState } from 'react'

interface Props {
  onEditOrder?: () => void
  onCancelOrder?: () => void
}

// The order-details card's kebab menu — "Edit order" and "Cancel order",
// each only rendered when its action is actually available right now — kept
// as a real menu (not bare buttons) for consistency with this app's other
// per-card kebabs (ItemActionsMenu, DashboardActionsMenu). Same open/close
// interaction as those: trigger click, outside click via a document
// mousedown listener, Escape.
export function OrderDetailActionsMenu({ onEditOrder, onCancelOrder }: Props) {
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
          {onEditOrder && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                onEditOrder()
              }}
            >
              Edit order
            </button>
          )}
          {onCancelOrder && (
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
          )}
        </div>
      )}
    </div>
  )
}

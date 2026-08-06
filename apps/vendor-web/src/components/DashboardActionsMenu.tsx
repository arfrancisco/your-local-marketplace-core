import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  shopId: number
}

// The shop dashboard's kebab menu, holding the three things a vendor
// manages but doesn't need every day: shop details, inventory, reviews.
// Same open/close interaction as ItemActionsMenu (trigger click, outside
// click via a document mousedown listener, Escape) but its own component
// since every entry here is a plain navigation link — nothing destructive,
// so no .menu-item-danger anywhere in this menu.
export function DashboardActionsMenu({ shopId }: Props) {
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
    <div className="item-actions-menu dashboard-actions-menu" ref={ref}>
      <button
        type="button"
        className="kebab-btn"
        aria-label="Shop actions menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <div className="item-actions-dropdown" role="menu">
          <Link role="menuitem" to={`/shops/${shopId}/edit`} onClick={() => setOpen(false)}>
            Edit shop details
          </Link>
          <Link role="menuitem" to={`/shops/${shopId}/items`} onClick={() => setOpen(false)}>
            Inventory
          </Link>
          <Link role="menuitem" to={`/shops/${shopId}/reviews`} onClick={() => setOpen(false)}>
            Reviews
          </Link>
          <Link
            role="menuitem"
            to={`/shops/${shopId}/preview`}
            state={{ from: 'dashboard' }}
            onClick={() => setOpen(false)}
          >
            Preview shop
          </Link>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Item } from '../api/types'

interface Props {
  item: Item
  shopId: number
  onToggleEnabled: () => void
  onArchiveRequest: () => void
}

// Consolidates the per-item Edit/Hide-Show/Archive actions behind a single
// "⋮" trigger — the first anchored popover in this app (no floating-UI
// dependency, kept deliberately simple: fixed `right: 0` anchor, no flip/
// collision detection). Archive itself just requests the confirmation
// modal (ArchiveItemModal) rather than acting directly — everything else
// here is a single click.
export function ItemActionsMenu({ item, shopId, onToggleEnabled, onArchiveRequest }: Props) {
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
    <div className="item-actions-menu" ref={ref}>
      <button
        type="button"
        className="kebab-btn"
        aria-label={`More actions for ${item.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <div className="item-actions-dropdown" role="menu">
          <Link role="menuitem" to={`/shops/${shopId}/items/${item.id}/edit`} onClick={() => setOpen(false)}>
            Edit
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              onToggleEnabled()
            }}
          >
            {item.enabled ? 'Hide' : 'Show'}
          </button>
          <button
            role="menuitem"
            type="button"
            className="menu-item-danger"
            onClick={() => {
              setOpen(false)
              onArchiveRequest()
            }}
          >
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

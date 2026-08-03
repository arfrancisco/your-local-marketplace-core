import { useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Item } from '../api/types'

interface Props {
  item: Item
  onClose: () => void
  onArchived: (item: Item) => void
}

// Archive isn't obviously reversible from its name alone, so this spells
// out the actual effect before it happens, and gates it behind an explicit
// confirm — same bare confirm/cancel shape as ShopDashboardPage's "Close
// your shop?" modal, plus CancelOrderModal's async submit/error handling.
export function ArchiveItemModal({ item, onClose, onArchived }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.archiveItem(item.id)
      onArchived(res.item)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not archive item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Archive ${item.name}?`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Archive '{item.name}'?</h2>
        <p className="muted">
          This hides it from customers and removes it from your active Inventory list. It's not
          deleted — bring it back anytime from the Archived items tab.
        </p>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row gap modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="button-danger" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}

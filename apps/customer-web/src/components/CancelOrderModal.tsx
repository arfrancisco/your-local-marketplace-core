import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { CancellationReasonCode, Order } from '../api/types'

// Matches Order::CUSTOMER_CANCELLATION_REASONS on the backend (app/models/order.rb)
// — kept in sync by hand, same convention as FulfillmentMethod/OrderStatus in
// api/types.ts rather than fetched from an endpoint, since this is a short,
// rarely-changing list.
const REASONS: { value: CancellationReasonCode; label: string }[] = [
  { value: 'changed_mind', label: 'I changed my mind' },
  { value: 'found_elsewhere', label: 'Found a better price or option elsewhere' },
  { value: 'taking_too_long', label: "It's taking too long" },
  { value: 'ordered_by_mistake', label: 'I ordered by mistake' },
  { value: 'other', label: 'Other' },
]

interface Props {
  orderId: number
  onClose: () => void
  onCancelled: (order: Order) => void
}

// Required reason picker before a cancellation goes through — the API
// rejects a cancellation with no reason_code, and rejects "other" with no
// free-text reason, so this form mirrors both requirements client-side too.
export function CancelOrderModal({ orderId, onClose, onCancelled }: Props) {
  const [reasonCode, setReasonCode] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsFreeText = reasonCode === 'other'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.cancelOrder(orderId, { reason_code: reasonCode, reason: reason.trim() || undefined })
      onCancelled(res.order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Cancel order" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <form onSubmit={onSubmit}>
          <h2>Cancel this order?</h2>
          <p className="muted">Let the vendor know why — this also helps us improve.</p>
          <label>
            Reason
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} required>
              <option value="" disabled>Select a reason</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          {needsFreeText && (
            <label>
              Tell us more
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </label>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={submitting || !reasonCode || (needsFreeText && !reason.trim())}>
            {submitting ? 'Cancelling…' : 'Cancel order'}
          </button>
        </form>
      </div>
    </div>
  )
}

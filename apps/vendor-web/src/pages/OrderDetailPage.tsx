import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import { OrderChat } from '../OrderChat'
import { CancelOrderModal } from '../components/CancelOrderModal'
import { EditItemsPanel } from '../components/EditItemsPanel'
import type { Order, OrderStatus, Photo, VendorCustomerNote } from '../api/types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Click a QR/opening-message photo to view it full-size and save it. The
// download attribute doesn't force a save cross-origin (browser security),
// so "open full size" + right-click/long-press-to-save is the reliable path.
function PhotoLightbox({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  if (!photo) return null
  const url = `${API_ORIGIN}${photo.url}`
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <img className="modal-image" src={url} alt={photo.filename} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="button">
          Open full size (save from here)
        </a>
      </div>
    </div>
  )
}

// Private notes this vendor has written about the customer on this order,
// across all of their orders — not just this one. Nothing here is ever shown
// to the customer or to any other vendor; the API scopes reads to the
// signed-in vendor. The caption below says so explicitly, because a vendor
// typing "suspected scam attempt" needs zero ambiguity about who can read it.
function CustomerNotes({ customerProfileId, orderId }: { customerProfileId: number; orderId: number }) {
  const [notes, setNotes] = useState<VendorCustomerNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listCustomerNotes(customerProfileId)
      .then((res) => {
        if (active) setNotes(res.customer_notes)
      })
      .catch(() => {
        if (active) setError('Could not load your notes')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [customerProfileId])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setError(null)
    setSaving(true)
    try {
      const res = await api.createCustomerNote(orderId, draft.trim(), flagged)
      setNotes((prev) => [res.customer_note, ...prev])
      setDraft('')
      setFlagged(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: number) {
    setError(null)
    try {
      await api.deleteCustomerNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete note')
    }
  }

  return (
    <section className="card">
      <h2>Private notes about this customer</h2>
      <p className="muted">
        Only visible to you — never shown to the customer or other vendors.
      </p>

      {loading ? (
        <p className="muted">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="list">
          {notes.map((n) => (
            <li key={n.id}>
              {n.flagged && <strong>⚑ Flagged </strong>}
              {n.note}
              <span className="muted"> — {new Date(n.created_at).toLocaleDateString()}</span>
              <button type="button" onClick={() => onDelete(n.id)} aria-label={`Delete note ${n.id}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd}>
        <label htmlFor="customer-note">Add a private note</label>
        <textarea
          id="customer-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. No-showed for pickup."
        />
        <label>
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
          Flag as problem customer
        </label>
        <button type="submit" disabled={saving || !draft.trim()}>
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </form>

      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}

// Matches Orders::EditItems::EDITABLE_STATUSES on the API — once the vendor
// has committed to a fulfillment path or the order is terminal, edits are
// no longer allowed.
const ITEM_EDITABLE_STATUSES: OrderStatus[] = ['placed', 'accepted', 'preparing']

const TRANSITION_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accept',
  preparing: 'Start preparing',
  ready_for_pickup: 'Mark ready for pickup',
  out_for_delivery: 'Send out for delivery',
  completed: 'Mark completed',
  rejected: 'Reject',
  cancelled: 'Cancel order',
}

// Order status only ever changes via one of these explicit buttons — never
// inferred from anything said in chat below (ADR 0009).
export function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [editingItems, setEditingItems] = useState(false)

  useEffect(() => {
    api.getOrder(orderId).then((res) => setOrder(res.order)).finally(() => setLoading(false))
  }, [orderId])

  async function onTransition(toStatus: OrderStatus) {
    if (toStatus === 'cancelled') {
      setShowCancelModal(true)
      return
    }
    setError(null)
    setTransitioning(true)
    try {
      const res = await api.transitionOrder(orderId, toStatus)
      setOrder(res.order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update order')
    } finally {
      setTransitioning(false)
    }
  }

  async function onMarkPaid() {
    setError(null)
    setMarkingPaid(true)
    try {
      const res = await api.markOrderPaid(orderId)
      setOrder(res.order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update order')
    } finally {
      setMarkingPaid(false)
    }
  }

  if (loading) return <p>Loading order…</p>
  if (!order || !user) return <p>Order not found.</p>

  return (
    <div>
      <div className="row spread">
        <h1>{order.public_reference}</h1>
        <Link to="/orders">Back to orders</Link>
      </div>

      <div className="card">
        <p className="tagline">{order.status.replace(/_/g, ' ')}</p>
        <ul className="list">
          {order.items.map((line) => (
            <li key={line.id}>
              {line.quantity}× {line.name} — {formatPrice(line.line_total_cents, order.currency)}
            </li>
          ))}
        </ul>
        <p>Total: {formatPrice(order.total_cents, order.currency)}</p>
        <p className="muted">Fulfillment: {order.fulfillment_method}</p>
        <div className="row gap">
          <p className="muted">Payment: {order.payment_status.replace('_', ' ')}</p>
          {order.payment_status === 'unpaid' && (
            <button onClick={onMarkPaid} disabled={markingPaid}>
              {markingPaid ? 'Marking…' : 'Mark as paid'}
            </button>
          )}
        </div>

        <div className="row gap">
          {order.can_transition_to.map((status) => (
            <button key={status} disabled={transitioning} onClick={() => onTransition(status)}>
              {TRANSITION_LABELS[status]}
            </button>
          ))}
          {ITEM_EDITABLE_STATUSES.includes(order.status) && !editingItems && (
            <button onClick={() => setEditingItems(true)}>Edit items</button>
          )}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
      </div>

      {editingItems && (
        <EditItemsPanel
          order={order}
          onClose={() => setEditingItems(false)}
          onSaved={(updated) => {
            setOrder(updated)
            setEditingItems(false)
          }}
        />
      )}

      {(order.opening_message || order.opening_message_photos.length > 0) && (
        <div className="card opening-message">
          {order.opening_message && <p className="opening-message-text">{order.opening_message}</p>}
          {order.opening_message_photos.length > 0 && (
            <div className="thumbs">
              {order.opening_message_photos.map((p) => (
                <button key={p.id} className="thumb-btn" onClick={() => setViewingPhoto(p)} aria-label={`View ${p.filename} larger`}>
                  <img src={`${API_ORIGIN}${p.url}`} alt={p.filename} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <CustomerNotes customerProfileId={order.customer_profile_id} orderId={order.id} />

      <h2>Chat</h2>
      <OrderChat orderId={order.id} currentUserId={user.id} />

      <PhotoLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />

      {showCancelModal && (
        <CancelOrderModal
          orderId={order.id}
          onClose={() => setShowCancelModal(false)}
          onCancelled={(updated) => {
            setOrder(updated)
            setShowCancelModal(false)
          }}
        />
      )}
    </div>
  )
}

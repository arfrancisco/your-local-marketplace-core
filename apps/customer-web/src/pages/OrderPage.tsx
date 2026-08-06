import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import { OrderChat } from '../OrderChat'
import { Stars, RatingSummary } from '../components/Ratings'
import { CancelOrderModal } from '../components/CancelOrderModal'
import { OrderDetailActionsMenu } from '../components/OrderDetailActionsMenu'
import { OrderStatusStepper } from '../components/OrderStatusStepper'
import { colorFor, emojiFor } from '../visuals'
import type { Order, Photo } from '../api/types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Click a QR/opening-message photo to view it full-size and save it for use
// in a banking app. The download attribute doesn't force a save cross-origin
// (browser security), so "open full size" + right-click/long-press-to-save
// is the reliable path instead.
function PhotoLightbox({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  if (!photo) return null
  const url = `${API_ORIGIN}${photo.url}`
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <img className="gallery-main" src={url} alt={photo.filename} style={{ objectFit: 'contain', background: '#f5efe2' }} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="link-button" style={{ marginTop: '0.75rem' }}>
          Open full size (save from here)
        </a>
      </div>
    </div>
  )
}

// Rating is only offered once the order is completed, and only once — the API
// enforces both, this just keeps the form from showing when it can't succeed.
function RateOrderCard({ order, onRated }: { order: Order; onRated: (updated: Order) => void }) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (order.status !== 'completed') return null

  if (order.rating) {
    return (
      <div className="card">
        <h2 className="section">Your rating</h2>
        <Stars score={order.rating.score} />
        {order.rating.comment && <p>{order.rating.comment}</p>}
        <p className="muted small">You rated this order.</p>
      </div>
    )
  }

  async function onSubmit() {
    if (score < 1) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.rateOrder(order.id, score, comment.trim() || undefined)
      onRated({ ...order, rating: res.rating })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your rating')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 className="section">Rate this order</h2>
      <div className="row gap star-picker">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className="star-btn"
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            aria-pressed={score === value}
            onClick={() => setScore(value)}
          >
            {value <= score ? '★' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd like to say about this order? (optional)"
        aria-label="Review comment"
        rows={3}
      />
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={onSubmit} disabled={submitting || score < 1}>
        {submitting ? 'Submitting…' : 'Submit rating'}
      </button>
    </div>
  )
}

// Order status only ever changes via the explicit "Cancel order" button
// below — never inferred from anything said in chat (ADR 0009).
export function OrderPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    api.getOrder(orderId).then((res) => setOrder(res.order)).finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <p>Loading order…</p>
  if (!order || !user) return <p>Order not found.</p>

  const canCancel = order.can_transition_to.includes('cancelled')

  return (
    <div>
      <div className="row spread order-page-header">
        <h1>Your order</h1>
        <Link className="button" to="/orders">← Your orders</Link>
      </div>

      <div className="card">
        <div className="order-shop-info">
          {order.shop_profile_photo ? (
            <img className="order-shop-avatar" src={`${API_ORIGIN}${order.shop_profile_photo.url}`} alt="" />
          ) : (
            <div className="order-shop-avatar tile" style={{ background: colorFor(order.shop_name) }} aria-hidden>
              {emojiFor(order.shop_name)}
            </div>
          )}
          <div>
            <span className="shop-name">{order.shop_name}</span>
            {order.shop_building && <p className="muted">{order.shop_building}</p>}
            <RatingSummary averageRating={order.shop_average_rating} ratingsCount={order.shop_ratings_count} />
          </div>
        </div>
      </div>

      <div className="card">
        <OrderStatusStepper
          status={order.status}
          fulfillmentMethod={order.fulfillment_method}
          acceptedAt={order.accepted_at}
          paymentStatus={order.payment_status}
        />
      </div>

      <h2 className="section">
        Order details <span className="muted order-reference">{order.public_reference}</span>
      </h2>
      <div className="card order-detail-section">
        {canCancel && <OrderDetailActionsMenu onCancelOrder={() => setShowCancelModal(true)} />}
        <ul className="list">
          {order.items.map((line) => (
            <li key={line.id}>
              {line.quantity}× {line.name} — {formatPrice(line.line_total_cents, order.currency)}
            </li>
          ))}
        </ul>
        <p>Total: {formatPrice(order.total_cents, order.currency)}</p>
        <p className="muted">Fulfillment: {order.fulfillment_method}</p>
      </div>

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

      <RateOrderCard order={order} onRated={setOrder} />

      <h2 className="section">Chat with the vendor</h2>
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

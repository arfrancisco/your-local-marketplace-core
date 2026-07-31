import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import { OrderChat } from '../OrderChat'
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

// Order status only ever changes via the explicit "Cancel order" button
// below — never inferred from anything said in chat (ADR 0009).
export function OrderPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null)

  useEffect(() => {
    api.getOrder(orderId).then((res) => setOrder(res.order)).finally(() => setLoading(false))
  }, [orderId])

  async function onCancel() {
    setError(null)
    setCancelling(true)
    try {
      const res = await api.cancelOrder(orderId)
      setOrder(res.order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel order')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <p>Loading order…</p>
  if (!order || !user) return <p>Order not found.</p>

  const canCancel = order.can_transition_to.includes('cancelled')

  return (
    <div>
      <div className="row spread">
        <h1>Order {order.public_reference}</h1>
        <Link to="/shops" className="muted">← All shops</Link>
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

        {canCancel && (
          <button onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        )}
        {error && <p role="alert" className="error">{error}</p>}
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

      <h2 className="section">Chat with the vendor</h2>
      <OrderChat orderId={order.id} currentUserId={user.id} />

      <PhotoLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  )
}

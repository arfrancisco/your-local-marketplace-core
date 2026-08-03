import { useState } from 'react'
import type { Item } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

interface Props {
  item: Item | null
  onClose: () => void
  // Adding to cart works whether signed in or not (a local, shop-scoped cart
  // for anonymous visitors) — only checkout itself requires an account.
  onAddToCart: (item: Item) => void
  onDecrement: (item: Item) => void
  quantity: number
}

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Same stroked arrow as the shop hero's own back button (ShopDetailPage) —
// duplicated locally rather than shared, matching this app's existing
// per-component icon convention.
function BackArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ItemDetailModal({ item, onClose, onAddToCart, onDecrement, quantity }: Props) {
  const [active, setActive] = useState(0)
  if (!item) return null

  const photos = item.photos
  const current = photos[active] ?? photos[0]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* Back button replaces the old top-right "×" — same overlaid-circle
            treatment as the shop hero's own back button, so "how do I leave
            this view" reads the same way across the app. */}
        <button className="shop-back" aria-label="Back" onClick={onClose}>
          <BackArrowIcon />
        </button>

        {/* Gallery: main image + thumbnail strip when there is more than one. */}
        {current ? (
          <img className="gallery-main" src={`${API_ORIGIN}${current.url}`} alt={item.name} />
        ) : (
          <div className="gallery-main tile" style={{ background: colorFor(item.name) }} aria-hidden>
            {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
          </div>
        )}

        {photos.length > 1 && (
          <div className="gallery-thumbs">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                className={`gallery-thumb ${i === active ? 'active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1}`}
              >
                <img src={`${API_ORIGIN}${photo.url}`} alt="" />
              </button>
            ))}
          </div>
        )}

        <div className="row spread" style={{ marginTop: '0.75rem' }}>
          <h2>{item.name}</h2>
          <strong>{formatPrice(item.price_cents, item.currency)}</strong>
        </div>
        {item.description && <p className="muted">{item.description}</p>}
        {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
        {item.sold_out && <p className="sold-out-label">Sold out</p>}

        {/* Same +/− stepper as the item cards behind this modal, bottom-right
            of the box — one control, one place to hold the count, whether
            you're scanning the menu or looking at this detail view. */}
        <div className="row end" style={{ marginTop: '0.5rem' }}>
          {item.sold_out ? (
            <button disabled>Sold out</button>
          ) : quantity === 0 ? (
            <button className="qty-btn" onClick={() => onAddToCart(item)} aria-label={`Add ${item.name} to cart`}>
              +
            </button>
          ) : (
            <div className="row gap item-stepper">
              <button className="qty-btn" onClick={() => onDecrement(item)} aria-label={`Remove one ${item.name}`}>
                −
              </button>
              <span className="item-qty">{quantity}</span>
              <button className="qty-btn" onClick={() => onAddToCart(item)} aria-label={`Add ${item.name} to cart`}>
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

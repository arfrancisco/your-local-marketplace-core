import { useState } from 'react'
import type { Item } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

interface Props {
  item: Item | null
  onClose: () => void
  onOrder: (item: Item) => void
}

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function ItemDetailModal({ item, onClose, onOrder }: Props) {
  const [active, setActive] = useState(0)
  if (!item) return null

  const photos = item.photos
  const current = photos[active] ?? photos[0]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>

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

        <button style={{ marginTop: '0.5rem' }} onClick={() => onOrder(item)}>Order now</button>
      </div>
    </div>
  )
}

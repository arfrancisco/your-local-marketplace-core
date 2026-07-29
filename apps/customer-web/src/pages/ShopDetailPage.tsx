import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Item, Shop } from '../api/types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function ShopDetailPage() {
  const { slug } = useParams()
  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    Promise.all([api.getShop(slug), api.listItems(slug)])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        setItems(itemsRes.items)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p>Loading…</p>
  if (notFound || !shop) return <p>This shop is not available.</p>

  return (
    <div>
      <Link to="/shops" className="muted">← All shops</Link>
      <h1>{shop.name}</h1>
      {shop.description && <p className="muted">{shop.description}</p>}
      <p className="tagline">
        {shop.fulfillment_methods.join(' · ')}
        {shop.address ? ` · ${shop.address}` : ''}
      </p>

      <h2 className="section">Menu</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className="card row spread">
            <div>
              <h3>{item.name}</h3>
              {item.description && <p className="muted">{item.description}</p>}
              {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
            </div>
            <div className="price-col">
              {item.photos[0] && (
                <img className="thumb" src={`${API_ORIGIN}${item.photos[0].url}`} alt={item.name} />
              )}
              <strong>{formatPrice(item.price_cents, item.currency)}</strong>
            </div>
          </li>
        ))}
      </ul>

      {/* Ordering arrives in M3; discovery is browse-only for now. */}
      <p className="muted small">Ordering is coming soon.</p>
    </div>
  )
}

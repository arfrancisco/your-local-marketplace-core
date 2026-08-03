import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Item, Rating, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { RatingList, RatingSummary } from '../components/Ratings'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Read-only mirror of customer-web's ShopDetailPage — same cover-photo hero,
// identity card, and item list markup, so a vendor sees the actual page a
// customer would land on before they ever open their shop. No cart/checkout/
// add-to-cart here on purpose: this is a look, not a transaction. A duplicate
// implementation rather than a shared import (ADR 0001 — no shared package
// between apps).
export function ShopPreviewPage() {
  const { id } = useParams()
  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([api.getShop(Number(id)), api.listItems(Number(id))])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        // Disabled items never reach a customer at all — only sold-out items
        // (still listed, just greyed out) do. Filtering here, not on the
        // server, since this same list endpoint is also the vendor's own
        // inventory-management view (ItemsPage), where disabled items must
        // stay visible so they can be re-enabled.
        setItems(itemsRes.items.filter((item) => item.enabled))
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!shop?.slug) return
    api.listShopRatings(shop.slug).then((res) => setRatings(res.ratings)).catch(() => setRatings([]))
  }, [shop?.slug])

  if (loading) return <p>Loading preview…</p>
  if (!shop) return <p>This shop is not available.</p>

  const fallbackKey = `${shop.name} ${shop.description ?? ''}`

  return (
    <div>
      <p className="back-link">
        <Link to="/shops">← Back to dashboard</Link>
      </p>
      <div className="preview-banner">
        This is a preview of your shop's page — it's exactly what a customer
        sees, minus the ability to order.
      </div>

      <div className="shop-hero">
        {shop.cover_photo ? (
          <img className="shop-cover" src={`${API_ORIGIN}${shop.cover_photo.url}`} alt="" />
        ) : (
          <div className="shop-cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
            {emojiFor(fallbackKey)}
          </div>
        )}
        <span className="shop-back" aria-hidden>←</span>
        <div className="card shop-identity">
          {shop.profile_photo ? (
            <img className="shop-avatar" src={`${API_ORIGIN}${shop.profile_photo.url}`} alt="" />
          ) : (
            <div className="shop-avatar tile" style={{ background: colorFor(shop.name) }} aria-hidden>
              {emojiFor(fallbackKey)}
            </div>
          )}
          <div className="shop-identity-text">
            <h1>{shop.name}</h1>
            <p className="tagline">
              {shop.fulfillment_methods.join(' · ')}
              {shop.address ? ` · ${shop.address}` : ''}
            </p>
            {shop.ratings_count > 0 && (
              <RatingSummary averageRating={shop.average_rating} ratingsCount={shop.ratings_count} />
            )}
          </div>
        </div>
      </div>

      {shop.description && <p className="muted">{shop.description}</p>}

      <h2 className="section">Menu</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={`card row spread ${item.sold_out ? 'dimmed' : ''}`}>
            <div className="item-main">
              {item.photos[0] ? (
                <img className="thumb" src={`${API_ORIGIN}${item.photos[0].url}`} alt={item.name} />
              ) : (
                <div className="thumb tile" style={{ background: colorFor(item.name) }} aria-hidden>
                  {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
                </div>
              )}
              <div>
                <h3>{item.name}</h3>
                {item.description && <p className="muted">{item.description}</p>}
                {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
                {item.sold_out && <p className="sold-out-label">Sold out</p>}
              </div>
            </div>
            <div className="price-col">
              <strong>{formatPrice(item.price_cents, item.currency)}</strong>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="section">Reviews</h2>
      <p>
        <RatingSummary
          averageRating={shop.average_rating}
          ratingsCount={shop.ratings_count}
          emptyLabel="No reviews yet."
        />
      </p>
      {ratings.length > 0 && <RatingList ratings={ratings} />}
    </div>
  )
}

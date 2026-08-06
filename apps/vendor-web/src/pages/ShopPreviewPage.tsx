import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Item, Rating, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { RatingList, RatingSummary } from '../components/Ratings'
import { TourCallout } from '../components/TourCallout'
import { HelpTourButton } from '../components/HelpTourButton'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')
const REVIEWS_PER_PAGE = 5

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Matches customer-web's own BackArrowIcon — a real stroked icon reads as a
// tappable button against a photo; the Unicode "←" glyph was too thin.
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

// Read-only mirror of customer-web's ShopDetailPage — same cover-photo hero,
// identity card, and item list markup, so a vendor sees the actual page a
// customer would land on before they ever open their shop. No cart/checkout/
// add-to-cart here on purpose: this is a look, not a transaction. A duplicate
// implementation rather than a shared import (ADR 0001 — no shared package
// between apps).
export function ShopPreviewPage() {
  const { id } = useParams()
  const location = useLocation()
  // Where "Preview shop" was clicked from — the dashboard's kebab menu and
  // the edit form's own "Preview shop" link both lead here, and the useful
  // back target is different for each. Defaults to the edit form (also
  // covers a direct URL visit/refresh, where there's no real "from" at all).
  const from = (location.state as { from?: 'dashboard' | 'edit' } | null)?.from ?? 'edit'
  const [tourOpen, setTourOpen] = useState(false)
  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  // Collapsed by default, paginated once opened — matches customer-web's own
  // ShopDetailPage exactly, since the whole point of this page is to be
  // what a customer actually sees.
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsPage, setReviewsPage] = useState(0)

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
    if (!shop?.slug || !reviewsOpen) return
    setReviewsLoading(true)
    api
      .listShopRatings(shop.slug, { limit: REVIEWS_PER_PAGE, offset: reviewsPage * REVIEWS_PER_PAGE })
      .then((res) => setRatings(res.ratings))
      .catch(() => setRatings([]))
      .finally(() => setReviewsLoading(false))
  }, [shop?.slug, reviewsOpen, reviewsPage])

  if (loading) return <p>Loading preview…</p>
  if (!shop) return <p>This shop is not available.</p>

  const fallbackKey = `${shop.name} ${shop.description ?? ''}`
  const totalReviewPages = Math.max(1, Math.ceil(shop.ratings_count / REVIEWS_PER_PAGE))

  return (
    <div>
      <HelpTourButton onClick={() => setTourOpen(true)} label="Tour this preview" />
      <p className="back-link">
        {from === 'dashboard' ? (
          <Link className="button" to="/shops">← Back to dashboard</Link>
        ) : (
          <Link className="button" to={`/shops/${id}/edit`}>← Back to editing</Link>
        )}
      </p>
      <div className="preview-banner">
        This is a preview of your shop's page — it's exactly what a customer
        sees, minus the ability to order.
      </div>

      {shop.demo && (
        <p className="demo-shop-banner" role="alert">
          This is a demo shop for previewing the app. Orders placed here are
          not real and will not be prepared or delivered.
        </p>
      )}

      <div className="shop-hero tour-anchor">
        {shop.cover_photo ? (
          <img className="shop-cover" src={`${API_ORIGIN}${shop.cover_photo.url}`} alt="" />
        ) : (
          <div className="shop-cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
            {emojiFor(fallbackKey)}
          </div>
        )}
        <span className="shop-back" aria-hidden>
          <BackArrowIcon />
        </span>
        <div className="shop-identity">
          {shop.profile_photo ? (
            <img className="shop-avatar" src={`${API_ORIGIN}${shop.profile_photo.url}`} alt="" />
          ) : (
            <div className="shop-avatar tile" style={{ background: colorFor(shop.name) }} aria-hidden>
              {emojiFor(fallbackKey)}
            </div>
          )}
          <div className="shop-identity-text">
            <div className="shop-card-top">
              <h1>{shop.name}</h1>
              {shop.ratings_count > 0 && (
                <RatingSummary averageRating={shop.average_rating} ratingsCount={shop.ratings_count} />
              )}
            </div>
            {shop.description && <p className="muted shop-description">{shop.description}</p>}
            <p className="tagline">
              {shop.fulfillment_methods.join(' · ')}
              {shop.building ? ` · ${shop.building}` : ''}
            </p>
            {shop.verified && (
              <div className="shop-card-badges">
                <span className="verified-tag">Verified</span>
              </div>
            )}
          </div>
        </div>
        {tourOpen && (
          <TourCallout
            message="This is exactly what a customer sees when they find your shop."
            onNext={() => setTourOpen(false)}
            onSkip={() => setTourOpen(false)}
          />
        )}
      </div>

      <h2 className="section">Catalog</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={`card row spread item-row ${item.sold_out ? 'dimmed' : ''}`}>
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

      <div className="row spread reviews-header">
        <h2 className="section">Reviews</h2>
        <RatingSummary
          averageRating={shop.average_rating}
          ratingsCount={shop.ratings_count}
          emptyLabel="No reviews yet."
        />
      </div>

      {shop.ratings_count > 0 && (
        <button
          type="button"
          className="reviews-toggle"
          onClick={() => setReviewsOpen((open) => !open)}
          aria-expanded={reviewsOpen}
        >
          {reviewsOpen ? 'Hide reviews' : `Show reviews (${shop.ratings_count})`}
        </button>
      )}

      {reviewsOpen && (
        <>
          {reviewsLoading ? <p className="muted">Loading reviews…</p> : <RatingList ratings={ratings} />}

          {totalReviewPages > 1 && (
            <div className="row spread reviews-pagination">
              <button type="button" onClick={() => setReviewsPage((p) => p - 1)} disabled={reviewsPage === 0}>
                ← Newer
              </button>
              <span className="muted small">
                Page {reviewsPage + 1} of {totalReviewPages}
              </span>
              <button
                type="button"
                onClick={() => setReviewsPage((p) => p + 1)}
                disabled={reviewsPage >= totalReviewPages - 1}
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

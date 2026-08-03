import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { useCart } from '../CartContext'
import type { Item, Rating, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { RatingList, RatingSummary } from '../components/Ratings'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')
const REVIEWS_PER_PAGE = 5

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// A left-chevron with a real, adjustable stroke — the Unicode "←" glyph reads
// as too thin/faint sitting on a photo to register as a tappable back button.
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

// Cover photo + identity panel read as one continuous card (overflow: hidden
// on the shared .shop-hero wrapper clips both to one rounded rectangle, no
// gap, no floating-card overlap) — the back button sits directly on the
// photo, and everything else (name, description, tagline, rating) sits below
// it on a plain opaque background. That's the actual fix for "hard to read":
// a contrast problem, not a font-size one. Only `building` (e.g. "Tower B")
// is shown here, never the vendor's exact unit — that stays private to the
// vendor and to an order's two participants (ShopSerializer's
// include_payment_info gate on the API).
function ShopHero({ shop }: { shop: Shop }) {
  const fallbackKey = `${shop.name} ${shop.description ?? ''}`

  return (
    <div className="shop-hero">
      {shop.cover_photo ? (
        <img className="shop-cover" src={`${API_ORIGIN}${shop.cover_photo.url}`} alt="" />
      ) : (
        <div className="shop-cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
          {emojiFor(fallbackKey)}
        </div>
      )}

      <Link to="/shops" className="shop-back" aria-label="Back to all shops">
        <BackArrowIcon />
      </Link>

      <div className="shop-identity">
        {shop.profile_photo ? (
          <img className="shop-avatar" src={`${API_ORIGIN}${shop.profile_photo.url}`} alt="" />
        ) : (
          <div className="shop-avatar tile" style={{ background: colorFor(shop.name) }} aria-hidden>
            {emojiFor(fallbackKey)}
          </div>
        )}
        <div className="shop-identity-text">
          <h1>{shop.name}</h1>
          {shop.description && <p className="muted shop-description">{shop.description}</p>}
          <p className="tagline">
            {shop.fulfillment_methods.join(' · ')}
            {shop.building ? ` · ${shop.building}` : ''}
          </p>
          {/* Standing at a glance next to the name; the empty case is covered by
              the Reviews section below, so nothing renders here when unrated. */}
          {shop.ratings_count > 0 && (
            <RatingSummary averageRating={shop.average_rating} ratingsCount={shop.ratings_count} />
          )}
        </div>
      </div>
    </div>
  )
}

// Adding to cart works for anonymous visitors too (a local, shop-scoped cart —
// see guestCart.ts) so browsing stays forgiving; only checkout requires a real
// account, since the backend Cart/CartItem (ADR 0008) requires a
// customer_profile. Signing in merges the local cart into the real one. All of
// that now lives in CartContext — this page loads the shop and its items, then
// hands them to the cart provider and reads quantities back out of it.
export function ShopDetailPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const { loadShopCart, addToCart, changeQuantity, quantityOf } = useCart()

  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [viewingItem, setViewingItem] = useState<Item | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  // Collapsed by default — a shop with dozens of reviews shouldn't dump them
  // all onto the page before anyone's asked to see them.
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsPage, setReviewsPage] = useState(0)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([api.getShop(slug), api.listItems(slug)])
      .then(async ([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        setItems(itemsRes.items)
        await loadShopCart(shopRes.shop, itemsRes.items)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    // loadShopCart is recreated every render (plain function on the provider),
    // so it is deliberately not a dependency — the shop/user pair is what
    // should re-trigger a load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user])

  // Reviews are public and independent of the cart flow, so they load on
  // their own — a failure here should leave the shop itself perfectly
  // usable. Nothing fetches until the accordion is actually opened: the
  // summary line above (average/count) rides on the Shop payload already,
  // so there's no reason to pull the full list before anyone's asked for it.
  useEffect(() => {
    if (!slug || !reviewsOpen) return
    setReviewsLoading(true)
    api
      .listShopRatings(slug, { limit: REVIEWS_PER_PAGE, offset: reviewsPage * REVIEWS_PER_PAGE })
      .then((res) => setRatings(res.ratings))
      .catch(() => setRatings([]))
      .finally(() => setReviewsLoading(false))
  }, [slug, reviewsOpen, reviewsPage])

  if (loading) return <p>Loading…</p>
  if (notFound || !shop) return <p>This shop is not available.</p>

  const totalReviewPages = Math.max(1, Math.ceil(shop.ratings_count / REVIEWS_PER_PAGE))

  return (
    <div>
      <ShopHero shop={shop} />

      <h2 className="section">Menu</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => {
          const quantity = quantityOf(item.id)
          return (
            <li key={item.id} className={`card row spread item-row ${item.sold_out ? 'dimmed' : ''}`}>
              <button className="item-main clickable" onClick={() => setViewingItem(item)} aria-label={`View ${item.name}`}>
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
              </button>
              <div className="price-col">
                <strong>{formatPrice(item.price_cents, item.currency)}</strong>
                {item.sold_out ? (
                  <button disabled>Sold out</button>
                ) : quantity === 0 ? (
                  <button
                    className="qty-btn"
                    onClick={() => addToCart(item)}
                    aria-label={`Add ${item.name} to cart`}
                  >
                    +
                  </button>
                ) : (
                  // Inline stepper, so adjusting a quantity no longer means
                  // opening the cart first.
                  <div className="row gap item-stepper">
                    <button
                      className="qty-btn"
                      onClick={() => changeQuantity(item.id, quantity - 1)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      −
                    </button>
                    <span className="item-qty">{quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => addToCart(item)}
                      aria-label={`Add ${item.name} to cart`}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
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

          {/* Most-recent-first (the API's own default order) — paging further
              back is "older", not "more". */}
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

      <ItemDetailModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onAddToCart={addToCart}
      />
    </div>
  )
}

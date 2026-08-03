import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

// Matches vendor-web's inventory icons in spirit: a plain stroked SVG, not
// an icon-font/library, consistent with the rest of this app's zero-icon-
// dependency approach.
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="search-icon">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// A brand-new vendor's shop having no priced items yet is common enough
// (before their first item is added) that this needs to be silent, not "₱0".
function formatPriceRange(range: Shop['price_range_cents']) {
  if (!range) return null
  const min = Math.round(range.min / 100)
  const max = Math.round(range.max / 100)
  return min === max ? `₱${min}` : `₱${min}–${max}`
}

// Compact "★ 4.5" for the row's stat line — the fuller "★ 4.5 · 12 reviews"
// treatment (RatingSummary, still used on the shop detail page) reads as too
// busy sitting alongside price range and order count on one line here.
function compactRating(shop: Shop) {
  if (shop.ratings_count === 0 || shop.average_rating === null) return null
  return `★ ${shop.average_rating.toFixed(1)}`
}

// Popularity signal, not a raw order count — and only once there's enough
// of a track record for it to mean something (fewer than 5 completed
// orders reads as more of an awkward confession than a selling point).
const MIN_ORDERS_TO_SHOW = 5

function shopStats(shop: Shop): string[] {
  return [
    formatPriceRange(shop.price_range_cents),
    compactRating(shop),
    shop.completed_orders_count >= MIN_ORDERS_TO_SHOW ? `${shop.completed_orders_count} orders` : null,
  ].filter((stat): stat is string => stat !== null)
}

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')
const SEARCH_DEBOUNCE_MS = 300
// A single-letter query is rarely meaningful and fires a request per
// keystroke for no benefit — wait for at least 2 letters (or an empty box,
// back to browsing everything) before hitting the API. Also the natural
// floor for a future autocomplete/suggestions feature over this same box.
const MIN_QUERY_LENGTH = 2
// How many shops the swipeable strip shows. No second request: `GET /shops`
// already comes back in a deterministic daily rotation (ADR 0007), so the
// front of the same response is a fair "today's picks" without any
// client-side shuffling of its own.
const CAROUSEL_SIZE = 8

// Square identity thumbnail, or the deterministic emoji/colour tile when the
// vendor hasn't uploaded a profile photo. Same fallback treatment used for
// items elsewhere in the app, just at whatever size the caller's class sets.
function ShopThumb({ shop, className }: { shop: Shop; className: string }) {
  if (shop.profile_photo) {
    // alt="" on purpose: the shop name is right next to it in the same link,
    // so a real alt would just make a screen reader say the name twice.
    return <img className={className} src={`${API_ORIGIN}${shop.profile_photo.url}`} alt="" />
  }
  return (
    <div className={`${className} tile`} style={{ background: colorFor(shop.name) }} aria-hidden>
      {emojiFor(`${shop.name} ${shop.description ?? ''}`)}
    </div>
  )
}

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounced: search matches shop name/description or any item name/tag in
  // its catalog (not distance — there is no geo discovery, ADR 0002), so
  // typing "bread" or "vegan" can surface a shop whose own name doesn't say it.
  const trimmedQuery = query.trim()
  const queryTooShort = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH

  useEffect(() => {
    // A 1-2 letter query doesn't search at all yet — leave whatever's on
    // screen alone rather than re-fetching (or showing "Searching…") for
    // every keystroke before there's enough to match on.
    if (queryTooShort) return

    // Set immediately (not inside the timeout) so the stale previous result
    // set — and any "no matches" message it produced — never displays during
    // the debounce window as if it already answered the new query.
    setLoading(true)
    const timeout = setTimeout(() => {
      api
        .listShops(trimmedQuery || undefined)
        .then((res) => setShops(res.shops))
        .catch(() => setError('Could not load shops'))
        .finally(() => setLoading(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [trimmedQuery, queryTooShort])

  if (error) return <p className="error">{error}</p>

  // The carousel is a browsing aid, so it only makes sense while browsing —
  // once someone searches, the results list below is the answer and a strip
  // repeating its first few entries is pure noise.
  const carouselShops = trimmedQuery ? [] : shops.slice(0, CAROUSEL_SIZE)
  const listLabel = trimmedQuery ? 'Search results' : 'All shops'

  return (
    <div>
      <div className="hero">
        <h1>What's cooking today</h1>
        <p className="muted">Fresh from the people next door.</p>
      </div>

      <div className="search-bar">
        <SearchIcon />
        <input
          type="search"
          placeholder="What are you craving?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search shops"
          className="search-box"
        />
      </div>

      {!queryTooShort && loading && <p className="muted">Searching…</p>}

      {!queryTooShort && !loading && shops.length === 0 && (
        <p>
          {trimmedQuery
            ? `No shops match "${trimmedQuery}". Try a different dish or ingredient.`
            : 'No shops are open right now. Check back later.'}
        </p>
      )}

      {carouselShops.length > 0 && (
        <section className="shop-section">
          <h2 className="shop-section-heading">Today's picks</h2>
          {/* Swipe sideways. Plain CSS scroll-snap, no carousel library. */}
          <ul className="shop-carousel" aria-label="Today's picks">
            {carouselShops.map((shop) => (
              <li key={shop.id} className="shop-carousel-card">
                <Link to={`/shops/${shop.slug}`} className="shop-carousel-link">
                  <ShopThumb shop={shop} className="shop-carousel-thumb" />
                  <span className="shop-carousel-name">{shop.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shops.length > 0 && (
        <section className="shop-section">
          <h2 className="shop-section-heading">{listLabel}</h2>
          <ul className="shop-rows" aria-label={listLabel}>
            {shops.map((shop) => (
              <li key={shop.id} className="shop-row">
                <Link to={`/shops/${shop.slug}`} className="shop-row-link">
                  <ShopThumb shop={shop} className="shop-row-thumb" />
                  <div className="shop-row-body">
                    <h3 className="shop-row-name">{shop.name}</h3>
                    <p className="tagline shop-row-tagline">
                      {shop.fulfillment_methods.join(' · ') || 'pickup'}
                    </p>
                    {/* Any of the three can be absent (no priced items yet, no
                        ratings yet, too few completed orders) — only render
                        the line at all once there's at least one to show. */}
                    {shopStats(shop).length > 0 && (
                      <p className="shop-row-stats">{shopStats(shop).join(' · ')}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

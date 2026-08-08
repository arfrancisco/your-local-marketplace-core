import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { useAuth } from '../auth'
import { useBecomeVendor } from '../useBecomeVendor'
import { BecomeVendorEmailModal } from '../components/BecomeVendorEmailModal'

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

// Popularity signal, not a raw order count — rounded down to the nearest
// ten ("23 completed orders" reads like a precise, checkable claim; "20+"
// reads as an approximate signal, which is what this is actually for) and
// only shown once there's a first tier to report at all.
const ORDER_COUNT_TIER = 10

function formatOrderCount(count: number) {
  if (count < ORDER_COUNT_TIER) return null
  const tier = Math.floor(count / ORDER_COUNT_TIER) * ORDER_COUNT_TIER
  return `${tier}+ orders`
}

function priceAndOrderStats(shop: Shop): string[] {
  return [formatPriceRange(shop.price_range_cents), formatOrderCount(shop.completed_orders_count)].filter(
    (stat): stat is string => stat !== null,
  )
}

// Price/order count only — the star rating moved up into the card's header
// row (top-right, next to the name), so it's no longer part of this line.
function ShopStatsLine({ shop }: { shop: Shop }) {
  const stats = priceAndOrderStats(shop)
  if (stats.length === 0) return null
  return <p className="shop-row-stats">{stats.join(' · ')}</p>
}

// Demo/Verified pills, together at the bottom of the card rather than
// crowding the name — keeps the header row (name + rating) short enough to
// never need to fight a long shop name for space (see the clipping bug this
// replaced), and reads more like a footnote than an interruption.
function ShopBadges({ shop }: { shop: Shop }) {
  if (!shop.demo && !shop.verified) return null
  return (
    <div className="shop-card-badges">
      {shop.demo && <span className="demo-tag">Demo</span>}
      {shop.verified && <span className="verified-tag">Verified</span>}
    </div>
  )
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
// One shop card fills the strip at a time; this is how long it sits before
// auto-advancing to the next.
const CAROUSEL_AUTO_ADVANCE_MS = 5000

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

// Wide cover photo (not the square profile thumbnail) for the spotlight
// carousel's big card, same fallback tile treatment as ShopThumb.
function ShopCover({ shop, className }: { shop: Shop; className: string }) {
  if (shop.cover_photo) {
    return <img className={className} src={`${API_ORIGIN}${shop.cover_photo.url}`} alt="" />
  }
  return (
    <div className={`${className} tile`} style={{ background: colorFor(shop.name) }} aria-hidden>
      {emojiFor(`${shop.name} ${shop.description ?? ''}`)}
    </div>
  )
}

// One shop at a time, auto-advancing — a bigger, single-focus spotlight
// rather than the old multi-card peek strip. Still plain CSS scroll-snap
// underneath (no carousel library): auto-advance just scrolls the
// container to the next snap point, and a manual swipe is tracked back
// into the same index via onScroll.
export function ShopSpotlightCarousel({ shops }: { shops: Shop[] }) {
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLUListElement>(null)
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (shops.length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % shops.length), CAROUSEL_AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [shops.length])

  useEffect(() => {
    const el = trackRef.current
    // Not implemented at all in jsdom (only real browsers have it) —
    // feature-detected rather than assumed.
    if (!el || typeof el.scrollTo !== 'function') return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [index])

  useEffect(() => () => clearTimeout(scrollIdleTimer.current), [])

  // A smooth-scroll (whether from auto-advance or a tap) fires a stream of
  // scroll events at intermediate positions while it's still animating —
  // reading the index straight off any one of those mid-flight events can
  // round to the position it's animating *away from* and snap it right
  // back. Only commit once the events have paused, i.e. the scroll has
  // actually settled.
  function onTrackScroll() {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    clearTimeout(scrollIdleTimer.current)
    scrollIdleTimer.current = setTimeout(() => {
      setIndex(Math.round(el.scrollLeft / el.clientWidth))
    }, 120)
  }

  return (
    <ul className="shop-spotlight-track" aria-label="Today's picks" ref={trackRef} onScroll={onTrackScroll}>
      {shops.map((shop) => {
        const rating = compactRating(shop)
        return (
          <li key={shop.id} className="shop-spotlight-card">
            <Link to={`/shops/${shop.slug}`} className="shop-spotlight-link">
              <ShopCover shop={shop} className="shop-spotlight-cover" />
              <div className="shop-spotlight-body">
                <div className="shop-card-top">
                  <h3 className="shop-spotlight-name">{shop.name}</h3>
                  {rating && <span className="shop-rating-line">{rating}</span>}
                </div>
                {shop.description && <p className="shop-spotlight-description">{shop.description}</p>}
                <ShopStatsLine shop={shop} />
                <ShopBadges shop={shop} />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// A bigger, landing-page-specific invitation to sell — the app-wide
// BecomeVendorBanner (App.tsx) is a persistent but thin reminder shown on
// every page; this is a one-time, higher-visibility version specifically
// for the shop list, the highest-traffic page in the app and the one place
// a browsing visitor currently sees nothing about selling at all. Hidden
// entirely for an existing vendor, same condition BecomeVendorBanner uses.
function BecomeVendorCTA() {
  const { user } = useAuth()
  const { start, starting, showEmailVerifyModal, closeEmailVerifyModal } = useBecomeVendor()

  if (user?.vendor_profile) return null

  return (
    <div className="become-vendor-cta">
      <h2>Have something to sell?</h2>
      <p className="muted">Open your own shop and reach the whole community.</p>
      {user ? (
        <button type="button" onClick={start} disabled={starting}>
          {starting ? 'One moment…' : 'Become a vendor'}
        </button>
      ) : (
        <Link to="/login?mode=register" className="link-button">Create an account</Link>
      )}
      {showEmailVerifyModal && (
        <BecomeVendorEmailModal
          onClose={closeEmailVerifyModal}
          onVerified={() => {
            closeEmailVerifyModal()
            start()
          }}
        />
      )}
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

      <BecomeVendorCTA />

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
          <ShopSpotlightCarousel shops={carouselShops} />
        </section>
      )}

      {shops.length > 0 && (
        <section className="shop-section">
          <h2 className="shop-section-heading">{listLabel}</h2>
          <ul className="shop-rows" aria-label={listLabel}>
            {shops.map((shop) => {
              const rating = compactRating(shop)
              return (
                <li key={shop.id} className="shop-row">
                  <Link to={`/shops/${shop.slug}`} className="shop-row-link">
                    <ShopThumb shop={shop} className="shop-row-thumb" />
                    <div className="shop-row-body">
                      <div className="shop-card-top">
                        <h3 className="shop-row-name">{shop.name}</h3>
                        {rating && <span className="shop-rating-line">{rating}</span>}
                      </div>
                      {shop.description && <p className="shop-row-description">{shop.description}</p>}
                      {/* Any of these three can be absent (no priced items yet,
                          no ratings yet, too few completed orders) — only
                          render a line/badge row at all once there's something
                          to show on it. */}
                      <ShopStatsLine shop={shop} />
                      <ShopBadges shop={shop} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

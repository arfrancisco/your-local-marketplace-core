import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')
const SEARCH_DEBOUNCE_MS = 300
// A single-letter query is rarely meaningful and fires a request per
// keystroke for no benefit — wait for at least 2 letters (or an empty box,
// back to browsing everything) before hitting the API. Also the natural
// floor for a future autocomplete/suggestions feature over this same box.
const MIN_QUERY_LENGTH = 2

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

  return (
    <div>
      <div className="hero">
        <h1>What's cooking today</h1>
        <p className="muted">Fresh from the people next door.</p>
      </div>

      <input
        type="search"
        placeholder="What are you craving?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search shops"
        className="search-box"
      />

      {!queryTooShort && loading && <p className="muted">Searching…</p>}

      {!queryTooShort && !loading && shops.length === 0 && (
        <p>
          {trimmedQuery
            ? `No shops match "${trimmedQuery}". Try a different dish or ingredient.`
            : 'No shops are open right now. Check back later.'}
        </p>
      )}

      <ul className="grid">
        {shops.map((shop) => (
          <li key={shop.id} className="card">
            <Link to={`/shops/${shop.slug}`} className="plain">
              {shop.photos[0] ? (
                <img className="cover" src={`${API_ORIGIN}${shop.photos[0].url}`} alt={shop.name} />
              ) : (
                <div className="cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
                  {emojiFor(`${shop.name} ${shop.description ?? ''}`)}
                </div>
              )}
              <h2>{shop.name}</h2>
              {shop.description && <p className="muted">{shop.description}</p>}
              <p className="tagline">
                {shop.fulfillment_methods.join(' · ') || 'pickup'}
              </p>
              {/* Aggregate only on the card; nothing at all for an unrated shop. */}
              {shop.ratings_count > 0 && shop.average_rating !== null && (
                <p className="tagline">★ {shop.average_rating.toFixed(1)}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

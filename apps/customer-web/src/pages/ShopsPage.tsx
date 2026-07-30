import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')
const SEARCH_DEBOUNCE_MS = 300

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounced: search matches shop name/description or any item name/tag in
  // its catalog (not distance — there is no geo discovery, ADR 0002), so
  // typing "bread" or "vegan" can surface a shop whose own name doesn't say it.
  useEffect(() => {
    // Set immediately (not inside the timeout) so the stale previous result
    // set — and any "no matches" message it produced — never displays during
    // the debounce window as if it already answered the new query.
    setLoading(true)
    const timeout = setTimeout(() => {
      api
        .listShops(query.trim() || undefined)
        .then((res) => setShops(res.shops))
        .catch(() => setError('Could not load shops'))
        .finally(() => setLoading(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [query])

  if (error) return <p className="error">{error}</p>

  return (
    <div>
      <h1>Your neighbors' shops</h1>
      <p className="muted">Open now, shown in a fair daily rotation.</p>

      <input
        type="search"
        placeholder="Search shops, dishes, or tags…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search shops"
        className="search-box"
      />

      {loading && <p className="muted">Searching…</p>}

      {!loading && shops.length === 0 && (
        <p>
          {query.trim()
            ? `No shops match "${query.trim()}". Try a different dish or ingredient.`
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
              <p className="tagline">{shop.fulfillment_methods.join(' · ') || 'pickup'}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listShops()
      .then((res) => setShops(res.shops))
      .catch(() => setError('Could not load shops'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading the neighborhood…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div>
      <h1>Open shops nearby</h1>
      <p className="muted">Your neighbors, in a fair daily rotation.</p>

      {shops.length === 0 && <p>No shops are open right now. Check back later.</p>}

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

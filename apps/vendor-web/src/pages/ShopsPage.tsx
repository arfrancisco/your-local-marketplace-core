import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    api.listShops().then((res) => setShops(res.shops)).finally(() => setLoading(false))
  }, [])

  async function toggleOpen(shop: Shop) {
    setBusyId(shop.id)
    try {
      const res = shop.open ? await api.closeShop(shop.id) : await api.openShop(shop.id)
      setShops((prev) => prev.map((s) => (s.id === shop.id ? res.shop : s)))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p>Loading shops…</p>

  return (
    <div>
      <div className="row spread">
        <h1>Your shops</h1>
        <Link className="button" to="/shops/new">New shop</Link>
      </div>

      {shops.length === 0 && <p>No shops yet. Create your first one.</p>}

      <ul className="list">
        {shops.map((shop) => (
          <li key={shop.id} className="card">
            <div className="row spread">
              <div>
                <h2>{shop.name}</h2>
                <p className="muted">
                  {shop.open ? 'Open' : shop.status === 'active' ? 'Closed' : 'Draft'} ·{' '}
                  {shop.fulfillment_methods.join(', ') || 'no fulfillment'}
                </p>
              </div>
              <div className="row gap">
                <button onClick={() => toggleOpen(shop)} disabled={busyId === shop.id}>
                  {shop.open ? 'Close' : 'Open'}
                </button>
                <Link className="button" to={`/shops/${shop.id}/edit`}>Edit</Link>
                <Link className="button" to={`/shops/${shop.id}/items`}>Items</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

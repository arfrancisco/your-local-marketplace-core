import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminShop, AdminItem } from '../api/types'

export function ShopDetailPage() {
  const { id } = useParams()
  const [shop, setShop] = useState<AdminShop | null>(null)
  const [items, setItems] = useState<AdminItem[]>([])

  function refresh() {
    if (!id) return
    api.getShop(Number(id)).then((res) => setShop(res.shop))
    api.listItems({ shop_id: Number(id) }).then((res) => setItems(res.items))
  }

  useEffect(refresh, [id])

  if (!shop) return <p className="container">Loading…</p>

  return (
    <div className="container">
      <Link to="/shops">← Shops</Link>
      <h1>{shop.name}</h1>
      <p className="muted">{shop.description}</p>
      <p>
        Status: {shop.status} · Accepting orders: {shop.accepting_orders ? 'yes' : 'no'}
      </p>
      <p>
        <button onClick={() => api.updateShop(shop.id, { status: 'active' }).then(refresh)}>Set active</button>{' '}
        <button onClick={() => api.updateShop(shop.id, { status: 'suspended' }).then(refresh)}>Suspend</button>{' '}
        <button
          onClick={() => {
            if (confirm(`Delete shop "${shop.name}"? This cannot be undone.`)) {
              api.deleteShop(shop.id).then(() => { window.location.href = '/shops' })
            }
          }}
        >
          Delete
        </button>
      </p>

      {shop.opening_message && (
        <>
          <h2>Opening message</h2>
          <p>{shop.opening_message}</p>
        </>
      )}

      <h2>Items</h2>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Enabled</th><th>Stock</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td><Link to={`/items/${i.id}`}>{i.id}</Link></td>
              <td>{i.name}</td>
              <td>{(i.price_cents / 100).toFixed(2)} {i.currency}</td>
              <td>{i.enabled ? 'yes' : 'no'}</td>
              <td>{i.stock_count ?? '—'}{i.sold_out ? ' (sold out)' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

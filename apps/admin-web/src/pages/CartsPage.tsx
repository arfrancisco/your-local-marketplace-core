import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminCart } from '../api/types'

export function CartsPage() {
  const [carts, setCarts] = useState<AdminCart[]>([])
  const [status, setStatus] = useState('active')

  useEffect(() => {
    api.listCarts({ status: status || undefined }).then((res) => setCarts(res.carts))
  }, [status])

  return (
    <div className="container">
      <h1>Carts</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="active">Active</option>
        <option value="converted">Converted</option>
        <option value="abandoned">Abandoned</option>
        <option value="">All</option>
      </select>
      <table>
        <thead><tr><th>ID</th><th>Shop</th><th>Status</th><th>Subtotal</th></tr></thead>
        <tbody>
          {carts.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.shop_id}</td>
              <td>{c.status}</td>
              <td>{(c.subtotal_cents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminShop } from '../api/types'

export function ShopsPage() {
  const [shops, setShops] = useState<AdminShop[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    api.listShops({ q: q || undefined }).then((res) => setShops(res.shops))
  }, [q])

  return (
    <div className="container">
      <h1>Shops</h1>
      <input placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Accepting orders</th></tr></thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id}>
              <td><Link to={`/shops/${s.id}`}>{s.id}</Link></td>
              <td>{s.name}</td>
              <td>{s.status}</td>
              <td>{s.accepting_orders ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

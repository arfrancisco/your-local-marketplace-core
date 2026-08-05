import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminShop } from '../api/types'

export function ShopsPage() {
  const [shops, setShops] = useState<AdminShop[]>([])
  const [q, setQ] = useState('')
  const [demoFilter, setDemoFilter] = useState('')

  useEffect(() => {
    api
      .listShops({ q: q || undefined, demo: demoFilter === '' ? undefined : demoFilter === 'true' })
      .then((res) => setShops(res.shops))
  }, [q, demoFilter])

  return (
    <div className="container">
      <h1>Shops</h1>
      <input placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Accepting orders</th><th>Verified</th><th>Demo</th></tr></thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id}>
              <td><Link to={`/shops/${s.id}`}>{s.id}</Link></td>
              <td><Link to={`/shops/${s.id}`}>{s.name}</Link></td>
              <td>{s.status}</td>
              <td>{s.accepting_orders ? 'yes' : 'no'}</td>
              <td>{s.vendor_verification_status === 'verified' && <span className="badge badge-verified">Verified</span>}</td>
              <td>{s.demo && <span className="badge badge-demo">Demo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminOrder } from '../api/types'

export function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [status, setStatus] = useState('')
  const [demoFilter, setDemoFilter] = useState('')

  useEffect(() => {
    api
      .listOrders({ status: status || undefined, demo: demoFilter === '' ? undefined : demoFilter === 'true' })
      .then((res) => setOrders(res.orders))
  }, [status, demoFilter])

  return (
    <div className="container">
      <h1>Orders</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option>
        <option value="placed">Placed</option>
        <option value="accepted">Accepted</option>
        <option value="preparing">Preparing</option>
        <option value="ready_for_pickup">Ready for pickup</option>
        <option value="out_for_delivery">Out for delivery</option>
        <option value="completed">Completed</option>
        <option value="rejected">Rejected</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead><tr><th>Ref</th><th>Shop</th><th>Status</th><th>Total</th><th>Demo</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/orders/${o.id}`}>{o.public_reference}</Link></td>
              <td>{o.shop_id}</td>
              <td>{o.status}</td>
              <td>{(o.total_cents / 100).toFixed(2)} {o.currency}</td>
              <td>{o.demo && <span className="badge badge-demo">Demo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

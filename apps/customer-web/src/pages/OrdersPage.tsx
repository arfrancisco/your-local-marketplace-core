import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Order } from '../api/types'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listOrders().then((res) => setOrders(res.orders)).finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading your orders…</p>

  return (
    <div>
      <div className="row spread">
        <h1>Your orders</h1>
        <Link to="/shops" className="muted">← All shops</Link>
      </div>

      {orders.length === 0 && <p className="muted">No orders yet — go find something good to eat.</p>}

      <ul className="list">
        {orders.map((order) => (
          <li key={order.id} className="card">
            <Link to={`/orders/${order.id}`} className="plain">
              <div className="row spread">
                <div>
                  <h2>{order.public_reference}</h2>
                  <p className="muted">
                    {order.items.length} item(s) · {formatPrice(order.total_cents, order.currency)}
                  </p>
                </div>
                <span className="tagline">{order.status.replace(/_/g, ' ')}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

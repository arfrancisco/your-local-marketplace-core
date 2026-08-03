import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Order, OrderStatus } from '../api/types'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

const STATUSES: (OrderStatus | 'all')[] = [
  'all', 'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'rejected', 'cancelled',
]

// Reached from the shop dashboard's "Orders" button with ?shop_id=,
// or with no shop_id to see everything across all of the vendor's shops.
export function OrdersPage() {
  const [params] = useSearchParams()
  const shopId = params.get('shop_id') ? Number(params.get('shop_id')) : undefined

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')

  useEffect(() => {
    setLoading(true)
    api.listVendorOrders(shopId).then((res) => setOrders(res.orders)).finally(() => setLoading(false))
  }, [shopId])

  if (loading) return <p>Loading orders…</p>

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div>
      <p className="back-link">
        <Link to="/shops">← Back to dashboard</Link>
      </p>
      <h1>Orders</h1>

      {shopId && (
        <p className="muted">
          Showing orders for this shop only — <Link to="/orders">see orders for all your shops</Link>.
        </p>
      )}

      <div className="row gap">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} disabled={filter === s}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <ul className="list">
        {visible.map((order) => (
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
        {visible.length === 0 && <p className="muted">No orders yet.</p>}
      </ul>
    </div>
  )
}

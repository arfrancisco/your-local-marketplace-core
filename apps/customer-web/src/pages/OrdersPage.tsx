import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Order } from '../api/types'
import {
  DROPDOWN_GROUPS,
  PILL_GROUPS,
  STATUS_GROUPS,
  groupKeyForStatus,
  statusBadgeClass,
  type StatusGroupKey,
} from '../orderStatus'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Same filter/color pattern as vendor-web's dashboard order list (see
// orderStatus.ts): a few color-coded status pills for the common, still-
// relevant statuses, plus a dropdown for the two that are done with (no
// longer anything to watch) — completed, rejected/cancelled. "All" is just
// those pills combined, not literally every order, so old orders don't
// clutter the default view.
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | StatusGroupKey>('all')

  useEffect(() => {
    api.listOrders().then((res) => setOrders(res.orders)).finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading your orders…</p>

  const visible = orders.filter((o) =>
    filter === 'all' ? PILL_GROUPS.includes(groupKeyForStatus(o.status)) : STATUS_GROUPS[filter].statuses.includes(o.status)
  )

  function countFor(key: StatusGroupKey) {
    return orders.filter((o) => STATUS_GROUPS[key].statuses.includes(o.status)).length
  }
  const allCount = PILL_GROUPS.reduce((sum, key) => sum + countFor(key), 0)

  return (
    <div>
      <div className="row spread">
        <h1>Your orders</h1>
        <Link to="/shops" className="button">← All shops</Link>
      </div>

      {orders.length === 0 ? (
        <p className="muted">No orders yet — go find something good to eat.</p>
      ) : (
        <>
          <div className="row gap order-filter-pills">
            <button
              type="button"
              className={`status-pill status-all${filter === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({allCount})
            </button>
            {PILL_GROUPS.map((key) => (
              <button
                key={key}
                type="button"
                className={`status-pill ${statusBadgeClass(key)}${filter === key ? ' active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {STATUS_GROUPS[key].label} ({countFor(key)})
              </button>
            ))}
            <select
              aria-label="More status filters"
              value={DROPDOWN_GROUPS.includes(filter as StatusGroupKey) ? filter : ''}
              onChange={(e) => setFilter(e.target.value ? (e.target.value as StatusGroupKey) : 'all')}
            >
              <option value="">More statuses…</option>
              {DROPDOWN_GROUPS.map((key) => (
                <option key={key} value={key}>
                  {STATUS_GROUPS[key].label} ({countFor(key)})
                </option>
              ))}
            </select>
          </div>

          <ul className="list">
            {visible.map((order) => {
              const groupKey = groupKeyForStatus(order.status)
              return (
                <li key={order.id} className={`card order-card ${statusBadgeClass(groupKey)}`}>
                  <Link to={`/orders/${order.id}`} className="plain">
                    <div className="row spread">
                      <h2>
                        {order.shop_name}
                        {order.has_unread_messages && <span className="unread-dot" aria-label="Unread update" />}
                        {order.status === 'completed' && !order.rating && (
                          <span className="rate-badge" aria-label="Rate this order">Rate</span>
                        )}
                      </h2>
                      <span className={`order-status-badge ${statusBadgeClass(groupKey)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="muted order-reference">{order.public_reference}</span>
                    <p className="muted">
                      {order.items.length} item(s) · {formatPrice(order.total_cents, order.currency)}
                    </p>
                  </Link>
                </li>
              )
            })}
            {visible.length === 0 && <p className="muted">No orders in this filter.</p>}
          </ul>
        </>
      )}
    </div>
  )
}

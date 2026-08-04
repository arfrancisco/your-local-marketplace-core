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
import { CustomerSummary } from './CustomerSummary'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

interface Props {
  /** Restricts the list to one shop's orders. The dashboard always passes
   * its one shop's id; omitted would show every order across the vendor's
   * shops, though nothing currently renders this component without one. */
  shopId?: number
}

// The fetch/filter/render logic behind the shop dashboard's order list.
// Filter is a small set of color-coded status-bucket pills (the common,
// actionable statuses) plus a dropdown for the two less-urgent buckets
// (completed, rejected/cancelled) — see src/orderStatus.ts for the bucket
// definitions shared with OrderDetailPage.
export function OrderList({ shopId }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | StatusGroupKey>('all')

  useEffect(() => {
    setLoading(true)
    api.listVendorOrders(shopId).then((res) => setOrders(res.orders)).finally(() => setLoading(false))
  }, [shopId])

  if (loading) return <p>Loading orders…</p>

  // "All" is just the combined pill buckets (needs action / in progress /
  // ready), not literally every order ever — completed and rejected/
  // cancelled orders have nothing left to act on, so they'd just be
  // clutter in the default view. Both stay reachable via the dropdown.
  const visible = orders.filter((o) =>
    filter === 'all' ? PILL_GROUPS.includes(groupKeyForStatus(o.status)) : STATUS_GROUPS[filter].statuses.includes(o.status)
  )

  function countFor(key: StatusGroupKey) {
    return orders.filter((o) => STATUS_GROUPS[key].statuses.includes(o.status)).length
  }
  const allCount = PILL_GROUPS.reduce((sum, key) => sum + countFor(key), 0)

  return (
    <div>
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
                  <h2>{order.public_reference}</h2>
                  <div className="row gap">
                    <span className={`order-status-badge ${statusBadgeClass(groupKey)}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`payment-badge ${order.payment_status === 'unpaid' ? 'is-unpaid' : 'is-paid'}`}>
                      {order.payment_status === 'unpaid' ? 'Unpaid' : 'Paid'}
                    </span>
                  </div>
                </div>
                <CustomerSummary
                  name={order.customer_name}
                  building={order.customer_building}
                  unit={order.customer_unit}
                  isResident={order.customer_is_resident}
                />
                <p className="muted">
                  {order.items.length} item(s) · {formatPrice(order.total_cents, order.currency)}
                </p>
              </Link>
            </li>
          )
        })}
        {visible.length === 0 && <p className="muted">No orders yet.</p>}
      </ul>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVendorOrdersPoll } from '../useVendorOrdersPoll'
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

// The filter/render logic behind the shop dashboard's order list. Orders
// come from the shared VendorOrdersPollProvider (App.tsx) — already scoped
// to the vendor's one shop via useMyShop() internally — rather than a
// one-shot fetch of its own, so this and TabBar's attention dot read the
// same polled snapshot instead of each hitting the endpoint independently.
// Filter is a small set of color-coded status-bucket pills (the common,
// actionable statuses) plus a dropdown for the two less-urgent buckets
// (completed, rejected/cancelled) — see src/orderStatus.ts for the bucket
// definitions shared with OrderDetailPage.
export function OrderList() {
  const orders = useVendorOrdersPoll()
  const [filter, setFilter] = useState<'all' | StatusGroupKey>('all')

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
                  <h2>
                    {order.public_reference}
                    {order.has_unread_messages && <span className="unread-dot" aria-label="Unread update" />}
                  </h2>
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

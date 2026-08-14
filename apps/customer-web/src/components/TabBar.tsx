import { useEffect, useState } from 'react'
import { Link, NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api/client'
import type { OrderStatus, User } from '../api/types'
import { vendorWebUrl } from '../vendorWeb'
import { CartButton } from './CartButton'

// Same set ActiveOrderButton used to filter on (see App.tsx's git history) —
// an order still "in flight" from a customer's point of view.
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
]

const ACTIVE_ORDER_REFRESH_MS = 45_000

// Reuses the same poll-every-45s mechanism the old ActiveOrderButton used
// (listOrders(), filtered to in-flight statuses) rather than adding a second
// poller — just computes a boolean (does any in-flight order have an unread
// chat message) instead of a "track my order" button.
function useOrdersUnreadDot(): boolean {
  const { user } = useAuth()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!user) {
      setHasUnread(false)
      return
    }
    let cancelled = false
    function refresh() {
      api
        .listOrders()
        .then((res) => {
          if (cancelled) return
          const active = res.orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status))
          setHasUnread(active.some((o) => o.has_unread_messages))
        })
        .catch(() => {
          // Best-effort — a failed poll just leaves the dot as it was.
        })
    }
    refresh()
    const interval = setInterval(refresh, ACTIVE_ORDER_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id])

  return hasUnread
}

// Plain stroked outline icons, matching this app's zero-icon-library
// convention (see e.g. CartButton.tsx's CartIcon, ShopsPage.tsx's
// SearchIcon). stroke="currentColor" (not a hardcoded color) so the same
// icon tints gray or brand-indigo depending on .tab-bar-item's active state,
// via CSS alone.
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Simple storefront outline — a placeholder per the plan, easily swappable
// later, not blocking.
function VendorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9h18l-1 3a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 13.5 15a2.5 2.5 0 0 1-2-1.5A2.5 2.5 0 0 1 9 15a2.5 2.5 0 0 1-2-1.5A2.5 2.5 0 0 1 2.5 12L3 9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4.5 20a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function tabClass({ isActive }: NavLinkRenderProps) {
  return `tab-bar-item${isActive ? ' active' : ''}`
}

// Vendor tab — three different destinations depending on auth/vendor state,
// per the plan: a real cross-app <a> (vendorWebUrl) for an existing vendor,
// /account for a signed-in eligible-or-not customer (AccountPage already
// fully renders eligibility state and "Start selling"), /login when signed
// out. Deliberately not a NavLink — the active-tab highlighting bullet only
// names Home/Orders/Account, and this tab's own destinations already belong
// to other tabs (or another app entirely), so it never claims "active" here.
function VendorTab({ user }: { user: User | null }) {
  const icon = (
    <span className="tab-bar-icon-wrap">
      <VendorIcon />
    </span>
  )
  const label = <span className="tab-bar-label">Vendor</span>

  if (user?.vendor_profile) {
    return (
      <a href={vendorWebUrl('/shops')} className="tab-bar-item">
        {icon}
        {label}
      </a>
    )
  }
  if (user) {
    return (
      <Link to="/account" className="tab-bar-item">
        {icon}
        {label}
      </Link>
    )
  }
  return (
    <Link to="/login" className="tab-bar-item">
      {icon}
      {label}
    </Link>
  )
}

// Persistent 5-tab bottom bar — the one nav surface for every auth state,
// replacing the old hamburger drawer plus the previous cart-summary/
// track-my-order bottom bar. Present on every route (rendered once in
// App.tsx, outside the router's <Routes>).
export function TabBar() {
  const { user } = useAuth()
  const hasUnread = useOrdersUnreadDot()

  return (
    <nav className="tab-bar" aria-label="Primary">
      <div className="tab-bar-inner">
        <NavLink to="/shops" className={tabClass}>
          <span className="tab-bar-icon-wrap">
            <HomeIcon />
          </span>
          <span className="tab-bar-label">Home</span>
        </NavLink>

        <NavLink to="/orders" className={tabClass}>
          <span className="tab-bar-icon-wrap">
            <OrdersIcon />
            {hasUnread && <span className="unread-dot tab-bar-dot" aria-label="Unread update" />}
          </span>
          <span className="tab-bar-label">Orders</span>
        </NavLink>

        <CartButton />

        <VendorTab user={user} />

        <NavLink to="/account" className={tabClass}>
          <span className="tab-bar-icon-wrap">
            <AccountIcon />
          </span>
          <span className="tab-bar-label">Account</span>
        </NavLink>
      </div>
    </nav>
  )
}

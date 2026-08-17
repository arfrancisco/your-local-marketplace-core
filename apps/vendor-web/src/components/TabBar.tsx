import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { useAuth } from '../auth'
import { useMyShop } from '../useMyShop'
import { useVendorOrdersPoll } from '../useVendorOrdersPoll'
import { customerWebUrl } from '../customerWeb'
import { PILL_GROUPS, STATUS_GROUPS } from '../orderStatus'
import type { OrderStatus } from '../api/types'

// Same "actionable" bucket OrderList.tsx's own status pills already use
// (needs_action / in_progress / ready) — the vendor-side equivalent of
// customer-web's ACTIVE_ORDER_STATUSES, reused rather than duplicated.
const ATTENTION_STATUSES: OrderStatus[] = PILL_GROUPS.flatMap((key) => STATUS_GROUPS[key].statuses)

// A pure derivation over the shared VendorOrdersPollProvider snapshot
// (App.tsx) — OrderList reads the same snapshot, so this and the order
// list no longer run two independent 45s polls against the same endpoint.
function useHomeAttentionDot(): boolean {
  const orders = useVendorOrdersPoll()
  return orders.some((o) => ATTENTION_STATUSES.includes(o.status) && o.has_unread_messages)
}

// Plain stroked outline icons, matching this app's (and customer-web's)
// zero-icon-library convention. Home/Account paths match customer-web's
// TabBar.tsx exactly — same concepts, same look.
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8 12 4l9 4-9 4-9-4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8v8l9 4 9-4V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ReviewsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 14.47 8.5l5.53.8-4 3.9.94 5.5-4.94-2.6-4.94 2.6.94-5.5-4-3.9 5.53-.8L12 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Storefront glyph — the marketplace vendor-web crosses back into.
function MarketplaceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9h18l-1 3a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 13.5 15a2.5 2.5 0 0 1-2-1.5A2.5 2.5 0 0 1 9 15a2.5 2.5 0 0 1-2-1.5A2.5 2.5 0 0 1 2.5 12L3 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function tabClass({ isActive }: NavLinkRenderProps) {
  return `tab-bar-item${isActive ? ' active' : ''}`
}

// Persistent bottom bar — the one nav surface for a signed-in vendor,
// replacing the old hamburger drawer. Rendered once in App.tsx, outside
// <Routes>, present on every route. 5 tabs: no cart (unlike customer-web),
// but Inventory and Reviews both moved here from DashboardActionsMenu's
// kebab menu (see that component) since they're common enough destinations
// to deserve direct tap targets rather than living behind a menu. Orders
// stays embedded in the dashboard rather than getting its own tab — the
// Home tab's attention dot is the vendor-side equivalent of customer-web's
// Orders-tab dot, just placed where orders actually live here. Renders
// nothing for a signed-out user or a signed-in user with no vendor_profile
// — RequireAuth already gates every route on that, this just mirrors the
// same condition rather than showing a bar that points at pages the user
// can't reach.
export function TabBar() {
  const { user } = useAuth()
  const shopId = useMyShop()
  const hasAttention = useHomeAttentionDot()

  if (!user?.vendor_profile) return null

  return (
    <nav className="tab-bar" aria-label="Primary">
      <div className="tab-bar-inner">
        <NavLink to="/shops" end className={tabClass}>
          <span className="tab-bar-icon-wrap">
            <HomeIcon />
            {hasAttention && <span className="unread-dot tab-bar-dot" aria-label="Needs attention" />}
          </span>
          <span className="tab-bar-label">Home</span>
        </NavLink>

        {shopId && (
          <NavLink to={`/shops/${shopId}/items`} className={tabClass}>
            <span className="tab-bar-icon-wrap">
              <InventoryIcon />
            </span>
            <span className="tab-bar-label">Inventory</span>
          </NavLink>
        )}

        {shopId && (
          <NavLink to={`/shops/${shopId}/reviews`} className={tabClass}>
            <span className="tab-bar-icon-wrap">
              <ReviewsIcon />
            </span>
            <span className="tab-bar-label">Reviews</span>
          </NavLink>
        )}

        <a href={customerWebUrl('/shops')} className="tab-bar-item">
          <span className="tab-bar-icon-wrap">
            <MarketplaceIcon />
          </span>
          <span className="tab-bar-label">Marketplace</span>
        </a>

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

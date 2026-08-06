import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import { api } from './api/client'
import type { Order, OrderStatus } from './api/types'
import { CartButton } from './components/CartButton'
import { Footer } from './components/Footer'
import { useCart } from './CartContext'
import { HamburgerMenu } from './components/HamburgerMenu'
import { ShopsPage } from './pages/ShopsPage'
import { ShopDetailPage } from './pages/ShopDetailPage'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { AccountPage } from './pages/AccountPage'
import { OrderPage } from './pages/OrderPage'
import { OrderPlacedPage } from './pages/OrderPlacedPage'
import { OrdersPage } from './pages/OrdersPage'

// position: fixed so this stays pinned in the top right as the page scrolls
// under it; the top offset lines it up with the top bar at scroll 0, below
// the beta banner. The cart moved to the fixed bottom bar (BottomBar, below)
// so it doesn't crowd the header on narrow screens.
//
// Signed-out visitors get a direct Sign in CTA here instead of the
// hamburger — the drawer buried it behind an extra tap, and signing in is
// the one thing this app most wants a first-time visitor to find. Just the
// one button (not a separate Sign up alongside it) — the login page itself
// already has a "Don't have an account? Create one" link, so a second
// button here would just be the same destination twice. Feedback
// (previously reachable from the drawer even when signed out) moved to the
// footer, which is present on every route regardless of auth state.
// Signed-in users keep the hamburger as before.
function HeaderActions() {
  const { user } = useAuth()

  return (
    <div className="header-actions">
      {user ? <HamburgerMenu /> : <Link to="/login" className="link-button header-cta-btn">Sign in</Link>}
    </div>
  )
}

function Header() {
  return (
    <header className="topbar">
      <div className="brand-block">
        <Link to="/shops" className="brand">Prisma KapitMarket</Link>
        <p className="brand-tagline">By the community, for the community</p>
      </div>
      <HeaderActions />
    </header>
  )
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
]

const ACTIVE_ORDER_REFRESH_MS = 45_000

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Fills the bar's flex space with a running total once there's something in
// the cart, instead of leaving it blank next to the cart icon — the current
// task (finish this order) takes priority over the track-your-order
// reminder below, which only shows once the cart is empty again. Plain bold
// text rather than a pill button (unlike the track-your-order case below) —
// the round cart icon already reads as the tappable action, so this doesn't
// need its own button chrome competing for attention next to it.
function CartSummaryButton() {
  const { count, subtotalCents, currency, openCart } = useCart()
  if (count === 0) return null

  return (
    <button className="cart-summary-bar" onClick={openCart}>
      {count} item{count === 1 ? '' : 's'} · {formatPrice(subtotalCents, currency)}
    </button>
  )
}

// Global (not page-scoped) — a signed-in customer with an order in flight
// should be able to jump back to it from anywhere, not just from /orders.
// Lives in the bottom bar, growing to fill the space next to the cart icon
// (flex: 1, in CSS) rather than floating as its own separate chip — a single
// wide tap target is easier to hit accurately than two small ones stacked
// close together.
function ActiveOrderButton() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeOrders, setActiveOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!user) {
      setActiveOrders([])
      return
    }
    let cancelled = false
    function refresh() {
      api
        .listOrders()
        .then((res) => {
          if (cancelled) return
          setActiveOrders(res.orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)))
        })
        .catch(() => {
          // Best-effort — a failed poll just leaves the button as it was.
        })
    }
    refresh()
    const interval = setInterval(refresh, ACTIVE_ORDER_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id])

  if (!user || activeOrders.length === 0) return null

  function onClick() {
    if (activeOrders.length === 1) navigate(`/orders/${activeOrders[0].id}`)
    else navigate('/orders')
  }

  return (
    <button className="bar-primary" onClick={onClick}>
      {activeOrders.length === 1
        ? 'Track your order'
        : `Track your orders (${activeOrders.length})`}
    </button>
  )
}

function BetaBanner() {
  return (
    <div className="beta-banner">
      Beta test — please bear with us while we smooth out the experience.
    </div>
  )
}

function EmailVerificationBanner() {
  const { user } = useAuth()
  if (!user || user.email_verified) return null
  return (
    <div className="verify-banner">
      Verify your email to place an order — check your inbox, or{' '}
      <a href="/account#email-verify">verify now</a>.
    </div>
  )
}

// Invitation, not a nag — shown to every signed-in customer who isn't a
// vendor yet, regardless of their own email-verified state (that's the
// unrelated concern EmailVerificationBanner already covers above). Links
// into the same "Become a vendor" eligibility flow AccountPage already has
// (also reachable from HamburgerMenu's drawer) — this is just a more visible
// entry point into it, not a new flow.
function BecomeVendorBanner() {
  const { user } = useAuth()
  if (!user || user.vendor_profile) return null
  return (
    <div className="become-vendor-banner">
      Got something to sell? Turn your kitchen into a shop —{' '}
      <Link to="/account">become a vendor</Link>.
    </div>
  )
}

// The bar's flex-1 slot shows one thing at a time: the cart summary whenever
// there's something in the cart (the task at hand), falling back to the
// track-your-order reminder only once the cart is empty. Showing both
// together would just recreate the clutter this bar replaced.
function BottomBarStatus() {
  const { count } = useCart()
  if (count > 0) return <CartSummaryButton />
  return <ActiveOrderButton />
}

// A single fixed bar across the bottom of the screen, not two separate
// floating chips — two small buttons stacked close together (the previous
// design) were easy to mispress with a thumb, and had no background of their
// own, so they visually blended into (and covered) whatever page content
// happened to scroll underneath. The bar's own opaque surface fixes both:
// clear separation between the two actions, and content never hides behind
// it (.container reserves matching bottom padding).
function BottomBar() {
  return (
    <div className="bottom-bar">
      <BottomBarStatus />
      <CartButton />
    </div>
  )
}

export default function App() {
  return (
    <>
      <BetaBanner />
      <EmailVerificationBanner />
      <BecomeVendorBanner />
      <Header />

      <main className="container">
        <Routes>
          <Route path="/shops" element={<ShopsPage />} />
          <Route path="/shops/:slug" element={<ShopDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id/placed" element={<OrderPlacedPage />} />
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>

        {/* Inside .container, not a sibling after it — .container reserves
            5rem of bottom padding for the fixed BottomBar (see its comment
            below), so content here, footer included, never ends up hidden
            behind it. A sibling footer outside .container wouldn't get that
            protection. */}
        <Footer />
      </main>

      <BottomBar />
    </>
  )
}

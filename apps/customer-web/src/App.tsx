import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import { api } from './api/client'
import type { Order, OrderStatus } from './api/types'
import { vendorWebUrl } from './vendorWeb'
import { FeedbackModal } from './components/FeedbackModal'
import { ShopsPage } from './pages/ShopsPage'
import { ShopDetailPage } from './pages/ShopDetailPage'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { AccountPage } from './pages/AccountPage'
import { OrderPage } from './pages/OrderPage'
import { OrdersPage } from './pages/OrdersPage'

function Header() {
  const { user, logout } = useAuth()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <header className="topbar">
      <div className="brand-block">
        <Link to="/shops" className="brand">Prisma KapitMarket</Link>
        <p className="brand-tagline">By the community, for the community</p>
      </div>
      {user ? (
        <div className="row gap">
          <Link to="/shops">Home</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/account">My account</Link>
          {user.vendor_profile && (
            // Real page navigation, not React Router's Link — this crosses
            // into the separate vendor-web SPA, and this app's own catch-all
            // route would otherwise swallow client-side nav to a path that
            // doesn't exist here.
            <a href={vendorWebUrl('/shops')}>Vendor dashboard</a>
          )}
          <button onClick={() => setFeedbackOpen(true)}>Send feedback</button>
          <span className="muted">{user.customer_profile?.display_name ?? user.email}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      ) : (
        <div className="row gap">
          <Link to="/shops">Home</Link>
          <button onClick={() => setFeedbackOpen(true)}>Send feedback</button>
          <Link to="/login">Sign in</Link>
          <Link to="/login?mode=register">Create account</Link>
        </div>
      )}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
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

// Global (not page-scoped) — a signed-in customer with an order in flight
// should be able to jump back to it from anywhere, not just from /orders.
// Bottom-right, distinct from ShopDetailPage's top-right cart button; the
// two never actually appear on the same page anyway.
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
    <button className="active-order-fab" onClick={onClick}>
      {activeOrders.length === 1
        ? 'Track your order →'
        : `Track your orders (${activeOrders.length}) →`}
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

export default function App() {
  return (
    <>
      <BetaBanner />
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
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>
      </main>

      <ActiveOrderButton />
    </>
  )
}

import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import { api } from './api/client'
import type { Order, OrderStatus } from './api/types'
import { CartButton } from './components/CartButton'
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
import { OrdersPage } from './pages/OrdersPage'

// Nav is down to two icons: everything that used to be an inline link row now
// lives in the hamburger drawer, and the cart moved out of ShopDetailPage into
// here so it is reachable from every page. The cluster is position: fixed (the
// established .cart-fab/.active-order-fab convention) so it stays pinned in the
// top right as the page scrolls under it; the top offset lines it up with the
// top bar at scroll 0, below the beta banner.
function HeaderActions() {
  return (
    <div className="header-actions">
      <CartButton />
      <HamburgerMenu />
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

// Global (not page-scoped) — a signed-in customer with an order in flight
// should be able to jump back to it from anywhere, not just from /orders.
// Bottom-right, keeping the top-right corner clear for the header's cart and
// menu icons.
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

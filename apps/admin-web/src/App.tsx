import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'
import { UserDetailPage } from './pages/UserDetailPage'
import { VendorProfilesPage } from './pages/VendorProfilesPage'
import { ShopsPage } from './pages/ShopsPage'
import { ShopDetailPage } from './pages/ShopDetailPage'
import { ItemDetailPage } from './pages/ItemsPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ConversationDetailPage } from './pages/ConversationDetailPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { ApiTokensPage } from './pages/ApiTokensPage'
import { VerificationChallengesPage } from './pages/VerificationChallengesPage'
import { CustomerProfilesPage } from './pages/CustomerProfilesPage'
import { AddressesPage } from './pages/AddressesPage'
import { CartsPage } from './pages/CartsPage'
import { TagsPage } from './pages/TagsPage'
import { EarlyAccessSignupsPage } from './pages/EarlyAccessSignupsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth()
  if (loading) return <p className="container">Loading…</p>
  if (!authenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Header() {
  const { authenticated, logout } = useAuth()
  const navigate = useNavigate()
  if (!authenticated) return null
  return (
    <header className="topbar">
      <strong>KapitMarket PH Admin</strong>
      <nav>
        <Link to="/users">Users</Link>
        <Link to="/vendor_profiles">Vendor profiles</Link>
        <Link to="/shops">Shops</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/feedback">Feedback</Link>
        <Link to="/api_tokens">API tokens</Link>
        <Link to="/verification_challenges">Verifications</Link>
        <Link to="/customer_profiles">Customers</Link>
        <Link to="/addresses">Addresses</Link>
        <Link to="/carts">Carts</Link>
        <Link to="/tags">Tags</Link>
        <Link to="/early_access_signups">Early access</Link>
        <button onClick={() => { logout(); navigate('/login') }}>Sign out</button>
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
        <Route path="/users/:id" element={<RequireAuth><UserDetailPage /></RequireAuth>} />
        <Route path="/vendor_profiles" element={<RequireAuth><VendorProfilesPage /></RequireAuth>} />
        <Route path="/shops" element={<RequireAuth><ShopsPage /></RequireAuth>} />
        <Route path="/shops/:id" element={<RequireAuth><ShopDetailPage /></RequireAuth>} />
        <Route path="/items/:id" element={<RequireAuth><ItemDetailPage /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="/conversations/:id" element={<RequireAuth><ConversationDetailPage /></RequireAuth>} />
        <Route path="/feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
        <Route path="/api_tokens" element={<RequireAuth><ApiTokensPage /></RequireAuth>} />
        <Route path="/verification_challenges" element={<RequireAuth><VerificationChallengesPage /></RequireAuth>} />
        <Route path="/customer_profiles" element={<RequireAuth><CustomerProfilesPage /></RequireAuth>} />
        <Route path="/addresses" element={<RequireAuth><AddressesPage /></RequireAuth>} />
        <Route path="/carts" element={<RequireAuth><CartsPage /></RequireAuth>} />
        <Route path="/tags" element={<RequireAuth><TagsPage /></RequireAuth>} />
        <Route path="/early_access_signups" element={<RequireAuth><EarlyAccessSignupsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/users" replace />} />
      </Routes>
    </>
  )
}

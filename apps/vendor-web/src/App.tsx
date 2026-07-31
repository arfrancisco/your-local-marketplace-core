import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { LoginPage } from './pages/LoginPage'
import { ShopsPage } from './pages/ShopsPage'
import { ShopFormPage } from './pages/ShopFormPage'
import { ItemsPage } from './pages/ItemsPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="container">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  // Signed in (possibly via customer-web — the two apps share one token,
  // since a User can hold both profiles at once) but this account has no
  // vendor_profile. A clear message here, not a silent redirect back to
  // login (that would be confusing — they *are* signed in) and not the
  // vendor pages themselves, which would just 403 against the API.
  if (!user.vendor_profile) {
    return (
      <div className="card narrow">
        <h1>No vendor account here</h1>
        <p className="muted">
          {user.email} is signed in, but doesn't have a vendor profile yet.
          Contact support to set one up.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <header className="topbar">
      <Link to="/shops" className="brand">Vendor console</Link>
      <div className="row gap">
        <span className="muted">{user.email}</span>
        <button onClick={() => { logout(); navigate('/login') }}>Sign out</button>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/shops" element={<RequireAuth><ShopsPage /></RequireAuth>} />
          <Route path="/shops/new" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/edit" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/items" element={<RequireAuth><ItemsPage /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>
      </main>
    </>
  )
}

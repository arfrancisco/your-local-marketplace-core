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

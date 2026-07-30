import { useState } from 'react'
import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './auth'
import { ShopsPage } from './pages/ShopsPage'
import { ShopDetailPage } from './pages/ShopDetailPage'
import { EarlyAccessModal } from './components/EarlyAccessModal'

function Header() {
  const { user, logout } = useAuth()
  const [joinOpen, setJoinOpen] = useState(false)

  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <Link to="/shops" className="brand">Prisma KapitMarket</Link>
          <p className="brand-tagline">By the community, for the community</p>
        </div>
        {user ? (
          <div className="row gap">
            <span className="muted">{user.customer_profile?.display_name ?? user.email}</span>
            <button onClick={logout}>Sign out</button>
          </div>
        ) : (
          <button onClick={() => setJoinOpen(true)}>Join early access</button>
        )}
      </header>
      <EarlyAccessModal open={joinOpen} onClose={() => setJoinOpen(false)} context="header" />
    </>
  )
}

export default function App() {
  return (
    <>
      {/* Honest framing: this is a preview, not a live store. */}
      <div className="preview-banner">
        Preview — coming soon to your community. These are sample shops.
      </div>

      <Header />

      <main className="container">
        <Routes>
          <Route path="/shops" element={<ShopsPage />} />
          <Route path="/shops/:slug" element={<ShopDetailPage />} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>
      </main>
    </>
  )
}

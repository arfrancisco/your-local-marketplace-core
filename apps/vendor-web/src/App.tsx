import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { FeedbackModal } from './components/FeedbackModal'
import { HamburgerMenu } from './components/HamburgerMenu'
import { LoginPage } from './pages/LoginPage'
import { ShopDashboardPage } from './pages/ShopDashboardPage'
import { ShopFormPage } from './pages/ShopFormPage'
import { ShopPreviewPage } from './pages/ShopPreviewPage'
import { ShopReviewsPage } from './pages/ShopReviewsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ItemsPage } from './pages/ItemsPage'
import { ItemEditPage } from './pages/ItemEditPage'
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
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  if (!user) return null
  return (
    <header className="topbar">
      <Link to="/shops" className="brand">Vendor console</Link>
      {/* Nav lives in the drawer now, not inline — one ☰ button is all the
          header carries, which is what keeps it readable at phone widths. */}
      <button
        type="button"
        className="hamburger-btn"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        ☰
      </button>
      {menuOpen && (
        <HamburgerMenu
          email={user.email}
          onClose={() => setMenuOpen(false)}
          onFeedback={() => { setMenuOpen(false); setFeedbackOpen(true) }}
          onSignOut={() => { setMenuOpen(false); logout(); navigate('/login') }}
        />
      )}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </header>
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route path="/shops" element={<RequireAuth><ShopDashboardPage /></RequireAuth>} />
          <Route path="/shops/new" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/edit" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/preview" element={<RequireAuth><ShopPreviewPage /></RequireAuth>} />
          <Route path="/shops/:id/reviews" element={<RequireAuth><ShopReviewsPage /></RequireAuth>} />
          <Route path="/shops/:id/items" element={<RequireAuth><ItemsPage /></RequireAuth>} />
          <Route path="/shops/:id/items/:itemId/edit" element={<RequireAuth><ItemEditPage /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>
      </main>
    </>
  )
}

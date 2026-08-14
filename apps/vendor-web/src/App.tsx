import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { FeedbackModal } from './components/FeedbackModal'
import { Footer } from './components/Footer'
import { HamburgerMenu } from './components/HamburgerMenu'
import { LoginPage } from './pages/LoginPage'
import { AccountPage } from './pages/AccountPage'
import { ShopDashboardPage } from './pages/ShopDashboardPage'
import { ShopFormPage } from './pages/ShopFormPage'
import { ShopPreviewPage } from './pages/ShopPreviewPage'
import { ShopReviewsPage } from './pages/ShopReviewsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ItemsPage } from './pages/ItemsPage'
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

// Just the brand link now — nav lives in the drawer, opened from the bottom
// bar's ☰ trigger (BottomBar, below), not from here.
function Header() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <header className="topbar">
      <Link to="/shops" className="brand">Vendor console</Link>
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

// Fixed bar across the bottom of the screen — mirrors customer-web's own
// BottomBar (App.tsx there): same .bottom-bar/.bottom-bar-inner classes,
// same reasoning, a persistent control surface reachable by thumb instead
// of a trigger buried in the header. Self-contained (owns its own
// menuOpen/feedbackOpen state and the ☰ trigger itself) — the same shape
// customer-web's own HamburgerMenu used to have before *its* move into a
// bottom bar, so App.tsx doesn't need to prop-drill this state anywhere.
function BottomBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  if (!user) return null
  return (
    <div className="bottom-bar">
      <div className="bottom-bar-inner">
        <button
          type="button"
          className="icon-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
      </div>
      {menuOpen && (
        <HamburgerMenu
          email={user.email}
          onClose={() => setMenuOpen(false)}
          onFeedback={() => { setMenuOpen(false); setFeedbackOpen(true) }}
          onSignOut={() => { setMenuOpen(false); logout(); navigate('/login') }}
        />
      )}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
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
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/shops" element={<RequireAuth><ShopDashboardPage /></RequireAuth>} />
          <Route path="/shops/new" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/edit" element={<RequireAuth><ShopFormPage /></RequireAuth>} />
          <Route path="/shops/:id/preview" element={<RequireAuth><ShopPreviewPage /></RequireAuth>} />
          <Route path="/shops/:id/reviews" element={<RequireAuth><ShopReviewsPage /></RequireAuth>} />
          <Route path="/shops/:id/items" element={<RequireAuth><ItemsPage /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/shops" replace />} />
        </Routes>

        {/* Inside .container, not a sibling after it, so .container's
            bottom padding (reserved for the fixed BottomBar) protects the
            footer too — same reasoning as customer-web's own Footer
            placement (see its App.tsx comment). Previously a sibling after
            </main>; harmless before there was any fixed bottom element, but
            would now risk the footer sitting behind the new bar. */}
        <Footer />
      </main>

      <BottomBar />
    </>
  )
}

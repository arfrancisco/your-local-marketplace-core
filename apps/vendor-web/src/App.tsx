import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from './auth'
import { MyShopProvider } from './useMyShop'
import { Footer } from './components/Footer'
import { TabBar } from './components/TabBar'
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

// Nav lives in the persistent bottom tab bar now (TabBar), not a drawer —
// the header is just the brand link.
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

export default function App() {
  return (
    <MyShopProvider>
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

        {/* Inside .container, not a sibling after it — .container now
            reserves bottom padding for the fixed TabBar below every page
            (see index.css), so content here, footer included, never ends
            up hidden behind it. Matches customer-web's App.tsx. */}
        <Footer />
      </main>

      <TabBar />
    </MyShopProvider>
  )
}

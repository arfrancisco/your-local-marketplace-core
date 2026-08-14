import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './auth'
import { OrdersPollProvider } from './useOrdersPoll'
import { Footer } from './components/Footer'
import { RatingNudgeModal } from './components/RatingNudgeModal'
import { TabBar } from './components/TabBar'
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

// Just the brand block now, unconditionally, for every auth state — the
// persistent 5-tab bar below (TabBar) is the one nav surface now, so the
// header no longer branches on signed-in/out to show a hamburger or a Sign
// in CTA (both retired; Sign in is one tap away via the Account/Vendor tabs
// for a signed-out visitor instead).
function Header() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand-block">
          <Link to="/shops" className="brand">Prisma KapitMarket</Link>
          <p className="brand-tagline">By the community, for the community</p>
        </div>
      </div>
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

function MobileVerificationBanner() {
  const { user } = useAuth()
  if (!user || user.mobile_verified) return null
  return (
    <div className="verify-banner">
      Verify your mobile number to place an order — check your text messages, or{' '}
      <a href="/account#mobile-verify">verify now</a>.
    </div>
  )
}

export default function App() {
  return (
    <OrdersPollProvider>
      <BetaBanner />
      <MobileVerificationBanner />
      <RatingNudgeModal />
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
            5rem of bottom padding for the fixed tab bar (see TabBar.tsx and
            its .tab-bar CSS), so content here, footer included, never ends
            up hidden behind it. A sibling footer outside .container
            wouldn't get that protection. */}
        <Footer />
      </main>

      <TabBar />
    </OrdersPollProvider>
  )
}

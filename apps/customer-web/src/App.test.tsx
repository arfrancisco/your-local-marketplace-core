import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { CartProvider } from './CartContext'
import { api, setToken } from './api/client'
import type { User } from './api/types'

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'neighbor@example.com',
    mobile_number: '09171234567',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    status: 'active',
    email_verified: true,
    mobile_verified: true,
    email_marketing_opt_in: false,
    sms_marketing_opt_in: false,
    sms_notify_order_accepted: true,
    sms_notify_order_ready: true,
    sms_notify_order_completed: true,
    last_signed_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: null,
      is_resident: true, willing_to_verify_residency: true,
    },
    vendor_profile: null,
    vendor_eligibility: { eligible: true, reasons: [] },
    ...overrides,
  }
}

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listShops: vi.fn().mockResolvedValue({ shops: [] }),
      listOrders: vi.fn().mockResolvedValue({ orders: [] }),
    },
  }
})

function renderApp(initialEntries = ['/shops']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

// Header no longer branches on auth state at all — it's just the brand
// block on every route, for every visitor. The old hamburger/Sign-in-CTA
// branching this used to test is gone; per-auth-state nav now lives entirely
// in the persistent tab bar (see TabBar.tsx / TabBar.test.tsx, which covers
// the Home/Orders/Cart/Vendor/Account tabs and their auth-dependent
// destinations in isolation rather than through a full App render).
describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  // Scoped to the header (role "banner") specifically, not the whole page —
  // a whole-document query for "Sign in" would also match the tab bar's own
  // Account-tab-as-Sign-in link when signed out (TabBar.tsx), which is a
  // real, separate link and not what this test is about.
  it('renders just the brand block when signed out', async () => {
    renderApp()

    const header = await screen.findByRole('banner')
    expect(within(header).getByRole('link', { name: /prisma kapitmarket/i })).toHaveAttribute('href', '/shops')
    expect(within(header).queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument()
    expect(within(header).queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
  })

  it('renders the same brand-only header when signed in', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()

    const header = await screen.findByRole('banner')
    expect(within(header).getByRole('link', { name: /prisma kapitmarket/i })).toHaveAttribute('href', '/shops')
    expect(within(header).queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument()
  })
})

describe('OrdersPollProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // App mounts both TabBar (via useOrdersUnreadDot) and RatingNudgeModal,
  // and each calls useOrdersPoll(). Before this was backed by a shared
  // context, each call ran its own independent fetch+interval, so two
  // consumers meant two listOrders() requests per poll tick. This pins the
  // fix at the level that actually matters — a real integrated render, not
  // just useOrdersPoll.test.tsx's single-hook isolation, which can't catch
  // request-count regressions between multiple consumers.
  it('shares one listOrders() poll across TabBar and RatingNudgeModal, not one each', async () => {
    vi.useFakeTimers()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })

    renderApp()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(2)
  })
})

describe('MobileVerificationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  it('is absent when signed out', async () => {
    renderApp()
    await screen.findByRole('link', { name: /prisma kapitmarket/i })
    expect(screen.queryByText(/verify your mobile number/i)).not.toBeInTheDocument()
  })

  it('is absent when signed in with a verified mobile number', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ mobile_verified: true }) })
    renderApp()
    await screen.findByRole('link', { name: /prisma kapitmarket/i })
    expect(screen.queryByText(/verify your mobile number/i)).not.toBeInTheDocument()
  })

  it('shows and links to /account#mobile-verify when signed in with an unverified mobile number', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ mobile_verified: false }) })
    renderApp()

    expect(await screen.findByText(/verify your mobile number/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /verify now/i })).toHaveAttribute('href', '/account#mobile-verify')
  })
})


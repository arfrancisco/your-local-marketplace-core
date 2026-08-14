import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders just the brand block when signed out', async () => {
    renderApp()

    expect(await screen.findByRole('link', { name: /prisma kapitmarket/i })).toHaveAttribute('href', '/shops')
    expect(screen.queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
  })

  it('renders the same brand-only header when signed in', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()

    expect(await screen.findByRole('link', { name: /prisma kapitmarket/i })).toHaveAttribute('href', '/shops')
    expect(screen.queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument()
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


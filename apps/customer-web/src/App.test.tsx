import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /^menu$/i }))
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  it('shows a Sign in CTA instead of the hamburger when signed out', async () => {
    renderApp()

    expect(await screen.findByRole('link', { name: /prisma kapitmarket/i })).toHaveAttribute('href', '/shops')
    expect(screen.getByRole('button', { name: /^cart, empty$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login')
  })

  it('shows the hamburger instead of the Sign in CTA when signed in', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()

    expect(await screen.findByRole('button', { name: /^menu$/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
  })

  it('shows an explicit Home link in the drawer when signed in', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()
    await openMenu()
    expect(await screen.findByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/shops')
  })

  it('shows a vendor dashboard link (a real <a>, not client-side nav) when the user has a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
      }),
    })
    renderApp()
    await openMenu()

    const link = await screen.findByRole('link', { name: /vendor dashboard/i })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/vendor/shops')
  })

  it('hides the vendor dashboard link for a customer with no vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()
    await openMenu()

    await screen.findByRole('link', { name: /my account/i })
    expect(screen.queryByRole('link', { name: /vendor dashboard/i })).not.toBeInTheDocument()
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

describe('BecomeVendorBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  it('is absent when signed out', async () => {
    renderApp()
    await screen.findByRole('link', { name: /prisma kapitmarket/i })
    expect(screen.queryByText(/turn your kitchen into a shop/i)).not.toBeInTheDocument()
  })

  it('shows and links to /account for a signed-in customer with no vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()

    expect(await screen.findByText(/turn your kitchen into a shop/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /become a vendor/i })).toHaveAttribute('href', '/account')
  })

  it('is absent for a signed-in user who already has a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
      }),
    })
    renderApp()

    await screen.findByRole('link', { name: /prisma kapitmarket/i })
    expect(screen.queryByText(/turn your kitchen into a shop/i)).not.toBeInTheDocument()
  })
})

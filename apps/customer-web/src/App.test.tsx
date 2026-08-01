import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
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
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  it('always shows an explicit Home link, signed in or out', async () => {
    renderApp()
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

    const link = await screen.findByRole('link', { name: /vendor dashboard/i })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/vendor/shops')
  })

  it('hides the vendor dashboard link for a customer with no vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderApp()

    await screen.findByRole('link', { name: /my account/i })
    expect(screen.queryByRole('link', { name: /vendor dashboard/i })).not.toBeInTheDocument()
  })
})

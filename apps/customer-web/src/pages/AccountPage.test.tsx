import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'
import type { User } from '../api/types'

function baseUser(vendorEligibility: User['vendor_eligibility']): User {
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
    last_signed_in_at: '2026-08-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: 1,
      is_resident: true, willing_to_verify_residency: true,
    },
    vendor_profile: null,
    vendor_eligibility: vendorEligibility,
  }
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      requestEmailVerification: vi.fn(),
      confirmEmailVerification: vi.fn(),
      requestMobileVerification: vi.fn(),
      confirmMobileVerification: vi.fn(),
      becomeVendor: vi.fn(),
      listAddresses: vi.fn().mockResolvedValue({ addresses: [] }),
      updateAddress: vi.fn(),
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AuthProvider>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AccountPage vendor eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setToken('fake-token')
  })

  it('shows a "Start selling" action when eligible', async () => {
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ eligible: true, reasons: [] }) })
    renderPage()

    expect(await screen.findByText(/eligible to start selling/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start selling/i })).toBeInTheDocument()
  })

  it('shows the not_resident reason with no action when ineligible', async () => {
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({ eligible: false, reasons: ['not_resident'] }),
    })
    renderPage()

    expect(await screen.findByText(/limited to residents\/tenants of the community/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start selling/i })).not.toBeInTheDocument()
  })

  it('shows a verify-email action when ineligible due to an unverified email', async () => {
    const user = baseUser({ eligible: false, reasons: ['email_not_verified'] })
    user.email_verified = false
    vi.mocked(api.me).mockResolvedValue({ user })
    renderPage()

    expect(await screen.findByText(/verify your email to become eligible/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /verify now/i })).toBeInTheDocument()
  })

  it('redirects a logged-out visitor to sign in', async () => {
    setToken(null)
    renderPage()
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})

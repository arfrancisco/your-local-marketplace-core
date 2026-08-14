import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import { AuthProvider } from '../auth'
import { api, setToken, getToken, ApiError } from '../api/client'
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
    sms_notify_order_accepted: true,
    sms_notify_order_ready: true,
    sms_notify_order_completed: true,
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
      updateMe: vi.fn(),
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
          <Route path="/shops" element={<p>Shops page</p>} />
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

  it('signs out and navigates to /shops, clearing the stored token', async () => {
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ eligible: true, reasons: [] }) })
    renderPage()

    await screen.findByText(/eligible to start selling/i)
    await userEvent.click(screen.getByRole('button', { name: /^sign out$/i }))

    expect(await screen.findByText('Shops page')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })
})

describe('AccountPage notification preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setToken('fake-token')
  })

  it('renders the checkboxes reflecting the fetched user\'s current preferences', async () => {
    const user = baseUser({ eligible: true, reasons: [] })
    user.sms_notify_order_accepted = true
    user.sms_notify_order_ready = false
    user.sms_notify_order_completed = true
    vi.mocked(api.me).mockResolvedValue({ user })
    renderPage()

    expect(await screen.findByRole('checkbox', { name: /order accepted/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /order ready \/ out for delivery/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /order completed/i })).toBeChecked()
  })

  it('saves the toggled preferences via a PATCH to /me', async () => {
    const user = baseUser({ eligible: true, reasons: [] })
    vi.mocked(api.me).mockResolvedValue({ user })
    vi.mocked(api.updateMe).mockResolvedValue({
      user: { ...user, sms_notify_order_accepted: false },
    })
    renderPage()

    const acceptedCheckbox = await screen.findByRole('checkbox', { name: /order accepted/i })
    await userEvent.click(acceptedCheckbox)

    const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
    await userEvent.click(saveButtons[saveButtons.length - 1])

    expect(api.updateMe).toHaveBeenCalledWith({
      sms_notify_order_accepted: false,
      sms_notify_order_ready: true,
      sms_notify_order_completed: true,
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error when saving preferences fails, same as the delivery note save error', async () => {
    const user = baseUser({ eligible: true, reasons: [] })
    vi.mocked(api.me).mockResolvedValue({ user })
    vi.mocked(api.updateMe).mockRejectedValue(new ApiError(422, 'validation_failed', 'Could not save your notification preferences'))
    renderPage()

    const saveButtons = await screen.findAllByRole('button', { name: /^save$/i })
    await userEvent.click(saveButtons[saveButtons.length - 1])

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save your notification preferences/i)
  })
})

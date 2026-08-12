import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HamburgerMenu } from './HamburgerMenu'
import { AuthProvider } from '../auth'
import { api, ApiError, setToken } from '../api/client'
import type { User } from '../api/types'

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

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: { ...actual.api, me: vi.fn(), sendFeedback: vi.fn().mockResolvedValue({ status: 'ok' }), becomeVendor: vi.fn() },
  }
})

function renderMenu() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HamburgerMenu />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /^menu$/i }))
}

describe('HamburgerMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('keeps the nav links out of the page until the hamburger is clicked', async () => {
    renderMenu()

    expect(screen.queryByRole('link', { name: /^home$/i })).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /^menu$/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await openMenu()
    expect(await screen.findByRole('dialog', { name: /^menu$/i })).toHaveClass('drawer')
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/shops')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('offers sign in and create account, and no account links, when signed out', async () => {
    renderMenu()
    await openMenu()

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /my orders/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeInTheDocument()
  })

  it('offers the account links and sign out when signed in', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })

    renderMenu()
    await openMenu()

    expect(await screen.findByRole('link', { name: /my orders/i })).toHaveAttribute('href', '/orders')
    expect(screen.getByRole('link', { name: /my account/i })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('shows a vendor dashboard link (a real <a>, not client-side nav) for a user with a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
      }),
    })

    renderMenu()
    await openMenu()

    const link = await screen.findByRole('link', { name: /vendor dashboard/i })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/vendor/shops')
  })

  it('hides the vendor dashboard link for a customer with no vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })

    renderMenu()
    await openMenu()

    await screen.findByRole('link', { name: /my account/i })
    expect(screen.queryByRole('link', { name: /vendor dashboard/i })).not.toBeInTheDocument()
  })

  it('shows a button-styled "Become a vendor" CTA that triggers the upgrade directly (not just a link to /account), and closes the drawer', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    // Never resolves — the assertion only needs to observe the call, not
    // the subsequent full-page navigation (window.location.href), which
    // jsdom can't actually perform anyway.
    vi.mocked(api.becomeVendor).mockImplementation(() => new Promise(() => {}))

    renderMenu()
    await openMenu()

    const cta = await screen.findByRole('button', { name: /become a vendor/i })
    expect(cta).toHaveClass('link-button')
    await userEvent.click(cta)

    expect(api.becomeVendor).toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: /^menu$/i })).not.toBeInTheDocument()
  })

  it('shows the "Become a vendor" CTA when email verification is the only thing blocking, and opens the verify-email modal on click instead of bouncing to /account', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({ vendor_eligibility: { eligible: false, reasons: ['email_not_verified'] } }),
    })
    vi.mocked(api.becomeVendor).mockRejectedValue(
      new ApiError(403, 'forbidden', 'Not eligible', { reasons: ['email_not_verified'] }),
    )

    renderMenu()
    await openMenu()

    const cta = await screen.findByRole('button', { name: /become a vendor/i })
    await userEvent.click(cta)

    expect(await screen.findByRole('dialog', { name: /verify your email/i })).toBeInTheDocument()
  })

  it('hides the "Become a vendor" CTA for a customer who isn\'t actually eligible (e.g. not a resident)', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({ vendor_eligibility: { eligible: false, reasons: ['not_resident'] } }),
    })

    renderMenu()
    await openMenu()

    await screen.findByRole('link', { name: /my account/i })
    expect(screen.queryByRole('button', { name: /become a vendor/i })).not.toBeInTheDocument()
  })

  it('hides the "Become a vendor" CTA when email_not_verified is blocking alongside another reason (not a one-click fix)', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_eligibility: { eligible: false, reasons: ['email_not_verified', 'not_resident'] },
      }),
    })

    renderMenu()
    await openMenu()

    await screen.findByRole('link', { name: /my account/i })
    expect(screen.queryByRole('button', { name: /become a vendor/i })).not.toBeInTheDocument()
  })

  it('hides the "Become a vendor" CTA once the customer already has a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
      }),
    })

    renderMenu()
    await openMenu()

    await screen.findByRole('link', { name: /vendor dashboard/i })
    expect(screen.queryByRole('link', { name: /become a vendor/i })).not.toBeInTheDocument()
  })

  it('closes the drawer when a link is followed', async () => {
    renderMenu()
    await openMenu()

    await userEvent.click(screen.getByRole('link', { name: /^home$/i }))
    expect(screen.queryByRole('dialog', { name: /^menu$/i })).not.toBeInTheDocument()
  })

  it('closes the drawer when the backdrop is clicked', async () => {
    renderMenu()
    await openMenu()

    const dialog = await screen.findByRole('dialog', { name: /^menu$/i })
    await userEvent.click(dialog.parentElement!)
    expect(screen.queryByRole('dialog', { name: /^menu$/i })).not.toBeInTheDocument()
  })

  it('swaps sign out for sign in after signing out', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })

    renderMenu()
    await openMenu()
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }))

    await openMenu()
    expect(await screen.findByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('opens the feedback modal from the drawer, closing the drawer behind it', async () => {
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(screen.queryByRole('dialog', { name: /^menu$/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

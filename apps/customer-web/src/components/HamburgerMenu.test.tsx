import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HamburgerMenu } from './HamburgerMenu'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'
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
    api: { ...actual.api, me: vi.fn(), sendFeedback: vi.fn().mockResolvedValue({ status: 'ok' }) },
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import type { User } from './api/types'

// The header used to own the ☰ trigger + drawer state (Header in App.tsx);
// both moved into a new self-contained BottomBar, mirroring customer-web's
// own bottom bar. These tests pin down that new ownership/location so a
// future refactor can't silently move the trigger back into the header
// without a test noticing.

let mockUser: User | null = null
const mockLogout = vi.fn()

vi.mock('./auth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, logout: mockLogout }),
}))

const baseUser: User = {
  id: 9,
  email: 'vendor@example.com',
  vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
  sms_notify_order_placed: true,
}

// /account renders with no fetch-on-mount API calls (see AccountPage.tsx —
// it only calls the API on save), so this needs no api/client mocking at
// all, unlike routes such as /shops that fetch on mount.
function renderApp(path = '/account') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = baseUser
  })

  it('signed in: the header is just the brand link, the ☰ trigger lives in the bottom bar instead', () => {
    renderApp()

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Vendor console' })).toBeInTheDocument()
    expect(within(header).queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()

    // Exactly one Menu trigger on the page, and it's outside the header.
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })

  it('clicking the bottom bar trigger opens the nav drawer', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Menu' }))

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  })

  it('signed out: neither the header nor a bottom bar trigger render', () => {
    mockUser = null
    renderApp('/login')

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import { api, ApiError } from '../api/client'
import type { User } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      updateMe: vi.fn(),
    },
  }
})

let mockUser: User | null = null
let mockLoading = false

vi.mock('../auth', () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading }),
}))

const baseUser: User = {
  id: 9,
  email: 'vendor@example.com',
  vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
  sms_notify_order_placed: true,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoading = false
    mockUser = baseUser
  })

  it('renders the SMS notification checkbox reflecting the current user value', async () => {
    renderPage()

    const checkbox = await screen.findByRole('checkbox', { name: /notify me by sms when i get a new order/i })
    expect(checkbox).toBeChecked()
  })

  it('reflects an unchecked value when the user has opted out', async () => {
    mockUser = { ...baseUser, sms_notify_order_placed: false }
    renderPage()

    const checkbox = await screen.findByRole('checkbox', { name: /notify me by sms when i get a new order/i })
    expect(checkbox).not.toBeChecked()
  })

  it('toggling and saving sends the new value to the API', async () => {
    const user = userEvent.setup()
    vi.mocked(api.updateMe).mockResolvedValue({ user: { ...baseUser, sms_notify_order_placed: false } })
    renderPage()

    const checkbox = await screen.findByRole('checkbox', { name: /notify me by sms when i get a new order/i })
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith({ sms_notify_order_placed: false }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error message and leaves the checkbox usable when saving fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.updateMe).mockRejectedValue(new ApiError(500, 'error', 'Could not save your preferences'))
    renderPage()

    const checkbox = await screen.findByRole('checkbox', { name: /notify me by sms when i get a new order/i })
    await user.click(checkbox)
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your preferences')
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument()
  })
})

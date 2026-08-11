import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth'
import { api, ApiError } from '../api/client'

const { user } = vi.hoisted(() => ({
  user: {
    id: 1,
    email: 'neighbor@example.com',
    mobile_number: '09171234567',
    first_name: null,
    last_name: null,
    status: 'active',
    email_verified: false,
    mobile_verified: false,
    email_marketing_opt_in: false,
    sms_marketing_opt_in: false,
    sms_notify_order_accepted: true,
    sms_notify_order_ready: true,
    sms_notify_order_completed: true,
    last_signed_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Neighbor', default_address_id: null,
      is_resident: false, willing_to_verify_residency: null,
    },
    vendor_profile: null,
    vendor_eligibility: { eligible: false, reasons: ['email_not_verified'] },
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      register: vi.fn().mockResolvedValue({ token: 'tok123', user }),
      login: vi.fn(),
      me: vi.fn().mockResolvedValue({ user }),
      requestMobileVerification: vi.fn().mockResolvedValue({}),
      confirmMobileVerification: vi.fn().mockResolvedValue({ user }),
      completeProfile: vi.fn().mockResolvedValue({ user, address: {} }),
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/shops" element={<p>Shops page</p>} />
          <Route path="/forgot-password" element={<p>Forgot password page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function fillScreen1Basics() {
  await userEvent.type(screen.getByLabelText(/^email$/i), 'neighbor@example.com')
  await userEvent.type(screen.getByLabelText(/mobile number/i), '09171234567')
  await userEvent.type(screen.getByLabelText(/^password$/i), 'supersecret')
}

describe('LoginPage registration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('blocks submit when residency is "Yes" but the verification-consent checkbox is unchecked', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /don't have an account/i }))

    await fillScreen1Basics()
    await userEvent.click(screen.getByRole('radio', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /terms and conditions/i }))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/agree to verification/i)
    expect(api.register).not.toHaveBeenCalled()
  })

  it('unblocks once the residency answer changes to "No" instead of checking the consent box', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /don't have an account/i }))

    await fillScreen1Basics()
    await userEvent.click(screen.getByRole('radio', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('radio', { name: 'No' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /terms and conditions/i }))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument()
    expect(api.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'neighbor@example.com', is_resident: false, terms_accepted: true }),
    )
  })

  it('progresses through all 3 screens, requiring mobile verification with no skip option', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /don't have an account/i }))

    await fillScreen1Basics()
    await userEvent.click(screen.getByRole('radio', { name: 'No' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /terms and conditions/i }))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /verify your mobile number/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/verification code/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }))
    expect(api.confirmMobileVerification).toHaveBeenCalledWith('123456')

    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/first name/i), 'Juan')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Dela Cruz')
    await userEvent.type(screen.getByLabelText(/^tower$/i), 'Astra')
    await userEvent.click(screen.getByRole('button', { name: /finish/i }))

    expect(await screen.findByText('Shops page')).toBeInTheDocument()
    expect(api.completeProfile).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Juan', last_name: 'Dela Cruz' }),
    )
  })

  it('shows a sign-in / forgot-password prompt on email_taken instead of a generic error', async () => {
    vi.mocked(api.register).mockRejectedValue(
      new ApiError(409, 'email_taken', 'An account with this email already exists.'),
    )
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /don't have an account/i }))

    await fillScreen1Basics()
    await userEvent.click(screen.getByRole('radio', { name: 'No' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /terms and conditions/i }))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in instead/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /forgot your password/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /sign in instead/i }))
    expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument()
  })
})

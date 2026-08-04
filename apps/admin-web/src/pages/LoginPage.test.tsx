import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth'

const { adminAccount } = vi.hoisted(() => ({
  adminAccount: {
    id: 1,
    email: 'admin@example.com',
    status: 'active',
    first_name: 'Ada',
    last_name: 'Min',
    last_signed_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    getToken: () => null,
    api: {
      ...actual.api,
      login: vi.fn().mockResolvedValue({ token: 'tok123', admin_user: adminAccount }),
    },
  }
})

describe('LoginPage', () => {
  it('signs in with email and password, then redirects to the users page', async () => {
    const { api } = await import('../api/client')

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/users" element={<p>Users page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(api.login).toHaveBeenCalledWith('admin@example.com', 'secret123')
    expect(await screen.findByText('Users page')).toBeInTheDocument()
  })

  it('shows the API error message when login fails', async () => {
    const { api, ApiError } = await import('../api/client')
    vi.mocked(api.login).mockRejectedValueOnce(new ApiError(401, 'invalid_credentials', 'Invalid email or password.'))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/users" element={<p>Users page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i)
  })
})

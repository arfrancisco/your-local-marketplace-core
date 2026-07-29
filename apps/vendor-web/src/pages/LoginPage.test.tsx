import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth'
import { api } from '../api/client'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    getToken: () => null,
    setToken: vi.fn(),
    api: {
      ...actual.api,
      me: vi.fn(),
      login: vi.fn().mockResolvedValue({ token: 't', user: { id: 1, email: 'v@e.com', vendor_profile: null } }),
    },
  }
})

describe('LoginPage', () => {
  it('submits the entered credentials to the API', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'v@e.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(api.login).toHaveBeenCalledWith('v@e.com', 'secret')
  })
})

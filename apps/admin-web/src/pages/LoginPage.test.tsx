import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    getCredentials: () => null,
    setCredentials: vi.fn(),
    clearCredentials: vi.fn(),
    api: {
      ...actual.api,
      listUsers: vi.fn().mockResolvedValue({ users: [], meta: { page: 1, per_page: 50, total_count: 0 } }),
    },
  }
})

describe('LoginPage', () => {
  it('verifies the entered credentials against the admin API before signing in', async () => {
    const { api } = await import('../api/client')

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(api.listUsers).toHaveBeenCalled()
  })
})

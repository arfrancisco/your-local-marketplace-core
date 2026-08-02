import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    getCredentials: () => null,
  }
})

describe('App', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    render(
      <MemoryRouter initialEntries={['/users']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /admin sign in/i })).toBeInTheDocument()
  })
})

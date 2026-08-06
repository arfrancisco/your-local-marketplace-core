import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('is a static splash — shows the no-payment framing and links straight to shop creation', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/there's no payment in this app/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/shops/new')
  })
})

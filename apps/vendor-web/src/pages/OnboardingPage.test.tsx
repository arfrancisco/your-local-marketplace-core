import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  function renderSplash() {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )
  }

  it('shows the no-payment framing and hands off to the wizard\'s first step', () => {
    renderSplash()

    expect(screen.getByText(/there's no payment in this app/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/onboarding/shop')
  })

  it('places payment setup in the last step, not the next one', () => {
    renderSplash()

    expect(screen.getByText(/set that up as your shop's "opening message" in the last step/i)).toBeInTheDocument()
    expect(screen.queryByText(/in the next step/i)).not.toBeInTheDocument()
  })

  it('is a splash, not a wizard step — no stepper of its own', () => {
    renderSplash()

    expect(screen.queryByText(/step 1 of/i)).not.toBeInTheDocument()
    expect(screen.getByText(/takes about 4 short steps/i)).toBeInTheDocument()
  })
})

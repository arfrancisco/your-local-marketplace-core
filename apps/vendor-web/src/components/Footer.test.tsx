import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Footer } from './Footer'

describe('Footer', () => {
  it('opens FeedbackModal when "Send feedback" is clicked — moved here from the retired hamburger drawer', async () => {
    const user = userEvent.setup()
    render(<Footer />)

    expect(screen.queryByRole('dialog', { name: /send feedback/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^send feedback$/i }))

    expect(screen.getByRole('dialog', { name: /send feedback/i })).toBeInTheDocument()
  })
})

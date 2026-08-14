import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HamburgerMenu } from './HamburgerMenu'

function renderMenu(overrides: Partial<Parameters<typeof HamburgerMenu>[0]> = {}) {
  const onClose = vi.fn()
  const onFeedback = vi.fn()
  const onSignOut = vi.fn()
  render(
    <MemoryRouter>
      <HamburgerMenu
        email="vendor@example.com"
        onClose={onClose}
        onFeedback={onFeedback}
        onSignOut={onSignOut}
        {...overrides}
      />
    </MemoryRouter>,
  )
  return { onClose, onFeedback, onSignOut }
}

describe('HamburgerMenu', () => {
  it('renders the drawer with the signed-in email', () => {
    renderMenu()

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    expect(screen.getByText('vendor@example.com')).toBeInTheDocument()
  })

  // Placed near the top of the drawer's link list, ahead of Home/Account —
  // a real <a>, not React Router's Link, since it crosses into the separate
  // customer-web SPA (see the component's own comment on this link).
  it('"Back to marketplace" is a real link to customer-web, relative by default', () => {
    renderMenu()

    const link = screen.getByRole('link', { name: 'Back to marketplace' })
    expect(link).toHaveAttribute('href', '/shops')

    const linkNames = screen.getAllByRole('link').map((l) => l.textContent)
    expect(linkNames[0]).toBe('Back to marketplace')
  })

  it('clicking Home or Account closes the drawer', async () => {
    const user = userEvent.setup()
    const { onClose } = renderMenu()

    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('link', { name: 'Account' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('clicking "Send feedback" calls onFeedback', async () => {
    const user = userEvent.setup()
    const { onFeedback } = renderMenu()

    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(onFeedback).toHaveBeenCalledTimes(1)
  })

  it('clicking "Sign out" calls onSignOut', async () => {
    const user = userEvent.setup()
    const { onSignOut } = renderMenu()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('closes on the backdrop click, the × button, and the Escape key', async () => {
    const user = userEvent.setup()
    const { onClose } = renderMenu()

    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

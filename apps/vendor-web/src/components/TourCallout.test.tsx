import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourCallout } from './TourCallout'

describe('TourCallout', () => {
  it('advances via the next button without skipping', async () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()
    render(<TourCallout message="Hello there" onNext={onNext} onSkip={onSkip} />)

    expect(screen.getByText('Hello there')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('dismisses via the close control without advancing', async () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()
    render(<TourCallout message="Hello there" onNext={onNext} onSkip={onSkip} />)

    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('supports a custom next label and a stronger visual style for high-priority callouts', () => {
    const { container } = render(
      <TourCallout message="Pay attention" onNext={vi.fn()} onSkip={vi.fn()} nextLabel="Next" strong />,
    )

    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    expect(container.querySelector('.tour-callout.strong')).toBeInTheDocument()
  })
})

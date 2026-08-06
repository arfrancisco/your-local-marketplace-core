import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderStatusStepper } from './OrderStatusStepper'

describe('OrderStatusStepper', () => {
  it('shows the pickup step, not the delivery step, as current for a pickup order', () => {
    render(<OrderStatusStepper status="ready_for_pickup" fulfillmentMethod="pickup" acceptedAt="2026-08-01T00:00:00Z" />)

    const readyStep = screen.getByText('Ready for pickup').closest('li')
    const deliveryStep = screen.getByText('Out for delivery').closest('li')
    expect(readyStep).toHaveClass('step-current')
    expect(deliveryStep).toHaveClass('step-skipped')
  })

  it('shows the delivery step, not the pickup step, as current for a delivery order', () => {
    render(<OrderStatusStepper status="out_for_delivery" fulfillmentMethod="delivery" acceptedAt="2026-08-01T00:00:00Z" />)

    const readyStep = screen.getByText('Ready for pickup').closest('li')
    const deliveryStep = screen.getByText('Out for delivery').closest('li')
    expect(readyStep).toHaveClass('step-skipped')
    expect(deliveryStep).toHaveClass('step-current')
  })

  it('marks earlier steps done and later steps upcoming around the current one', () => {
    render(<OrderStatusStepper status="preparing" fulfillmentMethod="pickup" acceptedAt="2026-08-01T00:00:00Z" />)

    expect(screen.getByText('Placed').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Accepted').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Preparing').closest('li')).toHaveClass('step-current')
    expect(screen.getByText('Ready for pickup').closest('li')).toHaveClass('step-upcoming')
    expect(screen.getByText('Completed').closest('li')).toHaveClass('step-upcoming')
  })

  it('marks a completed order done rather than "current" on its final step', () => {
    render(<OrderStatusStepper status="completed" fulfillmentMethod="pickup" acceptedAt="2026-08-01T00:00:00Z" />)
    expect(screen.getByText('Completed').closest('li')).toHaveClass('step-done')
  })

  it('shows only Placed then a terminal Rejected step for a rejected order', () => {
    render(<OrderStatusStepper status="rejected" fulfillmentMethod="pickup" acceptedAt={null} />)

    expect(screen.getByText('Placed').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Rejected').closest('li')).toHaveClass('step-terminal')
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument()
    expect(screen.queryByText('Preparing')).not.toBeInTheDocument()
  })

  it('shows Placed, Accepted done then a terminal Cancelled step when cancelled after acceptance', () => {
    render(<OrderStatusStepper status="cancelled" fulfillmentMethod="delivery" acceptedAt="2026-08-01T00:00:00Z" />)

    expect(screen.getByText('Placed').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Accepted').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Cancelled').closest('li')).toHaveClass('step-terminal')
    expect(screen.queryByText('Preparing')).not.toBeInTheDocument()
  })

  it('shows only Placed then a terminal Cancelled step when cancelled before acceptance', () => {
    render(<OrderStatusStepper status="cancelled" fulfillmentMethod="delivery" acceptedAt={null} />)

    expect(screen.getByText('Placed').closest('li')).toHaveClass('step-done')
    expect(screen.getByText('Cancelled').closest('li')).toHaveClass('step-terminal')
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument()
  })
})

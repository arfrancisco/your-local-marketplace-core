import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustomerSummary } from './CustomerSummary'

describe('CustomerSummary', () => {
  it('renders name and building/unit plainly, with no "current as of" caveat', () => {
    render(<CustomerSummary name="Juan Dela Cruz" building="Tower A" unit="12F" isResident />)
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Tower A, Unit 12F')).toBeInTheDocument()
    expect(screen.queryByText(/current/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Not a resident')).not.toBeInTheDocument()
  })

  it('renders "No address on file" when there is no default address, without omitting the line', () => {
    render(<CustomerSummary name="Maria Santos" building={null} unit={null} isResident={false} />)
    expect(screen.getByText('No address on file')).toBeInTheDocument()
  })

  it('shows the non-resident badge only when the customer is not a resident', () => {
    render(<CustomerSummary name="Maria Santos" building={null} unit={null} isResident={false} />)
    expect(screen.getByText('Not a resident')).toBeInTheDocument()
  })

  it('suppresses the non-resident badge when showResidentBadge is false', () => {
    render(
      <CustomerSummary name="Maria Santos" building={null} unit={null} isResident={false} showResidentBadge={false} />,
    )
    expect(screen.queryByText('Not a resident')).not.toBeInTheDocument()
  })

  it('renders building without a unit when unit is null', () => {
    render(<CustomerSummary name="Juan Dela Cruz" building="Tower A" unit={null} isResident />)
    expect(screen.getByText('Tower A')).toBeInTheDocument()
    expect(screen.queryByText(/Unit/)).not.toBeInTheDocument()
  })
})

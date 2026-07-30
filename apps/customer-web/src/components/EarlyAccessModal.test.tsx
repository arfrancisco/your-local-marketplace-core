import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EarlyAccessModal } from './EarlyAccessModal'
import { api } from '../api/client'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: { ...actual.api, earlyAccess: vi.fn().mockResolvedValue({ status: 'registered' }) },
  }
})

const earlyAccess = vi.mocked(api.earlyAccess)

describe('EarlyAccessModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits the signup with the captured context and confirms success', async () => {
    render(<EarlyAccessModal open onClose={() => {}} context="Lola's Kitchen — Chicken Adobo Bowl" />)

    await userEvent.type(screen.getByLabelText('Email'), 'neighbor@example.com')
    await userEvent.click(screen.getByRole('button', { name: /join early access/i }))

    expect(earlyAccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'neighbor@example.com', context: "Lola's Kitchen — Chicken Adobo Bowl" }),
    )
    expect(await screen.findByText(/on the list/i)).toBeInTheDocument()
  })

  it('requires at least an email or a mobile number', async () => {
    render(<EarlyAccessModal open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /join early access/i }))
    expect(earlyAccess).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

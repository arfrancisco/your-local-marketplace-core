import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrderDetailPage } from './OrderDetailPage'
import { api } from '../api/client'
import type { Order, VendorCustomerNote } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getOrder: vi.fn(),
      listCustomerNotes: vi.fn(),
      createCustomerNote: vi.fn(),
      deleteCustomerNote: vi.fn(),
    },
  }
})

// Chat opens a real ActionCable connection; irrelevant to these assertions.
vi.mock('../OrderChat', () => ({ OrderChat: () => <div /> }))

vi.mock('../auth', () => ({
  useAuth: () => ({ user: { id: 9, email: 'v@example.com', vendor_profile: null } }),
}))

const order: Order = {
  id: 42,
  public_reference: 'ORD-ABC12345',
  shop_id: 5,
  customer_profile_id: 77,
  status: 'placed',
  can_transition_to: [],
  fulfillment_method: 'pickup',
  subtotal_cents: 10000,
  total_cents: 10000,
  currency: 'PHP',
  payment_status: 'unpaid',
  customer_note: null,
  vendor_note: null,
  items: [],
  opening_message: null,
  opening_message_photos: [],
  placed_at: '2026-08-01T00:00:00Z',
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  conversation_id: null,
  rating: null,
}

const note: VendorCustomerNote = {
  id: 3,
  customer_profile_id: 77,
  order_id: 42,
  note: 'No-showed for pickup.',
  flagged: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/42']}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OrderDetailPage private customer notes', () => {
  beforeEach(() => {
    vi.mocked(api.getOrder).mockResolvedValue({ order })
    vi.mocked(api.listCustomerNotes).mockResolvedValue({ customer_notes: [note] })
  })

  it('states plainly that notes are private to this vendor', async () => {
    renderPage()
    expect(
      await screen.findByText(/Only visible to you — never shown to the customer or other vendors/i),
    ).toBeInTheDocument()
  })

  it('loads notes scoped to this order’s customer', async () => {
    renderPage()
    expect(await screen.findByText(/No-showed for pickup/)).toBeInTheDocument()
    expect(api.listCustomerNotes).toHaveBeenCalledWith(77)
  })

  it('adds a note flagged as a problem customer', async () => {
    const created = { ...note, id: 4, note: 'Suspected scam attempt.' }
    vi.mocked(api.createCustomerNote).mockResolvedValue({ customer_note: created })

    renderPage()
    await screen.findByText(/No-showed for pickup/)

    await userEvent.type(screen.getByLabelText(/Add a private note/i), 'Suspected scam attempt.')
    await userEvent.click(screen.getByLabelText(/Flag as problem customer/i))
    await userEvent.click(screen.getByRole('button', { name: /Save note/i }))

    expect(api.createCustomerNote).toHaveBeenCalledWith(42, 'Suspected scam attempt.', true)
    expect(await screen.findByText(/Suspected scam attempt/)).toBeInTheDocument()
  })

  it('deletes a note', async () => {
    vi.mocked(api.deleteCustomerNote).mockResolvedValue(null)
    renderPage()
    await screen.findByText(/No-showed for pickup/)

    await userEvent.click(screen.getByRole('button', { name: /Delete note 3/i }))

    expect(api.deleteCustomerNote).toHaveBeenCalledWith(3)
    expect(screen.queryByText(/No-showed for pickup/)).not.toBeInTheDocument()
  })
})

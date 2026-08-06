import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrderPlacedPage } from './OrderPlacedPage'
import { api } from '../api/client'

const order = {
  id: 7,
  public_reference: 'ORD-ABC12345',
  shop_id: 1,
  shop_name: 'Adobo Republic',
  shop_building: 'Celeste',
  shop_profile_photo: null,
  shop_average_rating: null,
  shop_ratings_count: 0,
  status: 'placed',
  can_transition_to: ['accepted', 'cancelled'],
  fulfillment_method: 'pickup',
  subtotal_cents: 18000,
  total_cents: 18000,
  currency: 'PHP',
  payment_status: 'unpaid',
  customer_note: null,
  vendor_note: null,
  items: [{ id: 1, item_id: 10, name: 'Adobo Bowl', unit_price_cents: 18000, quantity: 1, line_total_cents: 18000 }],
  opening_message: null,
  opening_message_photos: [],
  placed_at: '2026-08-06T00:00:00Z',
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  conversation_id: 3,
  has_unread_messages: false,
  rating: null,
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getOrder: vi.fn(),
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/7/placed']}>
      <Routes>
        <Route path="/orders/:id/placed" element={<OrderPlacedPage />} />
        <Route path="/orders/:id" element={<p>Order page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OrderPlacedPage', () => {
  it('confirms the order was placed and links through to the real order page', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({ order: order as never })

    renderPage()

    expect(await screen.findByRole('heading', { name: /order placed/i })).toBeInTheDocument()
    expect(screen.getByText(/Adobo Republic/)).toBeInTheDocument()
    expect(screen.getByText(/wait for/i)).toBeInTheDocument()

    const viewOrderLink = screen.getByRole('link', { name: /view order/i })
    expect(viewOrderLink).toHaveAttribute('href', '/orders/7')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrderPage } from './OrderPage'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'

const { baseOrder, user } = vi.hoisted(() => ({
  baseOrder: {
    id: 7,
    public_reference: 'ORD-ABC12345',
    shop_id: 1,
    shop_name: 'Adobo Republic',
    shop_building: 'Celeste',
    shop_profile_photo: null,
    shop_average_rating: null,
    shop_ratings_count: 0,
    status: 'completed',
    can_transition_to: [],
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
    placed_at: '2026-08-01T00:00:00Z',
    accepted_at: null,
    completed_at: '2026-08-02T00:00:00Z',
    cancelled_at: null,
    conversation_id: 3,
    rating: null,
  },
  user: {
    id: 5,
    email: 'neighbor@example.com',
    customer_profile: { id: 1, display_name: 'Neighbor', default_address_id: null },
  },
}))

// The chat is exercised in OrderChat.test.tsx; stub it here so this stays
// focused on the rating card and doesn't need an ActionCable connection.
vi.mock('../OrderChat', () => ({ OrderChat: () => <div>chat</div> }))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn().mockResolvedValue({ user }),
      getOrder: vi.fn(),
      cancelOrder: vi.fn(),
      rateOrder: vi.fn(),
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/7']}>
      <AuthProvider>
        <Routes>
          <Route path="/orders/:id" element={<OrderPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('OrderPage rating card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken('test-token')
    vi.mocked(api.me).mockResolvedValue({ user } as never)
  })

  it('submits a score and comment, then shows the rating read-only', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({ order: baseOrder } as never)
    vi.mocked(api.rateOrder).mockResolvedValue({
      rating: { id: 1, score: 4, comment: 'Great food.', reviewer_display_name: 'Neighbor', created_at: '2026-08-02T01:00:00Z' },
    } as never)

    renderPage()

    await screen.findByText('Rate this order')
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }))
    await userEvent.type(screen.getByLabelText('Review comment'), 'Great food.')
    await userEvent.click(screen.getByRole('button', { name: /submit rating/i }))

    expect(api.rateOrder).toHaveBeenCalledWith(7, 4, 'Great food.')
    expect(await screen.findByText('You rated this order.')).toBeInTheDocument()
    expect(screen.queryByText('Rate this order')).not.toBeInTheDocument()
  })

  it('will not submit without a score', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({ order: baseOrder } as never)
    renderPage()

    await screen.findByText('Rate this order')
    expect(screen.getByRole('button', { name: /submit rating/i })).toBeDisabled()
  })

  it('shows an existing rating read-only instead of the form', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({
      order: {
        ...baseOrder,
        rating: { id: 2, score: 5, comment: 'Perfect.', reviewer_display_name: 'Neighbor', created_at: '2026-08-02T01:00:00Z' },
      },
    } as never)

    renderPage()

    expect(await screen.findByText('Your rating')).toBeInTheDocument()
    expect(screen.getByText('Perfect.')).toBeInTheDocument()
    expect(screen.queryByText('Rate this order')).not.toBeInTheDocument()
  })

  it('offers no rating card on an order that is not completed', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({
      order: { ...baseOrder, status: 'placed', can_transition_to: ['cancelled'] },
    } as never)

    renderPage()

    await screen.findByText(/ORD-ABC12345/)
    expect(screen.queryByText('Rate this order')).not.toBeInTheDocument()
    expect(screen.queryByText('Your rating')).not.toBeInTheDocument()
  })
})

describe('OrderPage cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken('test-token')
    vi.mocked(api.me).mockResolvedValue({ user } as never)
    vi.mocked(api.getOrder).mockResolvedValue({
      order: { ...baseOrder, status: 'placed', can_transition_to: ['cancelled'] },
    } as never)
  })

  it('blocks submit until a reason is selected', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))
    const submit = screen.getByRole('button', { name: /cancel order/i })
    expect(submit).toBeDisabled()
  })

  it('requires free text only when "Other" is selected', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))
    const select = screen.getByLabelText('Reason')
    const submit = screen.getByRole('button', { name: /cancel order/i })

    await userEvent.selectOptions(select, 'changed_mind')
    expect(submit).not.toBeDisabled()

    await userEvent.selectOptions(select, 'other')
    expect(submit).toBeDisabled()
    expect(screen.getByLabelText('Tell us more')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Tell us more'), 'Ordering somewhere else instead')
    expect(submit).not.toBeDisabled()
  })

  it('submits the reason and closes the modal on success', async () => {
    vi.mocked(api.cancelOrder).mockResolvedValue({
      order: { ...baseOrder, status: 'cancelled', can_transition_to: [] },
    } as never)

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'changed_mind')
    await userEvent.click(screen.getByRole('button', { name: /cancel order/i }))

    expect(api.cancelOrder).toHaveBeenCalledWith(7, { reason_code: 'changed_mind', reason: undefined })
    expect(await screen.findByText('cancelled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument()
  })
})

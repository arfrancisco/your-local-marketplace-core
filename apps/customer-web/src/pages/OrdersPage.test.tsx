import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrdersPage } from './OrdersPage'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'
import type { Order, User } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listOrders: vi.fn(),
    },
  }
})

function baseUser(): User {
  return {
    id: 1,
    email: 'neighbor@example.com',
    mobile_number: '09171234567',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    status: 'active',
    email_verified: true,
    mobile_verified: true,
    email_marketing_opt_in: false,
    sms_marketing_opt_in: false,
    sms_notify_order_accepted: true,
    sms_notify_order_ready: true,
    sms_notify_order_completed: true,
    last_signed_in_at: '2026-08-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: 1,
      is_resident: true, willing_to_verify_residency: true,
    },
    vendor_profile: null,
    vendor_eligibility: { eligible: true, reasons: [] },
  }
}

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 1,
    public_reference: 'ORD-AAA11111',
    shop_id: 5,
    shop_name: 'Pizza My Heart',
    shop_building: 'Astra',
    shop_profile_photo: null,
    shop_average_rating: null,
    shop_ratings_count: 0,
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
    has_unread_messages: false,
    rating: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <AuthProvider>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setToken('fake-token')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
  })

  it('redirects a logged-out visitor to sign in', async () => {
    setToken(null)
    renderPage()
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('renders the empty state when there are no orders, with no filter pills', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
    renderPage()
    expect(await screen.findByText(/No orders yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^All/ })).not.toBeInTheDocument()
  })

  it('filters pills correctly, including a bucket pill matching multiple statuses', async () => {
    const placed = makeOrder({ id: 1, public_reference: 'ORD-PLACED01', status: 'placed' })
    const accepted = makeOrder({ id: 2, public_reference: 'ORD-ACCEPT02', status: 'accepted' })
    const preparing = makeOrder({ id: 3, public_reference: 'ORD-PREPAR03', status: 'preparing' })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [placed, accepted, preparing] })

    renderPage()
    await screen.findByText('ORD-PLACED01')

    await userEvent.click(screen.getByRole('button', { name: /^In progress/ }))
    expect(screen.queryByText('ORD-PLACED01')).not.toBeInTheDocument()
    expect(screen.getByText('ORD-ACCEPT02')).toBeInTheDocument()
    expect(screen.getByText('ORD-PREPAR03')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Waiting/ }))
    expect(screen.getByText('ORD-PLACED01')).toBeInTheDocument()
    expect(screen.queryByText('ORD-ACCEPT02')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^All/ }))
    expect(screen.getByText('ORD-PLACED01')).toBeInTheDocument()
    expect(screen.getByText('ORD-ACCEPT02')).toBeInTheDocument()
    expect(screen.getByText('ORD-PREPAR03')).toBeInTheDocument()
  })

  it('"All" hides completed/cancelled orders (still reachable via the dropdown), and pill/dropdown labels show counts', async () => {
    const placed = makeOrder({ id: 1, public_reference: 'ORD-PLACED03', status: 'placed' })
    const completed = makeOrder({ id: 2, public_reference: 'ORD-DONE0002', status: 'completed' })
    const cancelled = makeOrder({ id: 3, public_reference: 'ORD-CANCEL03', status: 'cancelled' })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [placed, completed, cancelled] })

    renderPage()
    await screen.findByText('ORD-PLACED03')

    expect(screen.queryByText('ORD-DONE0002')).not.toBeInTheDocument()
    expect(screen.queryByText('ORD-CANCEL03')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All (1)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Completed (1)' })).toBeInTheDocument()

    const select = screen.getByLabelText('More status filters')
    await userEvent.selectOptions(select, 'terminal')
    expect(screen.getByText('ORD-CANCEL03')).toBeInTheDocument()
  })

  it('applies the status bucket class to both the card left-border and the status badge', async () => {
    const order = makeOrder({ id: 1, public_reference: 'ORD-READY001', status: 'ready_for_pickup' })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [order] })

    renderPage()
    const card = (await screen.findByText('ORD-READY001')).closest('li')
    expect(card).toHaveClass('order-card', 'status-ready')
    expect(screen.getByText('ready for pickup')).toHaveClass('order-status-badge', 'status-ready')
  })

  it('shows the unread dot only for orders with has_unread_messages: true', async () => {
    const unread = makeOrder({ id: 1, public_reference: 'ORD-UNREAD1', has_unread_messages: true })
    const read = makeOrder({ id: 2, public_reference: 'ORD-READ0002', has_unread_messages: false })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [unread, read] })

    renderPage()
    const unreadCard = (await screen.findByText('ORD-UNREAD1')).closest('li')
    const readCard = (await screen.findByText('ORD-READ0002')).closest('li')

    expect(unreadCard?.querySelector('.unread-dot')).toBeInTheDocument()
    expect(readCard?.querySelector('.unread-dot')).not.toBeInTheDocument()
  })

  it('shows a Rate badge for a completed, unrated order', async () => {
    const order = makeOrder({ id: 1, public_reference: 'ORD-DONE0001', status: 'completed', rating: null })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [order] })

    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('More status filters'), 'done')

    const card = screen.getByText('ORD-DONE0001').closest('li')
    expect(card?.querySelector('.rate-badge')).toBeInTheDocument()
  })

  it('hides the Rate badge once the order has a rating', async () => {
    const order = makeOrder({
      id: 1,
      public_reference: 'ORD-DONE0002',
      status: 'completed',
      rating: { id: 1, score: 5, comment: null, reviewer_display_name: 'Neighbor', created_at: '2026-08-02T00:00:00Z' },
    })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [order] })

    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('More status filters'), 'done')

    const card = screen.getByText('ORD-DONE0002').closest('li')
    expect(card?.querySelector('.rate-badge')).not.toBeInTheDocument()
  })

  it('does not show the Rate badge for a non-completed order', async () => {
    const order = makeOrder({ id: 1, public_reference: 'ORD-PLACED09', status: 'placed', rating: null })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [order] })

    renderPage()
    const card = (await screen.findByText('ORD-PLACED09')).closest('li')
    expect(card?.querySelector('.rate-badge')).not.toBeInTheDocument()
  })

  it('shows both the unread dot and the Rate badge together without collision', async () => {
    const order = makeOrder({
      id: 1,
      public_reference: 'ORD-BOTH0001',
      status: 'completed',
      rating: null,
      has_unread_messages: true,
    })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [order] })

    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('More status filters'), 'done')

    const card = screen.getByText('ORD-BOTH0001').closest('li')
    expect(card?.querySelector('.unread-dot')).toBeInTheDocument()
    expect(card?.querySelector('.rate-badge')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { OrderList } from './OrderList'
import { api } from '../api/client'
import type { Order } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listVendorOrders: vi.fn(),
    },
  }
})

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 1,
    public_reference: 'ORD-AAA11111',
    shop_id: 5,
    customer_profile_id: 77,
    customer_name: 'Juan Dela Cruz',
    customer_is_resident: true,
    customer_building: 'Tower A',
    customer_unit: '12F',
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
    ...overrides,
  }
}

function renderList() {
  return render(
    <MemoryRouter>
      <OrderList shopId={1} />
    </MemoryRouter>,
  )
}

describe('OrderList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders exactly "No orders yet." when there are none, for ShopDashboardPage compatibility', async () => {
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
    renderList()
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument()
  })

  it('filters pills correctly, including a bucket pill matching multiple statuses', async () => {
    const placed = makeOrder({ id: 1, public_reference: 'ORD-PLACED01', status: 'placed' })
    const accepted = makeOrder({ id: 2, public_reference: 'ORD-ACCEPT02', status: 'accepted' })
    const preparing = makeOrder({ id: 3, public_reference: 'ORD-PREPAR03', status: 'preparing' })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [placed, accepted, preparing] })

    renderList()
    await screen.findByText('ORD-PLACED01')

    // "In progress" pill matches both accepted and preparing. Pill labels
    // now carry a "(count)" suffix, so match by prefix rather than the
    // exact accessible name.
    await userEvent.click(screen.getByRole('button', { name: /^In progress/ }))
    expect(screen.queryByText('ORD-PLACED01')).not.toBeInTheDocument()
    expect(screen.getByText('ORD-ACCEPT02')).toBeInTheDocument()
    expect(screen.getByText('ORD-PREPAR03')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Needs action/ }))
    expect(screen.getByText('ORD-PLACED01')).toBeInTheDocument()
    expect(screen.queryByText('ORD-ACCEPT02')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^All/ }))
    expect(screen.getByText('ORD-PLACED01')).toBeInTheDocument()
    expect(screen.getByText('ORD-ACCEPT02')).toBeInTheDocument()
    expect(screen.getByText('ORD-PREPAR03')).toBeInTheDocument()
  })

  it('filters via the dropdown and resets it when a pill is chosen instead', async () => {
    const completed = makeOrder({ id: 1, public_reference: 'ORD-DONE0001', status: 'completed' })
    const placed = makeOrder({ id: 2, public_reference: 'ORD-PLACED02', status: 'placed' })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [completed, placed] })

    renderList()
    await screen.findByText('ORD-PLACED02')
    // Completed orders are hidden from the default "All" view — see the
    // dedicated test below for this behavior; here it just means we can't
    // wait on the completed order's text before it's ever shown.
    expect(screen.queryByText('ORD-DONE0001')).not.toBeInTheDocument()

    const select = screen.getByLabelText('More status filters')
    await userEvent.selectOptions(select, 'done')
    expect(screen.getByText('ORD-DONE0001')).toBeInTheDocument()
    expect(screen.queryByText('ORD-PLACED02')).not.toBeInTheDocument()
    expect(select).toHaveValue('done')

    await userEvent.click(screen.getByRole('button', { name: /^Needs action/ }))
    expect(select).toHaveValue('')
    expect(screen.getByText('ORD-PLACED02')).toBeInTheDocument()
  })

  it('"All" hides completed orders (still reachable via the dropdown), and pill/dropdown labels show counts', async () => {
    const placed = makeOrder({ id: 1, public_reference: 'ORD-PLACED03', status: 'placed' })
    const completed1 = makeOrder({ id: 2, public_reference: 'ORD-DONE0002', status: 'completed' })
    const completed2 = makeOrder({ id: 3, public_reference: 'ORD-DONE0003', status: 'completed' })
    const cancelled = makeOrder({ id: 4, public_reference: 'ORD-CANCEL04', status: 'cancelled' })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [placed, completed1, completed2, cancelled] })

    renderList()
    await screen.findByText('ORD-PLACED03')

    // "All" is just the combined pill buckets — completed and rejected/
    // cancelled orders are both excluded, only reachable via the dropdown.
    expect(screen.queryByText('ORD-DONE0002')).not.toBeInTheDocument()
    expect(screen.queryByText('ORD-DONE0003')).not.toBeInTheDocument()
    expect(screen.queryByText('ORD-CANCEL04')).not.toBeInTheDocument()

    // All (1) = just the placed order (needs_action + in_progress + ready).
    expect(screen.getByRole('button', { name: 'All (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Needs action (1)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Completed (2)' })).toBeInTheDocument()

    const select = screen.getByLabelText('More status filters')
    await userEvent.selectOptions(select, 'terminal')
    expect(screen.getByText('ORD-CANCEL04')).toBeInTheDocument()
  })

  it('shows the customer name, building/unit, and non-resident badge only when applicable', async () => {
    const resident = makeOrder({
      id: 1,
      public_reference: 'ORD-RESIDE01',
      customer_name: 'Juan Dela Cruz',
      customer_is_resident: true,
      customer_building: 'Tower A',
      customer_unit: '12F',
    })
    const nonResidentNoAddress = makeOrder({
      id: 2,
      public_reference: 'ORD-NORES002',
      customer_name: 'Maria Santos',
      customer_is_resident: false,
      customer_building: null,
      customer_unit: null,
    })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [resident, nonResidentNoAddress] })

    renderList()
    await screen.findByText('ORD-RESIDE01')

    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText(/Tower A, Unit 12F/)).toBeInTheDocument()

    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('No address on file')).toBeInTheDocument()
    expect(screen.getAllByText('Not a resident')).toHaveLength(1)
  })

  it('applies the status bucket class to both the card left-border and the status badge', async () => {
    const order = makeOrder({ id: 1, public_reference: 'ORD-READY001', status: 'ready_for_pickup' })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [order] })

    renderList()
    const card = (await screen.findByText('ORD-READY001')).closest('li')
    expect(card).toHaveClass('order-card', 'status-ready')

    expect(screen.getByText('ready for pickup')).toHaveClass('order-status-badge', 'status-ready')
  })
})

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
      transitionOrder: vi.fn(),
      listItems: vi.fn(),
      updateOrderItems: vi.fn(),
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

describe('OrderDetailPage cancellation', () => {
  beforeEach(() => {
    vi.mocked(api.getOrder).mockResolvedValue({
      order: { ...order, status: 'placed', can_transition_to: ['accepted', 'cancelled'] },
    })
    vi.mocked(api.listCustomerNotes).mockResolvedValue({ customer_notes: [] })
  })

  it('opens the reason modal instead of transitioning directly', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))

    expect(screen.getByLabelText('Reason')).toBeInTheDocument()
    expect(api.transitionOrder).not.toHaveBeenCalled()
  })

  it('requires free text only when "Other" is selected', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))
    const select = screen.getByLabelText('Reason')
    const submit = screen.getByRole('button', { name: /cancel order/i })

    await userEvent.selectOptions(select, 'item_unavailable')
    expect(submit).not.toBeDisabled()

    await userEvent.selectOptions(select, 'other')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Tell us more'), 'Fridge broke down overnight')
    expect(submit).not.toBeDisabled()
  })

  it('submits the reason via transitionOrder and closes the modal', async () => {
    vi.mocked(api.transitionOrder).mockResolvedValue({
      order: { ...order, status: 'cancelled', can_transition_to: [] },
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel order' }))
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'item_unavailable')
    await userEvent.click(screen.getByRole('button', { name: /cancel order/i }))

    expect(api.transitionOrder).toHaveBeenCalledWith(42, 'cancelled', { reason_code: 'item_unavailable', reason: undefined })
    expect(await screen.findByText('cancelled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument()
  })

  it('leaves other transitions (e.g. accept) untouched by the modal', async () => {
    vi.mocked(api.transitionOrder).mockResolvedValue({
      order: { ...order, status: 'accepted', can_transition_to: [] },
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))

    expect(api.transitionOrder).toHaveBeenCalledWith(42, 'accepted')
    expect(await screen.findByText('accepted')).toBeInTheDocument()
  })
})

describe('OrderDetailPage item edits', () => {
  const editableOrder: Order = {
    ...order,
    status: 'placed',
    can_transition_to: ['accepted', 'cancelled'],
    items: [
      { id: 1, item_id: 10, name: 'Adobo Bowl', unit_price_cents: 15_000, quantity: 1, line_total_cents: 15_000 },
    ],
    subtotal_cents: 15_000,
    total_cents: 15_000,
  }

  const catalog = [
    { id: 10, shop_id: 5, name: 'Adobo Bowl', description: null, price_cents: 15_000, currency: 'PHP', enabled: true, archived: false, stock_count: null, sold_out: false, position: 0, tags: [], photos: [] },
    { id: 11, shop_id: 5, name: 'Halo-Halo', description: null, price_cents: 8_000, currency: 'PHP', enabled: true, archived: false, stock_count: null, sold_out: false, position: 1, tags: [], photos: [] },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getOrder).mockResolvedValue({ order: editableOrder })
    vi.mocked(api.listCustomerNotes).mockResolvedValue({ customer_notes: [] })
    vi.mocked(api.listItems).mockResolvedValue({ items: catalog })
  })

  it('offers an "Edit order" affordance (behind the order-details kebab) while the order is still editable', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    expect(screen.getByRole('menuitem', { name: 'Edit order' })).toBeInTheDocument()
  })

  it('hides the order-details kebab entirely once the order is out for delivery', async () => {
    vi.mocked(api.getOrder).mockResolvedValue({
      order: { ...editableOrder, status: 'out_for_delivery', can_transition_to: ['completed'] },
    })
    renderPage()
    await screen.findByText('out for delivery')
    expect(screen.queryByRole('button', { name: 'Order actions menu' })).not.toBeInTheDocument()
  })

  it('adds a new item, adjusts a quantity, and saves both changes in one call', async () => {
    vi.mocked(api.updateOrderItems).mockResolvedValue({
      order: {
        ...editableOrder,
        items: [
          { id: 1, item_id: 10, name: 'Adobo Bowl', unit_price_cents: 15_000, quantity: 2, line_total_cents: 30_000 },
          { id: 2, item_id: 11, name: 'Halo-Halo', unit_price_cents: 8_000, quantity: 1, line_total_cents: 8_000 },
        ],
        subtotal_cents: 38_000,
        total_cents: 38_000,
      },
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit order' }))
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Adobo Bowl' }))

    await userEvent.selectOptions(screen.getByLabelText('Add an item from this shop'), '11')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(api.updateOrderItems).toHaveBeenCalledWith(42, [
      { item_id: 10, quantity: 2 },
      { item_id: 11, quantity: 1 },
    ])
    expect(await screen.findByText(/Halo-Halo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('removes a line by decrementing its quantity to 0', async () => {
    vi.mocked(api.updateOrderItems).mockResolvedValue({
      order: { ...editableOrder, items: [], subtotal_cents: 0, total_cents: 0 },
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit order' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Adobo Bowl' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(api.updateOrderItems).toHaveBeenCalledWith(42, [{ item_id: 10, quantity: 0 }])
  })

  it('cancels out of edit mode without saving', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Order actions menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit order' }))
    await screen.findByRole('button', { name: 'Save changes' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(api.updateOrderItems).not.toHaveBeenCalled()
  })
})

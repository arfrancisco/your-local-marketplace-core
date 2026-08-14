import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'
import { AuthProvider } from '../auth'
import { CartProvider } from '../CartContext'
import { OrdersPollProvider } from '../useOrdersPoll'
import { api, setToken } from '../api/client'
import type { Order, User } from '../api/types'

function baseUser(overrides: Partial<User> = {}): User {
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
    last_signed_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: null,
      is_resident: true, willing_to_verify_residency: true,
    },
    vendor_profile: null,
    vendor_eligibility: { eligible: true, reasons: [] },
    ...overrides,
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

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listOrders: vi.fn().mockResolvedValue({ orders: [] }),
    },
  }
})

function renderBar(initialEntries = ['/shops']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <OrdersPollProvider>
          <CartProvider>
            <TabBar />
          </CartProvider>
        </OrdersPollProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })
  })

  // Orders and Vendor both need an account to mean anything — neither an
  // order history nor a vendor-upgrade path exists for an anonymous
  // visitor — so they're not just disabled but absent entirely signed
  // out, and Account becomes the sign-in entry point in their place.
  it('shows only Home, Cart, and Sign-in when signed out — Orders and Vendor are absent, not just inert', async () => {
    renderBar()

    expect(await screen.findByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/shops')
    expect(screen.getByRole('button', { name: /^cart, empty$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: /^orders$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^vendor$/i })).not.toBeInTheDocument()
  })

  it('shows Orders and Account once signed in, but no Vendor tab without a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderBar()

    expect(await screen.findByRole('link', { name: /^orders$/i })).toHaveAttribute('href', '/orders')
    expect(screen.getByRole('link', { name: /^account$/i })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
    // Becoming a vendor is something to discover on the Account page (which
    // already fully renders eligibility state and "Start selling"), not a
    // bottom-bar destination pointing at a shop that doesn't exist yet.
    expect(screen.queryByRole('link', { name: /^vendor$/i })).not.toBeInTheDocument()
  })

  it('shows the Vendor tab, routed to a real cross-app <a>, only once the customer actually has a vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: baseUser({
        vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
      }),
    })
    renderBar()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^vendor$/i })).toHaveAttribute('href', '/vendor/shops')
    })
    expect(screen.getByRole('link', { name: /^vendor$/i }).tagName).toBe('A')
  })

  it('marks the Home tab active on /shops and /shops/:slug, and no other tab', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderBar(['/shops/pizza-my-heart'])

    expect(await screen.findByRole('link', { name: /^home$/i })).toHaveClass('active')
    expect(screen.getByRole('link', { name: /^orders$/i })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: /^account$/i })).not.toHaveClass('active')
  })

  it('marks the Orders tab active on /orders/:id, and no other tab', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderBar(['/orders/123'])

    expect(await screen.findByRole('link', { name: /^orders$/i })).toHaveClass('active')
    expect(screen.getByRole('link', { name: /^home$/i })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: /^account$/i })).not.toHaveClass('active')
  })

  it('marks the Account tab active on /account', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    renderBar(['/account'])

    expect(await screen.findByRole('link', { name: /^account$/i })).toHaveClass('active')
    expect(screen.getByRole('link', { name: /^home$/i })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: /^orders$/i })).not.toHaveClass('active')
  })

  it('never marks the Cart tab active — it has no dedicated route', async () => {
    renderBar(['/shops'])

    const cartButton = await screen.findByRole('button', { name: /^cart, empty$/i })
    expect(cartButton).not.toHaveClass('active')
  })

  it('shows a red dot on the Orders tab when an in-flight order has an unread message', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'placed', has_unread_messages: true })],
    })
    renderBar()

    expect(await screen.findByLabelText('Unread update')).toBeInTheDocument()
  })

  it('shows no dot when the in-flight order has no unread messages', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'placed', has_unread_messages: false })],
    })
    renderBar()

    await screen.findByRole('link', { name: /^orders$/i })
    expect(screen.queryByLabelText('Unread update')).not.toBeInTheDocument()
  })

  it('shows no dot when the unread order is not in-flight (e.g. completed)', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'completed', has_unread_messages: true })],
    })
    renderBar()

    await screen.findByRole('link', { name: /^orders$/i })
    expect(screen.queryByLabelText('Unread update')).not.toBeInTheDocument()
  })

  it('never renders the Orders tab (or its dot) when signed out, regardless of listOrders', async () => {
    renderBar()

    await screen.findByRole('link', { name: /^sign in$/i })
    expect(screen.queryByRole('link', { name: /^orders$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Unread update')).not.toBeInTheDocument()
    expect(api.listOrders).not.toHaveBeenCalled()
  })
})

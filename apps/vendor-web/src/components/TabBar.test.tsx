import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'
import { AuthProvider } from '../auth'
import { MyShopProvider } from '../useMyShop'
import { api, setToken } from '../api/client'
import type { Order, Shop, User } from '../api/types'

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 9,
    email: 'vendor@example.com',
    vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
    sms_notify_order_placed: true,
    ...overrides,
  }
}

function baseShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 42,
    name: "Lola's Kitchen",
    slug: 'lolas-kitchen',
    description: null,
    building: 'Astra',
    fulfillment_methods: ['pickup'],
    status: 'active',
    accepting_orders: true,
    open: true,
    profile_photo: null,
    cover_photo: null,
    average_rating: null,
    ratings_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    demo: false,
    verified: true,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 1,
    public_reference: 'ORD-AAA11111',
    shop_id: 42,
    shop_name: "Lola's Kitchen",
    shop_building: 'Astra',
    shop_profile_photo: null,
    shop_average_rating: null,
    shop_ratings_count: 0,
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
      listShops: vi.fn().mockResolvedValue({ shops: [] }),
      listVendorOrders: vi.fn().mockResolvedValue({ orders: [] }),
    },
  }
})

function renderBar(initialEntries = ['/shops']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <MyShopProvider>
          <TabBar />
        </MyShopProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
  })

  it('renders nothing for a signed-out visitor', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <MyShopProvider>
            <TabBar />
          </MyShopProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(api.me).not.toHaveBeenCalled())
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders nothing for a signed-in user with no vendor_profile', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ vendor_profile: null }) })
    renderBar()

    await waitFor(() => expect(api.me).toHaveBeenCalled())
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders Home, Marketplace, and Account immediately, Inventory once the shop id resolves', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })
    renderBar()

    expect(await screen.findByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/shops')
    expect(screen.getByRole('link', { name: /^account$/i })).toHaveAttribute('href', '/account')
    const marketplace = screen.getByRole('link', { name: /^marketplace$/i })
    expect(marketplace).toHaveAttribute('href', '/shops')
    expect(marketplace.tagName).toBe('A')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^inventory$/i })).toHaveAttribute('href', '/shops/42/items')
    })
  })

  it('never renders Inventory when the vendor has no shop yet', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    renderBar()

    await screen.findByRole('link', { name: /^home$/i })
    expect(screen.queryByRole('link', { name: /^inventory$/i })).not.toBeInTheDocument()
  })

  it('marks the Home tab active only on the exact /shops route, not /shops/:id/items or /shops/:id/edit', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })
    renderBar(['/shops/42/edit'])

    expect(await screen.findByRole('link', { name: /^home$/i })).not.toHaveClass('active')
  })

  it('shows an attention dot on Home when an in-flight order has an unread message', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })
    vi.mocked(api.listVendorOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'placed', has_unread_messages: true })],
    })
    renderBar()

    expect(await screen.findByLabelText('Needs attention')).toBeInTheDocument()
  })

  it('shows no dot when the unread order is not in-flight (e.g. completed)', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })
    vi.mocked(api.listVendorOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'completed', has_unread_messages: true })],
    })
    renderBar()

    await screen.findByRole('link', { name: /^home$/i })
    expect(screen.queryByLabelText('Needs attention')).not.toBeInTheDocument()
  })
})

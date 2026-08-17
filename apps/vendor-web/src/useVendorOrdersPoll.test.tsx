import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { OrderList } from './components/OrderList'
import { AuthProvider } from './auth'
import { MyShopProvider } from './useMyShop'
import { VendorOrdersPollProvider } from './useVendorOrdersPoll'
import { api, setToken } from './api/client'
import type { Order, Shop, User } from './api/types'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listShops: vi.fn(),
      listVendorOrders: vi.fn(),
    },
  }
})

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

describe('useVendorOrdersPoll — shared across consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })
  })

  // The whole point of VendorOrdersPollProvider: TabBar's attention dot and
  // OrderList used to each run their own independent listVendorOrders poll.
  // Mounting both together under one provider (as App.tsx actually does)
  // and asserting exactly one call is what would catch a regression to two
  // independent fetches — mounting either component alone (as their own
  // test files do) can't distinguish "shared" from "coincidentally single".
  it('TabBar and OrderList mounted together trigger exactly one listVendorOrders call, not two', async () => {
    vi.mocked(api.listVendorOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'placed', has_unread_messages: true })],
    })

    render(
      <MemoryRouter initialEntries={['/shops']}>
        <AuthProvider>
          <MyShopProvider>
            <VendorOrdersPollProvider>
              <TabBar />
              <OrderList />
            </VendorOrdersPollProvider>
          </MyShopProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    // Wait for both consumers to have rendered off the resolved poll —
    // TabBar's dot and OrderList's card both depend on the same fetch.
    await screen.findByLabelText('Needs attention')
    await screen.findByText('ORD-AAA11111')

    expect(api.listVendorOrders).toHaveBeenCalledTimes(1)
  })

  it('a poll refresh (interval tick) updates both consumers from the same single fetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })

    render(
      <MemoryRouter initialEntries={['/shops']}>
        <AuthProvider>
          <MyShopProvider>
            <VendorOrdersPollProvider>
              <TabBar />
              <OrderList />
            </VendorOrdersPollProvider>
          </MyShopProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(api.listVendorOrders).toHaveBeenCalledTimes(1))
    await screen.findByText('No orders yet.')
    expect(screen.queryByLabelText('Needs attention')).not.toBeInTheDocument()

    vi.mocked(api.listVendorOrders).mockResolvedValue({
      orders: [makeOrder({ status: 'placed', has_unread_messages: true })],
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })

    await waitFor(() => expect(api.listVendorOrders).toHaveBeenCalledTimes(2))
    await screen.findByLabelText('Needs attention')
    await screen.findByText('ORD-AAA11111')

    vi.useRealTimers()
  })
})

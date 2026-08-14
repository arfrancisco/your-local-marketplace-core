import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useOrdersPoll, OrdersPollProvider, ORDERS_POLL_MS } from './useOrdersPoll'
import { AuthProvider } from './auth'
import { api, setToken } from './api/client'
import type { Order, User } from './api/types'

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
    last_signed_in_at: null,
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: null,
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

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listOrders: vi.fn(),
    },
  }
})

function renderHookWithAuth() {
  return renderHook(() => useOrdersPoll(), {
    wrapper: ({ children }) => (
      <AuthProvider>
        <OrdersPollProvider>{children}</OrdersPollProvider>
      </AuthProvider>
    ),
  })
}

describe('useOrdersPoll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches on mount for a signed-in user and returns the orders', async () => {
    setToken('fake-token')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })

    const { result } = renderHookWithAuth()

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(api.listOrders).toHaveBeenCalledTimes(1)
  })

  it('never calls listOrders when signed out', async () => {
    const { result } = renderHookWithAuth()

    await waitFor(() => expect(result.current).toEqual([]))
    expect(api.listOrders).not.toHaveBeenCalled()
  })

  it('polls again after the shared interval, not before', async () => {
    vi.useFakeTimers()
    setToken('fake-token')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })

    renderHookWithAuth()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDERS_POLL_MS - 1)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(2)
  })

  it('stops polling after unmount', async () => {
    vi.useFakeTimers()
    setToken('fake-token')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [] })

    const { unmount } = renderHookWithAuth()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDERS_POLL_MS * 2)
    })
    expect(api.listOrders).toHaveBeenCalledTimes(1)
  })
})

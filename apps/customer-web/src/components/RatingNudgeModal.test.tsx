import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingNudgeModal } from './RatingNudgeModal'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'
import type { Order } from '../api/types'

// Matches the poll cadence duplicated (with a comment) from App.tsx's
// ACTIVE_ORDER_REFRESH_MS — kept in sync by hand here too.
const POLL_MS = 45_000

const { authUser } = vi.hoisted(() => ({
  authUser: {
    id: 5,
    email: 'neighbor@example.com',
    customer_profile: { id: 1, display_name: 'Neighbor', default_address_id: null },
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listOrders: vi.fn(),
      rateOrder: vi.fn(),
    },
  }
})

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
    status: 'completed',
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
    completed_at: '2026-08-02T00:00:00Z',
    cancelled_at: null,
    conversation_id: null,
    has_unread_messages: false,
    rating: null,
    ...overrides,
  }
}

function renderModal() {
  return render(
    <AuthProvider>
      <RatingNudgeModal />
    </AuthProvider>,
  )
}

describe('RatingNudgeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setToken('test-token')
    vi.mocked(api.me).mockResolvedValue({ user: authUser } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens for a completed, unrated order on the first poll tick', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })

    renderModal()

    expect(await screen.findByRole('dialog', { name: /rate your order/i })).toBeInTheDocument()
    expect(screen.getByText('Pizza My Heart')).toBeInTheDocument()
    expect(localStorage.getItem('kapitmarket_rating_nudge_shown:1')).not.toBeNull()
  })

  it('does not open for orders that are not completed or already rated', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({
      orders: [
        makeOrder({ id: 1, status: 'placed', rating: null }),
        makeOrder({
          id: 2,
          status: 'completed',
          rating: { id: 9, score: 5, comment: null, reviewer_display_name: 'Neighbor', created_at: '2026-08-02T00:00:00Z' },
        }),
      ],
    })

    renderModal()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not reopen on a subsequent poll once localStorage has recorded it as shown', async () => {
    vi.useFakeTimers()
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })

    renderModal()

    // Flush the initial (immediate, non-timer) poll and AuthProvider's `me`.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('dialog', { name: /rate your order/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Advance past one full poll interval — the order is still completed and
    // unrated, but its localStorage flag is already set, so it must not pop
    // back up.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS)
    })

    expect(api.listOrders).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('submitting a rating via the form closes the modal', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })
    vi.mocked(api.rateOrder).mockResolvedValue({
      rating: { id: 1, score: 5, comment: null, reviewer_display_name: 'Neighbor', created_at: '2026-08-02T01:00:00Z' },
    } as never)

    renderModal()
    await screen.findByRole('dialog', { name: /rate your order/i })

    await userEvent.click(screen.getByRole('button', { name: '5 stars' }))
    await userEvent.click(screen.getByRole('button', { name: /submit rating/i }))

    expect(api.rateOrder).toHaveBeenCalledWith(1, 5, undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking "Maybe later" closes the modal without submitting or calling the rate API', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({ orders: [makeOrder({ id: 1 })] })

    renderModal()
    await screen.findByRole('dialog', { name: /rate your order/i })

    await userEvent.click(screen.getByRole('button', { name: 'Maybe later' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.rateOrder).not.toHaveBeenCalled()
  })

  it('picks the order with the oldest completed_at when more than one qualifies, never stacking modals', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({
      orders: [
        makeOrder({ id: 1, shop_name: 'Newer Order Shop', completed_at: '2026-08-03T00:00:00Z' }),
        makeOrder({ id: 2, shop_name: 'Older Order Shop', completed_at: '2026-08-01T00:00:00Z' }),
      ],
    })

    renderModal()

    expect(await screen.findByRole('dialog', { name: /rate your order/i })).toBeInTheDocument()
    expect(screen.getByText('Older Order Shop')).toBeInTheDocument()
    expect(screen.queryByText('Newer Order Shop')).not.toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})

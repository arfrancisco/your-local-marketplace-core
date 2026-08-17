import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useMyShop, useMyShopState, MyShopProvider } from './useMyShop'
import { AuthProvider } from './auth'
import { api, setToken } from './api/client'
import type { Shop, User } from './api/types'

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

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listShops: vi.fn(),
    },
  }
})

function renderHookWithAuth() {
  return renderHook(() => useMyShop(), {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <AuthProvider>
          <MyShopProvider>{children}</MyShopProvider>
        </AuthProvider>
      </MemoryRouter>
    ),
  })
}

describe('useMyShop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('resolves the vendor\'s shop id for a signed-in vendor', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop({ id: 42 })] })

    const { result } = renderHookWithAuth()

    await waitFor(() => expect(result.current).toBe(42))
  })

  it('stays null for a signed-in user with no vendor_profile, without fetching shops', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser({ vendor_profile: null }) })

    const { result } = renderHookWithAuth()

    await waitFor(() => expect(api.me).toHaveBeenCalled())
    expect(result.current).toBeNull()
    expect(api.listShops).not.toHaveBeenCalled()
  })

  it('stays null when signed out', async () => {
    const { result } = renderHookWithAuth()

    expect(result.current).toBeNull()
    expect(api.listShops).not.toHaveBeenCalled()
  })

  it('fetches exactly once, not on an interval', async () => {
    vi.useFakeTimers()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop()] })

    renderHookWithAuth()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.listShops).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(api.listShops).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('picks up a shop created via setShop immediately, with no refetch needed — found live via become-a-vendor.spec.ts, where the dashboard bounced back to onboarding right after shop creation without this', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    // No shop yet — the real onboarding flow's state at first mount.
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })

    function ShopIdDisplay() {
      const shopId = useMyShop()
      return <div data-testid="shop-id">{shopId ?? 'null'}</div>
    }
    // Stands in for ShopFormPage's submit handler, which calls setShop
    // directly with the API response — not a refetch — right after creating
    // a shop, before navigating to the dashboard.
    function CreateShopButton() {
      const { setShop } = useMyShopState()
      return <button onClick={() => setShop(baseShop({ id: 99 }))}>create</button>
    }

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <AuthProvider>
          <MyShopProvider>
            <ShopIdDisplay />
            <CreateShopButton />
          </MyShopProvider>
        </AuthProvider>
      </MemoryRouter>,
    )

    // 'null' is the display's own initial state too, before any fetch — wait
    // on the mock call itself, not the (ambiguous) displayed text, to be
    // sure this is asserting post-fetch state.
    await waitFor(() => expect(api.listShops).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('shop-id')).toHaveTextContent('null')

    await userEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(screen.getByTestId('shop-id')).toHaveTextContent('99')
    // No second fetch — the context was updated directly, not rediscovered.
    expect(api.listShops).toHaveBeenCalledTimes(1)
  })

  it('exposes shop/loading/setShop via useMyShopState, and loading turns false once the shop resolves', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [baseShop({ id: 42 })] })

    const { result } = renderHook(() => useMyShopState(), {
      wrapper: ({ children }) => (
        <MemoryRouter>
          <AuthProvider>
            <MyShopProvider>{children}</MyShopProvider>
          </AuthProvider>
        </MemoryRouter>
      ),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.shop?.id).toBe(42)
  })

  it('stops loading (self-heals) instead of hanging forever when listShops rejects', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listShops).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useMyShopState(), {
      wrapper: ({ children }) => (
        <MemoryRouter>
          <AuthProvider>
            <MyShopProvider>{children}</MyShopProvider>
          </AuthProvider>
        </MemoryRouter>
      ),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.shop).toBeNull()
  })
})

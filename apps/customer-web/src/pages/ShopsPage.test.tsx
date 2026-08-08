import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ShopsPage, ShopSpotlightCarousel } from './ShopsPage'
import { api, setToken } from '../api/client'
import { AuthProvider } from '../auth'
import type { Shop, User } from '../api/types'

function shopsPageUser(overrides: Partial<User> = {}): User {
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
    last_signed_in_at: '2026-08-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    customer_profile: {
      id: 1, display_name: 'Juan', default_address_id: 1,
      is_resident: true, willing_to_verify_residency: true,
    },
    vendor_profile: null,
    vendor_eligibility: { eligible: true, reasons: [] },
    ...overrides,
  }
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: { ...actual.api, listShops: vi.fn(), me: vi.fn(), becomeVendor: vi.fn() },
  }
})

const listShops = vi.mocked(api.listShops)

function shop(id: number, name: string, overrides: Partial<Shop> = {}): Shop {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
      building: null,
    fulfillment_methods: ['pickup'],
    open: true,
    profile_photo: null,
    cover_photo: null,
    average_rating: null,
    ratings_count: 0,
    price_range_cents: null,
    completed_orders_count: 0,
    demo: false,
    verified: false,
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <ShopsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ShopsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders shops in the order the API returns them (rotation preserved)', async () => {
    listShops.mockResolvedValue({
      shops: [shop(3, 'Charlie'), shop(1, 'Alpha', { average_rating: 4.5, ratings_count: 2 })],
    })

    renderPage()

    const rows = await screen.findByRole('list', { name: 'All shops' })
    const names = within(rows).getAllByRole('heading', { level: 3 })
    expect(names.map((h) => h.textContent)).toEqual(['Charlie', 'Alpha'])
  })

  it('shows the rating, on its own line, only for shops that have one', async () => {
    listShops.mockResolvedValue({
      shops: [shop(1, 'Alpha', { average_rating: 4.5, ratings_count: 2 }), shop(2, 'Bravo')],
    })

    renderPage()

    const rows = await screen.findByRole('list', { name: 'All shops' })
    const [rated, unrated] = within(rows).getAllByRole('listitem')
    const ratingLine = within(rated).getByText(/★ 4\.5/)
    expect(ratingLine.className).toContain('shop-rating-line')
    expect(within(unrated).queryByText(/★/)).toBeNull()
  })

  it('shows the price range and completed-order count (rounded to a ten) only once there is enough to show', async () => {
    listShops.mockResolvedValue({
      shops: [
        shop(1, 'Alpha', { price_range_cents: { min: 12_000, max: 28_000 }, completed_orders_count: 42 }),
        shop(2, 'Bravo', { price_range_cents: null, completed_orders_count: 8 }),
      ],
    })

    renderPage()

    const rows = await screen.findByRole('list', { name: 'All shops' })
    const [withStats, withoutStats] = within(rows).getAllByRole('listitem')
    expect(within(withStats).getByText(/₱120–280/)).toBeTruthy()
    expect(within(withStats).getByText(/40\+ orders/)).toBeTruthy()
    expect(within(withoutStats).queryByText(/₱/)).toBeNull()
    expect(within(withoutStats).queryByText(/orders/)).toBeNull()
  })

  it('fills the carousel with a subset of the same shops, without a second fetch', async () => {
    listShops.mockResolvedValue({
      shops: Array.from({ length: 10 }, (_, i) => shop(i + 1, `Shop${i + 1}`)),
    })

    renderPage()

    // Carousel is capped at 8; the directory below still lists all 10.
    const carousel = await screen.findByRole('list', { name: "Today's picks" })
    // Read the name element itself: a card's textContent would also pick up
    // the aria-hidden emoji from the no-photo fallback tile.
    const carouselNames = within(carousel)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.shop-spotlight-name')?.textContent)
    expect(carouselNames).toEqual(['Shop1', 'Shop2', 'Shop3', 'Shop4', 'Shop5', 'Shop6', 'Shop7', 'Shop8'])

    const rows = screen.getByRole('list', { name: 'All shops' })
    expect(within(rows).getAllByRole('listitem')).toHaveLength(10)

    // One response feeds both surfaces (ADR 0007 rotation, sliced client-side).
    expect(listShops).toHaveBeenCalledTimes(1)
  })

  it('schedules a repeating auto-advance timer once there is more than one shop to show', () => {
    // Rendered directly with static props (bypassing ShopsPage's own
    // debounced fetch) since what's under test is purely "mounting the
    // carousel registers a recurring timer" — asserting all the way through
    // to a scrollTo call fights React's own effect-flush scheduling under
    // fake timers for no real extra coverage.
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter>
          <ShopSpotlightCarousel shops={[shop(1, 'Shop1'), shop(2, 'Shop2'), shop(3, 'Shop3')]} />
        </MemoryRouter>,
      )
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not schedule an auto-advance timer for a single shop', () => {
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter>
          <ShopSpotlightCarousel shops={[shop(1, 'Shop1')]} />
        </MemoryRouter>,
      )
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('debounces search input and passes the query to the API', async () => {
    listShops.mockResolvedValue({ shops: [] })
    renderPage()
    await screen.findByText(/no shops are open/i)
    listShops.mockClear()

    await userEvent.type(screen.getByLabelText('Search shops'), 'bread')

    // Debounced: not called on every keystroke.
    expect(listShops).not.toHaveBeenCalledWith('bread')
    await screen.findByText(/no shops match "bread"/i)
    expect(listShops).toHaveBeenCalledWith('bread')
  })

  it('hides the browse carousel once a search is active', async () => {
    listShops.mockResolvedValue({ shops: [shop(1, 'Alpha'), shop(2, 'Bravo')] })
    renderPage()
    await screen.findByRole('list', { name: "Today's picks" })

    listShops.mockResolvedValue({ shops: [shop(1, 'Alpha')] })
    await userEvent.type(screen.getByLabelText('Search shops'), 'al')

    await screen.findByRole('list', { name: 'Search results' })
    expect(screen.queryByRole('list', { name: "Today's picks" })).toBeNull()
  })

  it('does not search on a single letter, but does at 2', async () => {
    listShops.mockResolvedValue({ shops: [] })
    renderPage()
    await screen.findByText(/no shops are open/i)
    listShops.mockClear()

    await userEvent.type(screen.getByLabelText('Search shops'), 'b')
    // Past the debounce window with nothing to show it fired.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(listShops).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Search shops'), 'r')
    await screen.findByText(/no shops match "br"/i)
    expect(listShops).toHaveBeenCalledWith('br')
  }, 10000)

  it('links a signed-out visitor to registration', async () => {
    listShops.mockResolvedValue({ shops: [] })
    renderPage()

    expect(await screen.findByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/login?mode=register',
    )
  })

  it('triggers the become-vendor flow for a signed-in non-vendor', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: shopsPageUser() })
    listShops.mockResolvedValue({ shops: [] })
    // Never resolves — the assertion only needs to observe the call, not the
    // subsequent full-page navigation, which jsdom can't perform anyway.
    vi.mocked(api.becomeVendor).mockImplementation(() => new Promise(() => {}))

    renderPage()
    const cta = await screen.findByRole('button', { name: /become a vendor/i })
    await userEvent.click(cta)

    expect(api.becomeVendor).toHaveBeenCalled()
    setToken(null)
  })

  it('hides the CTA entirely for a customer who is already a vendor', async () => {
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({
      user: shopsPageUser({ vendor_profile: { id: 1, display_name: "Juan's Shop", verification_status: 'verified' } }),
    })
    listShops.mockResolvedValue({ shops: [] })

    renderPage()
    await screen.findByText(/no shops are open/i)

    expect(screen.queryByText(/have something to sell/i)).not.toBeInTheDocument()
    setToken(null)
  })
})

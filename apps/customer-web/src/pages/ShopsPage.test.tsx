import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ShopsPage } from './ShopsPage'
import { api } from '../api/client'
import type { Shop } from '../api/types'

vi.mock('../api/client', () => ({
  api: { listShops: vi.fn() },
}))

const listShops = vi.mocked(api.listShops)

function shop(id: number, name: string, overrides: Partial<Shop> = {}): Shop {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    contact_number: null,
    address: null,
    fulfillment_methods: ['pickup'],
    open: true,
    profile_photo: null,
    cover_photo: null,
    average_rating: null,
    ratings_count: 0,
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <ShopsPage />
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

  it('shows the rating only for shops that have one', async () => {
    listShops.mockResolvedValue({
      shops: [shop(1, 'Alpha', { average_rating: 4.5, ratings_count: 2 }), shop(2, 'Bravo')],
    })

    renderPage()

    const rows = await screen.findByRole('list', { name: 'All shops' })
    const [rated, unrated] = within(rows).getAllByRole('listitem')
    expect(within(rated).getByText(/★ 4\.5 · 2 reviews/)).toBeTruthy()
    expect(within(unrated).queryByText(/★/)).toBeNull()
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
      .map((li) => li.querySelector('.shop-carousel-name')?.textContent)
    expect(carouselNames).toEqual(['Shop1', 'Shop2', 'Shop3', 'Shop4', 'Shop5', 'Shop6', 'Shop7', 'Shop8'])

    const rows = screen.getByRole('list', { name: 'All shops' })
    expect(within(rows).getAllByRole('listitem')).toHaveLength(10)

    // One response feeds both surfaces (ADR 0007 rotation, sliced client-side).
    expect(listShops).toHaveBeenCalledTimes(1)
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
})

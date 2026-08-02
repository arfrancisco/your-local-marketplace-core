import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ShopsPage } from './ShopsPage'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: { listShops: vi.fn() },
}))

const listShops = vi.mocked(api.listShops)

describe('ShopsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders shops in the order the API returns them (rotation preserved)', async () => {
    listShops.mockResolvedValue({
      shops: [
        { id: 3, name: 'Charlie', slug: 'charlie', description: null, contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [], average_rating: null, ratings_count: 0 },
        { id: 1, name: 'Alpha', slug: 'alpha', description: null, contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [], average_rating: 4.5, ratings_count: 2 },
      ],
    })

    render(
      <MemoryRouter>
        <ShopsPage />
      </MemoryRouter>,
    )

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Charlie', 'Alpha'])
  })

  it('debounces search input and passes the query to the API', async () => {
    listShops.mockResolvedValue({ shops: [] })
    render(
      <MemoryRouter>
        <ShopsPage />
      </MemoryRouter>,
    )
    await screen.findByText(/no shops are open/i)
    listShops.mockClear()

    await userEvent.type(screen.getByLabelText('Search shops'), 'bread')

    // Debounced: not called on every keystroke.
    expect(listShops).not.toHaveBeenCalledWith('bread')
    await screen.findByText(/no shops match "bread"/i)
    expect(listShops).toHaveBeenCalledWith('bread')
  })

  it('does not search on a single letter, but does at 2', async () => {
    listShops.mockResolvedValue({ shops: [] })
    render(
      <MemoryRouter>
        <ShopsPage />
      </MemoryRouter>,
    )
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

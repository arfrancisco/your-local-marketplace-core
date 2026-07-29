import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
        { id: 3, name: 'Charlie', slug: 'charlie', description: null, contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [] },
        { id: 1, name: 'Alpha', slug: 'alpha', description: null, contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [] },
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
})

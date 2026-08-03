import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopPreviewPage } from './ShopPreviewPage'
import { api } from '../api/client'
import type { Item, Shop } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getShop: vi.fn(),
      listItems: vi.fn(),
      listShopRatings: vi.fn(),
    },
  }
})

const shop: Shop = {
  id: 1,
  name: "Lola's Kitchen",
  slug: 'lolas-kitchen',
  description: 'Home-cooked meals from unit 12F.',
  contact_number: null,
  address: 'Tower A, Unit 12F',
  fulfillment_methods: ['pickup'],
  status: 'active',
  accepting_orders: true,
  open: true,
  profile_photo: null,
  cover_photo: null,
  average_rating: 4.5,
  ratings_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    shop_id: 1,
    name: 'Adobo Rice Bowl',
    description: null,
    price_cents: 18_000,
    currency: 'PHP',
    enabled: true,
    stock_count: null,
    sold_out: false,
    position: 0,
    tags: [],
    photos: [],
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shops/:id/preview" element={<ShopPreviewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ShopPreviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })
  })

  it('renders the shop as a customer would see it, read-only', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    expect(await screen.findByRole('heading', { name: "Lola's Kitchen" })).toBeInTheDocument()
    expect(screen.getByText('Adobo Rice Bowl')).toBeInTheDocument()
    expect(screen.getByText(/preview of your shop/i)).toBeInTheDocument()
    // No cart affordance anywhere on this page.
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })

  it('filters out disabled items — customers never see them at all', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({
      items: [item({ id: 1, name: 'Visible Item' }), item({ id: 2, name: 'Hidden Item', enabled: false })],
    })

    renderAt('/shops/1/preview')

    expect(await screen.findByText('Visible Item')).toBeInTheDocument()
    expect(screen.queryByText('Hidden Item')).not.toBeInTheDocument()
  })

  it('still shows a sold-out item, just labeled', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({
      items: [item({ stock_count: 0, sold_out: true })],
    })

    renderAt('/shops/1/preview')

    expect(await screen.findByText('Adobo Rice Bowl')).toBeInTheDocument()
    expect(screen.getByText('Sold out')).toBeInTheDocument()
  })
})

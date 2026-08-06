import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  building: 'Tower A',
  address: 'Unit 12F',
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
  demo: false,
  verified: false,
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
    archived: false,
    stock_count: null,
    sold_out: false,
    position: 0,
    tags: [],
    photos: [],
    ...overrides,
  }
}

function renderAt(path: string, state?: { from?: 'dashboard' | 'edit' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
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

  it('links back to editing this shop when opened from the edit form', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview', { from: 'edit' })

    const link = await screen.findByRole('link', { name: /back to editing/i })
    expect(link).toHaveAttribute('href', '/shops/1/edit')
  })

  it('defaults to linking back to editing when opened directly, with no "from" state', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    const link = await screen.findByRole('link', { name: /back to editing/i })
    expect(link).toHaveAttribute('href', '/shops/1/edit')
  })

  it('links back to the dashboard instead when opened from there — no detour through the edit form', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview', { from: 'dashboard' })

    const link = await screen.findByRole('link', { name: /back to dashboard/i })
    expect(link).toHaveAttribute('href', '/shops')
    expect(screen.queryByRole('link', { name: /back to editing/i })).not.toBeInTheDocument()
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

  it('shows the building but never the exact unit — this is what a customer sees', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.getByText(/Tower A/)).toBeInTheDocument()
    expect(screen.queryByText(/Unit 12F/)).not.toBeInTheDocument()
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

  it('shows the Verified badge when the shop is verified, matching what a customer sees', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, verified: true } })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('shows no Verified badge for an unverified shop', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, verified: false } })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  it('shows the demo-shop disclaimer banner when the shop is a demo shop', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, demo: true } })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    expect(await screen.findByRole('alert')).toHaveTextContent(/this is a demo shop for previewing the app/i)
  })

  it('shows no demo banner for a real shop', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, demo: false } })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })

    renderAt('/shops/1/preview')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ShopPreviewPage onboarding tour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })
    vi.mocked(api.getShop).mockResolvedValue({ shop })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item()] })
  })

  it('shows no tooltip until the "?" tour button is clicked', async () => {
    renderAt('/shops/1/preview')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('the "?" tour button opens a single callout, closed by its "Got it"', async () => {
    renderAt('/shops/1/preview')
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    await userEvent.click(screen.getByRole('button', { name: 'Tour this preview' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/exactly what a customer sees/i)

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('the × on the callout closes it too, with no navigation', async () => {
    renderAt('/shops/1/preview')
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    await userEvent.click(screen.getByRole('button', { name: 'Tour this preview' }))
    await screen.findByRole('tooltip')
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: "Lola's Kitchen" })).toBeInTheDocument()
  })
})

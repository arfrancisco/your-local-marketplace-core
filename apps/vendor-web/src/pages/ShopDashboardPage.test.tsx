import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDashboardPage } from './ShopDashboardPage'
import { api } from '../api/client'
import type { Shop } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listShops: vi.fn(),
      openShop: vi.fn(),
      closeShop: vi.fn(),
    },
  }
})

const shopOpen: Shop = {
  id: 1,
  name: "Lola's Kitchen",
  slug: 'lolas-kitchen',
  description: null,
  contact_number: null,
  building: null,
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
}

const shopClosed: Shop = { ...shopOpen, accepting_orders: false, open: false }

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shops" element={<ShopDashboardPage />} />
        <Route path="/onboarding" element={<p>Onboarding page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ShopDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a vendor with no shop to onboarding instead of an empty dashboard', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })

    renderAt('/shops')

    expect(await screen.findByText('Onboarding page')).toBeInTheDocument()
  })

  it('renders the single shop dashboard, without redirecting, for a vendor who has one', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: "Lola's Kitchen" })).toBeInTheDocument()
    expect(screen.queryByText('Onboarding page')).not.toBeInTheDocument()
    // Direct links to the three things a vendor manages, no list wrapper.
    expect(screen.getByRole('link', { name: /edit shop details/i })).toHaveAttribute(
      'href',
      '/shops/1/edit',
    )
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/shops/1/items')
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/orders?shop_id=1')
  })

  it('offers no "New shop" link, since a vendor can only ever own one shop', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })

    renderAt('/shops')
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    expect(screen.queryByRole('link', { name: /new shop/i })).not.toBeInTheDocument()
  })

  it('confirms before closing, since closing hides the shop from every customer', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })
    vi.mocked(api.closeShop).mockResolvedValue({ shop: shopClosed })

    renderAt('/shops')

    await userEvent.click(await screen.findByRole('button', { name: /shop is open/i }))

    expect(api.closeShop).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /close your shop\?/i })).toBeInTheDocument()
    expect(screen.getByText(/existing orders stay accessible/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(api.closeShop).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /shop is open/i }))
    await userEvent.click(screen.getByRole('button', { name: /^close shop$/i }))

    expect(api.closeShop).toHaveBeenCalledWith(1)
    expect(await screen.findByRole('button', { name: /shop is closed/i })).toBeInTheDocument()
  })

  it('opens with no confirmation, since reopening has no downside', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopClosed] })
    vi.mocked(api.openShop).mockResolvedValue({ shop: shopOpen })

    renderAt('/shops')

    await userEvent.click(await screen.findByRole('button', { name: /shop is closed/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.openShop).toHaveBeenCalledWith(1)
    expect(await screen.findByRole('button', { name: /shop is open/i })).toBeInTheDocument()
  })
})

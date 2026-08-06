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
      listVendorOrders: vi.fn(),
    },
  }
})

const shopOpen: Shop = {
  id: 1,
  name: "Lola's Kitchen",
  slug: 'lolas-kitchen',
  description: null,
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
  demo: false,
  verified: false,
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
    // Order management is now the dashboard's main content, so it always
    // fetches orders on render — default to an empty list unless a test
    // cares about the actual contents.
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
  })

  it('sends a vendor with no shop to onboarding instead of an empty dashboard', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })

    renderAt('/shops')

    expect(await screen.findByText('Onboarding page')).toBeInTheDocument()
  })

  it('renders the single shop dashboard, without redirecting, for a vendor who has one, with order management as the main content', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: "Lola's Kitchen" })).toBeInTheDocument()
    expect(screen.queryByText('Onboarding page')).not.toBeInTheDocument()

    // Order management is the dashboard's main content — shown directly,
    // no menu or extra click needed.
    expect(api.listVendorOrders).toHaveBeenCalledWith(1)
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument()

    // Edit shop details / Inventory / Reviews move behind the kebab menu
    // instead of being primary buttons — not visible until it's opened.
    // (They're role="menuitem" once the menu is open, matching
    // ItemActionsMenu's pattern, not the implicit "link" role.)
    expect(screen.queryByRole('menuitem', { name: /edit shop details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Inventory' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Reviews' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /shop actions menu/i }))

    expect(screen.getByRole('menuitem', { name: /edit shop details/i })).toHaveAttribute(
      'href',
      '/shops/1/edit',
    )
    expect(screen.getByRole('menuitem', { name: 'Inventory' })).toHaveAttribute('href', '/shops/1/items')
    expect(screen.getByRole('menuitem', { name: 'Reviews' })).toHaveAttribute('href', '/shops/1/reviews')
    expect(screen.getByRole('menuitem', { name: 'Preview shop' })).toHaveAttribute('href', '/shops/1/preview')
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

  it('also confirms before opening, since the toggle now sits at the top of the page where a stray tap is likely', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopClosed] })
    vi.mocked(api.openShop).mockResolvedValue({ shop: shopOpen })

    renderAt('/shops')

    await userEvent.click(await screen.findByRole('button', { name: /shop is closed/i }))

    expect(api.openShop).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /open your shop\?/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(api.openShop).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('button', { name: /shop is closed/i }))
    await userEvent.click(screen.getByRole('button', { name: /^open shop$/i }))

    expect(api.openShop).toHaveBeenCalledWith(1)
    expect(await screen.findByRole('button', { name: /shop is open/i })).toBeInTheDocument()
  })
})

describe('ShopDashboardPage onboarding tour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })
  })

  function renderDashboard() {
    render(
      <MemoryRouter>
        <ShopDashboardPage />
      </MemoryRouter>,
    )
  }

  async function openTour() {
    await userEvent.click(await screen.findByRole('button', { name: 'Tour your dashboard' }))
  }

  it('shows no tooltip until the "?" tour button is clicked', async () => {
    renderDashboard()

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('walks through all four stops, closing after the last one', async () => {
    renderDashboard()
    await openTour()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    }

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('the × on a callout closes the whole tour immediately', async () => {
    renderDashboard()
    await openTour()

    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on a centered welcome message, not pointing at anything', async () => {
    renderDashboard()
    await openTour()

    expect(screen.getByText(/this is your dashboard from here on/i)).toBeInTheDocument()
  })

  it('reopening the tour after closing it restarts at the first stop', async () => {
    renderDashboard()
    await openTour()

    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    await openTour()

    expect(screen.getByText(/this is your dashboard from here on/i)).toBeInTheDocument()
  })
})

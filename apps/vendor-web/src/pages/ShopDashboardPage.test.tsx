import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDashboardPage } from './ShopDashboardPage'
import { AuthProvider } from '../auth'
import { MyShopProvider } from '../useMyShop'
import { VendorOrdersPollProvider } from '../useVendorOrdersPoll'
import { api, setToken } from '../api/client'
import type { Shop, User } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listShops: vi.fn(),
      openShop: vi.fn(),
      closeShop: vi.fn(),
      listVendorOrders: vi.fn(),
    },
  }
})

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 9,
    email: 'vendor@example.com',
    vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
    sms_notify_order_placed: true,
    ...overrides,
  }
}

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
      <AuthProvider>
        <MyShopProvider>
          <VendorOrdersPollProvider>
            <Routes>
              <Route path="/shops" element={<ShopDashboardPage />} />
              <Route path="/onboarding" element={<p>Onboarding page</p>} />
            </Routes>
          </VendorOrdersPollProvider>
        </MyShopProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ShopDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
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

    // Kebab menu retired entirely — just two plain text links now (Edit,
    // Shop Preview), always visible, no click-to-open step. Inventory and
    // Reviews moved out to the bottom TabBar as primary tabs instead (see
    // TabBar.test.tsx) — neither shows up here at all.
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/shops/1/edit')
    expect(screen.getByRole('link', { name: 'Shop Preview' })).toHaveAttribute('href', '/shops/1/preview')
    expect(screen.queryByRole('button', { name: /shop actions menu/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Inventory' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument()
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
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopOpen] })
  })

  function renderDashboard() {
    render(
      <MemoryRouter>
        <AuthProvider>
          <MyShopProvider>
            <VendorOrdersPollProvider>
              <ShopDashboardPage />
            </VendorOrdersPollProvider>
          </MyShopProvider>
        </AuthProvider>
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

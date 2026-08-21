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

// The setup wizard (pages/onboarding/) records how far a vendor got in
// shops.onboarding_step and stamps onboarding_completed_at at the end.
// Until that stamp exists, the dashboard offers a way back in.
describe('ShopDashboardPage setup resume banner', () => {
  const midSetupClosed: Shop = {
    ...shopClosed,
    onboarding_step: 'items',
    onboarding_completed_at: null,
  }
  const midSetupOpen: Shop = { ...midSetupClosed, accepting_orders: true, open: true }

  beforeEach(() => {
    vi.clearAllMocks()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
  })

  it('points back at the step the vendor stopped on, counted out of the real step total', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [midSetupClosed] })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: 'Finish setting up your shop' })).toBeInTheDocument()
    expect(screen.getByText(/you're on step 3 of 4 — add your first item/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue setup' })).toHaveAttribute('href', '/onboarding/items')
  })

  it('says nobody can see the shop only while it is actually closed', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [midSetupClosed] })

    renderAt('/shops')

    expect(await screen.findByText(/nobody can see your shop until you finish/i)).toBeInTheDocument()
  })

  it('never claims the shop is invisible when it is open — the open toggle is independent of setup', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [midSetupOpen] })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: 'Finish setting up your shop' })).toBeInTheDocument()
    expect(screen.queryByText(/nobody can see your shop/i)).not.toBeInTheDocument()
    expect(screen.getByText(/already open, so neighbors can find it while you finish/i)).toBeInTheDocument()
  })

  it('disappears once onboarding is finished', async () => {
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [{ ...shopOpen, onboarding_step: 'payment', onboarding_completed_at: '2026-08-21T00:00:00Z' }],
    })

    renderAt('/shops')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByRole('heading', { name: 'Finish setting up your shop' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Continue setup' })).not.toBeInTheDocument()
  })
})

// Finishing setup and being able to open are different things, and the gap
// between them is where vendors get stranded: every pre-wizard shop was
// backfilled as onboarding-complete (abandoned signups with no items
// included), and a live vendor can empty their catalogue at any time. The
// resume banner is gone by then, so this card is the only thing left that
// explains why the shop will not open.
describe('ShopDashboardPage readiness card', () => {
  const finished = { onboarding_step: 'payment', onboarding_completed_at: '2026-08-21T00:00:00Z' }
  const noItems = [{ code: 'no_enabled_items', message: 'Add at least one available item before opening your shop.' }]
  const noMessage = [
    { code: 'opening_message_required', message: 'Add an opening message before opening your shop.' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    setToken('tok123')
    vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
    vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
  })

  it('explains why a finished-but-closed shop cannot open, with a way to fix each reason', async () => {
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [{ ...shopClosed, ...finished, open_blockers: [...noMessage, ...noItems] }],
    })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: "Your shop can't open yet" })).toBeInTheDocument()
    expect(screen.getByText(/Add an opening message before opening your shop\./)).toBeInTheDocument()
    expect(screen.getByText(/Add at least one available item before opening your shop\./)).toBeInTheDocument()
    // A reason with no way to act on it is a dead end.
    expect(screen.getByRole('link', { name: 'Edit your shop' })).toHaveAttribute('href', '/shops/1/edit')
    expect(screen.getByRole('link', { name: 'Go to Inventory' })).toHaveAttribute('href', '/shops/1/items')
  })

  it('warns an already-open shop that it will not be able to reopen', async () => {
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [{ ...shopOpen, ...finished, open_blockers: noItems }],
    })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: 'Your shop needs attention' })).toBeInTheDocument()
    expect(screen.getByText(/will not be able to reopen once you close it/i)).toBeInTheDocument()
  })

  it('stays hidden for a shop that can actually open', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [{ ...shopOpen, ...finished, open_blockers: [] }] })

    renderAt('/shops')

    await screen.findByRole('heading', { name: "Lola's Kitchen" })
    expect(screen.queryByRole('heading', { name: /can't open yet|needs attention/ })).not.toBeInTheDocument()
  })

  // Mid-wizard the resume banner already covers this, and it links to the
  // steps that fix it — two competing cards would just be noise.
  it('defers to the resume banner while setup is still unfinished', async () => {
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [{ ...shopClosed, onboarding_step: 'items', onboarding_completed_at: null, open_blockers: noItems }],
    })

    renderAt('/shops')

    expect(await screen.findByRole('heading', { name: 'Finish setting up your shop' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /can't open yet|needs attention/ })).not.toBeInTheDocument()
  })
})

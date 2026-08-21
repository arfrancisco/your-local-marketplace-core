import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from '../../App'
import { OnboardingLayout } from './OnboardingLayout'
import { ShopStep } from './ShopStep'
import { PhotosStep } from './PhotosStep'
import { ItemsStep } from './ItemsStep'
import { PaymentStep } from './PaymentStep'
import { AuthProvider } from '../../auth'
import { MyShopProvider } from '../../useMyShop'
import { api, ApiError, setToken } from '../../api/client'
import type { Item, Shop, User } from '../../api/types'

// Same stand-in ShopFormPage.test.tsx uses: react-easy-crop is a real
// drag/zoom canvas widget whose onCropComplete never fires in jsdom, so
// report a fixed crop region on mount instead. Everything downstream of
// that callback is our own code and runs for real.
vi.mock('react-easy-crop', async () => {
  const React = await import('react')
  return {
    default: ({
      aspect,
      onCropComplete,
    }: {
      aspect: number
      onCropComplete?: (a: unknown, p: { x: number; y: number; width: number; height: number }) => void
    }) => {
      React.useEffect(() => {
        onCropComplete?.({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 20, width: 400, height: 400 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <div data-testid="cropper" data-aspect={String(aspect)} />
    },
  }
})

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listShops: vi.fn(),
      getShop: vi.fn(),
      createShop: vi.fn(),
      updateShop: vi.fn(),
      completeOnboarding: vi.fn(),
      listItems: vi.fn(),
      createItem: vi.fn(),
      listVendorOrders: vi.fn(),
      listShopRatings: vi.fn(),
    },
  }
})

function baseUser(): User {
  return {
    id: 9,
    email: 'vendor@example.com',
    vendor_profile: { id: 1, display_name: "Lola's Kitchen", verification_status: 'verified' },
    sms_notify_order_placed: true,
  }
}

const shop: Shop = {
  id: 5,
  name: "Lola's Kitchen",
  slug: 'lolas-kitchen',
  description: 'Home cooking',
  building: 'Astra',
  address: 'Unit 3B',
  fulfillment_methods: ['pickup'],
  status: 'draft',
  accepting_orders: false,
  open: false,
  profile_photo: null,
  cover_photo: null,
  average_rating: null,
  ratings_count: 0,
  opening_message: '',
  opening_message_photos: [],
  onboarding_step: 'shop',
  onboarding_completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  demo: false,
  verified: false,
}

function shopAt(step: string): Shop {
  return { ...shop, onboarding_step: step }
}

const item: Item = {
  id: 11,
  shop_id: 5,
  name: 'Adobo Rice Bowl',
  description: null,
  price_cents: 18000,
  currency: 'PHP',
  enabled: true,
  archived: false,
  stock_count: null,
  sold_out: false,
  position: 0,
  tags: [],
  photos: [],
}

// jsdom implements none of the image/canvas pipeline the crop export needs.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-crop')
  URL.revokeObjectURL = vi.fn()

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get(this: HTMLImageElement) {
      return this.getAttribute('src') ?? ''
    },
    set(this: HTMLImageElement, value: string) {
      this.setAttribute('src', value)
      queueMicrotask(() => this.dispatchEvent(new Event('load')))
    },
  })

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
    callback(new Blob(['cropped-bytes'], { type: type ?? 'image/jpeg' }))
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  setToken('tok123')
  vi.mocked(api.me).mockResolvedValue({ user: baseUser() })
  vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
  vi.mocked(api.listItems).mockResolvedValue({ items: [] })
  vi.mocked(api.createShop).mockResolvedValue({ shop: shopAt('photos') })
  vi.mocked(api.updateShop).mockResolvedValue({ shop: shopAt('items') })
  vi.mocked(api.completeOnboarding).mockResolvedValue({
    shop: { ...shop, onboarding_completed_at: '2026-08-21T00:00:00Z' },
  })
  vi.mocked(api.listVendorOrders).mockResolvedValue({ orders: [] })
  vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })
})

function renderWizard(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <MyShopProvider>
          <Routes>
            <Route path="/onboarding" element={<OnboardingLayout />}>
              <Route path="shop" element={<ShopStep />} />
              <Route path="photos" element={<PhotosStep />} />
              <Route path="items" element={<ItemsStep />} />
              <Route path="payment" element={<PaymentStep />} />
            </Route>
            <Route path="/shops" element={<p>Dashboard</p>} />
          </Routes>
        </MyShopProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function pngFile() {
  return new File(['original-bytes'], 'storefront.png', { type: 'image/png' })
}

describe('onboarding wizard: step 1, shop basics', () => {
  it('renders as the first of four steps, with nothing to go back to', async () => {
    renderWizard('/onboarding/shop')

    expect(await screen.findByRole('heading', { name: 'Tell us about your shop' })).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
  })

  it('creates the shop, records the step it just reached, and moves on to photos', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/shop')

    await user.type(await screen.findByLabelText('Name'), "Lola's Kitchen")
    await user.type(screen.getByLabelText(/building/i), 'Astra')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(api.createShop).toHaveBeenCalled())
    const fd = vi.mocked(api.createShop).mock.calls[0][0]
    expect(fd.get('shop[name]')).toBe("Lola's Kitchen")
    expect(fd.get('shop[building]')).toBe('Astra')
    // The furthest step reached, i.e. where a returning vendor resumes.
    expect(fd.get('shop[onboarding_step]')).toBe('photos')

    expect(await screen.findByRole('heading', { name: 'Add your shop photos' })).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('surfaces the API\'s message when creation is rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(api.createShop).mockRejectedValue(new ApiError(422, 'invalid', 'Name has already been taken'))
    renderWizard('/onboarding/shop')

    await user.type(await screen.findByLabelText('Name'), "Lola's Kitchen")
    await user.type(screen.getByLabelText(/building/i), 'Astra')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name has already been taken')
  })
})

describe('onboarding wizard: step 2, photos', () => {
  beforeEach(() => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopAt('photos')] })
  })

  it('renders as step 2, with a way back to step 1', async () => {
    renderWizard('/onboarding/photos')

    expect(await screen.findByRole('heading', { name: 'Add your shop photos' })).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/onboarding/shop')
  })

  it('PATCHes the cropped photo — not the file that was picked — and moves on', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/photos')

    await user.upload(await screen.findByLabelText(/profile picture/i), pngFile())
    await user.click(await screen.findByRole('button', { name: /use photo/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(api.updateShop).toHaveBeenCalled())
    const [id, fd] = vi.mocked(api.updateShop).mock.calls[0]
    expect(id).toBe(5)
    expect(fd.get('shop[profile_photo]')).toBeInstanceOf(File)
    expect(fd.get('shop[onboarding_step]')).toBe('items')

    expect(await screen.findByRole('heading', { name: 'Add your first item' })).toBeInTheDocument()
  })

  it('"Skip for now" uploads nothing but still records the step reached', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/photos')

    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))

    await waitFor(() => expect(api.updateShop).toHaveBeenCalled())
    const fd = vi.mocked(api.updateShop).mock.calls[0][1]
    expect(fd.get('shop[profile_photo]')).toBeNull()
    expect(fd.get('shop[onboarding_step]')).toBe('items')
    expect(await screen.findByRole('heading', { name: 'Add your first item' })).toBeInTheDocument()
  })

  it('shows the photos already uploaded rather than pretending there are none', async () => {
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [
        {
          ...shopAt('photos'),
          profile_photo: { id: 1, url: '/rails/blob/pic.jpg', filename: 'pic.jpg', byte_size: 10, content_type: 'image/jpeg' },
        },
      ],
    })
    renderWizard('/onboarding/photos')

    expect(await screen.findByAltText('pic.jpg')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your shop photos' })).toBeInTheDocument()
  })
})

describe('onboarding wizard: step 3, items', () => {
  beforeEach(() => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopAt('items')] })
  })

  it('lists items that already exist and asks for another, instead of claiming there are none', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [item] })
    renderWizard('/onboarding/items')

    expect(await screen.findByRole('heading', { name: 'Add another item' })).toBeInTheDocument()
    expect(screen.getByText('Added so far')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Adobo Rice Bowl' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another' })).toBeInTheDocument()
  })

  it('asks for a first item when the shop has none yet', async () => {
    renderWizard('/onboarding/items')

    expect(await screen.findByRole('heading', { name: 'Add your first item' })).toBeInTheDocument()
    expect(screen.queryByText('Added so far')).not.toBeInTheDocument()
  })

  it('adds an item against this shop and shows it in the list', async () => {
    const user = userEvent.setup()
    vi.mocked(api.createItem).mockResolvedValue({ item })
    renderWizard('/onboarding/items')

    await user.type(await screen.findByLabelText(/^name/i), 'Adobo Rice Bowl')
    await user.type(screen.getByLabelText('Price'), '180')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    await waitFor(() => expect(api.createItem).toHaveBeenCalled())
    const [shopId, fd] = vi.mocked(api.createItem).mock.calls[0]
    expect(shopId).toBe(5)
    expect(fd.get('item[name]')).toBe('Adobo Rice Bowl')
    expect(fd.get('item[price_cents]')).toBe('18000')

    expect(await screen.findByRole('heading', { name: 'Adobo Rice Bowl' })).toBeInTheDocument()
  })

  it('continues to the payment step, recording it as reached', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/items')

    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(api.updateShop).toHaveBeenCalled())
    expect(vi.mocked(api.updateShop).mock.calls[0][1].get('shop[onboarding_step]')).toBe('payment')
    expect(await screen.findByRole('heading', { name: 'How do customers pay you?' })).toBeInTheDocument()
  })
})

describe('onboarding wizard: step 4, payment and finishing', () => {
  beforeEach(() => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopAt('payment')] })
    vi.mocked(api.updateShop).mockResolvedValue({ shop: shopAt('payment') })
  })

  it('renders as the last step, with no fifth one waiting', async () => {
    renderWizard('/onboarding/payment')

    expect(await screen.findByRole('heading', { name: 'How do customers pay you?' })).toBeInTheDocument()
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open my shop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish, keep it closed' })).toBeInTheDocument()
  })

  it('saves the opening message, opens the shop, and lands on the dashboard', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/payment')

    await user.type(
      await screen.findByPlaceholderText(/GCash to 0917/i),
      'GCash to 0917-555-0000.',
    )
    await user.click(screen.getByRole('button', { name: 'Open my shop' }))

    await waitFor(() => expect(api.completeOnboarding).toHaveBeenCalledWith(5, true))
    expect(vi.mocked(api.updateShop).mock.calls[0][1].get('shop[opening_message]')).toBe('GCash to 0917-555-0000.')
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('"Finish, keep it closed" completes onboarding without asking to open', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/payment')

    await user.click(await screen.findByRole('button', { name: 'Finish, keep it closed' }))

    await waitFor(() => expect(api.completeOnboarding).toHaveBeenCalledWith(5))
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('shows the API\'s own reason inline when opening is refused, and stays put', async () => {
    const user = userEvent.setup()
    vi.mocked(api.completeOnboarding).mockRejectedValue(
      new ApiError(422, 'invalid', 'Add an opening message and at least one item before opening.'),
    )
    renderWizard('/onboarding/payment')

    await user.click(await screen.findByRole('button', { name: 'Open my shop' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add an opening message and at least one item before opening.',
    )
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How do customers pay you?' })).toBeInTheDocument()
  })
})

describe('onboarding wizard: guards and progression', () => {
  it('sends anyone landing past step 1 with no shop back to step 1', async () => {
    renderWizard('/onboarding/items')

    expect(await screen.findByRole('heading', { name: 'Tell us about your shop' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /add your first item/i })).not.toBeInTheDocument()
  })

  it('creates on step 1 and PATCHes from then on, never a second create', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/shop')

    await user.type(await screen.findByLabelText('Name'), "Lola's Kitchen")
    await user.type(screen.getByLabelText(/building/i), 'Astra')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Add your shop photos' })
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))

    await waitFor(() => expect(api.updateShop).toHaveBeenCalledTimes(1))
    expect(api.createShop).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.updateShop).mock.calls[0][0]).toBe(5)
  })

  it('going Back never regresses the furthest step reached', async () => {
    const user = userEvent.setup()
    // Already been as far as payment; revisiting step 1 to fix a typo.
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopAt('payment')] })
    vi.mocked(api.updateShop).mockResolvedValue({ shop: shopAt('payment') })
    renderWizard('/onboarding/photos')

    await user.click(await screen.findByRole('link', { name: /back/i }))
    await screen.findByRole('heading', { name: 'Tell us about your shop' })
    // A plain link: walking back saves nothing at all.
    expect(api.updateShop).not.toHaveBeenCalled()

    await user.type(await screen.findByDisplayValue("Lola's Kitchen"), '!')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(api.updateShop).toHaveBeenCalled())
    const fd = vi.mocked(api.updateShop).mock.calls[0][1]
    expect(fd.get('shop[name]')).toBe("Lola's Kitchen!")
    // 'photos' is behind 'payment', so onboarding_step is left alone —
    // otherwise resuming would yank this vendor back to step 2.
    expect(fd.get('shop[onboarding_step]')).toBeNull()
  })

  it('keeps /shops/new working as a link, pointing it at the wizard', async () => {
    render(
      <MemoryRouter initialEntries={['/shops/new']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Tell us about your shop' })).toBeInTheDocument()
  })
})

describe('onboarding wizard: live preview accordion', () => {
  it('is collapsed by default, and toggles open and shut', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/shop')

    const toggle = await screen.findByRole('button', { name: /preview your shop/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('How neighbors will see it')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText('How neighbors will see it')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide preview/i }))
    expect(screen.queryByText('How neighbors will see it')).not.toBeInTheDocument()
  })

  it('reflects what is being typed right now, before anything is saved', async () => {
    const user = userEvent.setup()
    renderWizard('/onboarding/shop')

    await user.type(await screen.findByLabelText('Name'), 'Tita Nena Kitchen')
    await user.click(screen.getByRole('button', { name: /preview your shop/i }))

    expect(screen.getByRole('heading', { name: 'Tita Nena Kitchen' })).toBeInTheDocument()
    expect(api.createShop).not.toHaveBeenCalled()
    expect(api.updateShop).not.toHaveBeenCalled()
  })

  it('shows the saved shop\'s items in the preview', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [shopAt('items')] })
    vi.mocked(api.listItems).mockResolvedValue({ items: [item] })
    renderWizard('/onboarding/items')

    await user.click(await screen.findByRole('button', { name: /preview your shop/i }))

    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Adobo Rice Bowl' }).length).toBeGreaterThan(1)
  })
})

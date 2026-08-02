import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopFormPage } from './ShopFormPage'
import { api } from '../api/client'
import type { Shop } from '../api/types'

// react-easy-crop is a real drag/zoom canvas widget: jsdom never loads the
// image behind it, so its onCropComplete would never fire and there'd be
// nothing to confirm. Stand in for it with a component that reports a fixed
// crop region on mount, exactly like the real one does once the media loads.
// Everything downstream of that callback (canvas export, blob, FormData) is
// our own code and runs for real.
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

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listShops: vi.fn(),
      getShop: vi.fn(),
      createShop: vi.fn(),
      updateShop: vi.fn(),
      listShopRatings: vi.fn(),
    },
  }
})

const existingShop: Shop = {
  id: 5,
  name: 'Tita Nena Kitchen',
  slug: 'tita-nena-kitchen',
  description: 'Home cooking',
  contact_number: '0917',
  address: 'Tower A, Unit 3B',
  fulfillment_methods: ['pickup'],
  status: 'active',
  accepting_orders: true,
  open: true,
  profile_photo: null,
  cover_photo: null,
  average_rating: null,
  ratings_count: 0,
  opening_message: '',
  opening_message_photos: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// jsdom implements none of the image/canvas pipeline the crop export needs.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-source')
  URL.revokeObjectURL = vi.fn()

  // Setting .src never triggers a load in jsdom; fire it ourselves so
  // loadImage() resolves.
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
  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob(['cropped-bytes'], { type: type ?? 'image/jpeg' }))
  }
})

function renderAt(path: string, routePath: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={<ShopFormPage />} />
        <Route path="/shops" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function pngFile() {
  return new File(['original-bytes'], 'storefront.png', { type: 'image/png' })
}

// jsdom's Blob has no .text(), so read it the old way.
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('ShopFormPage photo cropping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.getShop).mockResolvedValue({ shop: existingShop })
    vi.mocked(api.createShop).mockResolvedValue({ shop: existingShop })
    vi.mocked(api.updateShop).mockResolvedValue({ shop: existingShop })
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })
  })

  it('opens the crop dialog when a profile picture is selected, at a 1:1 ratio', async () => {
    const user = userEvent.setup()
    renderAt('/shops/new', '/shops/new')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.upload(screen.getByLabelText(/profile picture/i), pngFile())

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Crop your profile picture')
    expect(screen.getByTestId('cropper')).toHaveAttribute('data-aspect', '1')
  })

  it('uses a wide banner ratio for the cover photo', async () => {
    const user = userEvent.setup()
    renderAt('/shops/new', '/shops/new')

    await user.upload(screen.getByLabelText(/cover photo/i), pngFile())

    await screen.findByRole('dialog')
    expect(screen.getByTestId('cropper')).toHaveAttribute('data-aspect', '3')
  })

  it('submits the cropped blob, not the file that was picked', async () => {
    const user = userEvent.setup()
    renderAt('/shops/new', '/shops/new')

    await user.upload(screen.getByLabelText(/profile picture/i), pngFile())
    await screen.findByRole('dialog')

    await user.click(await screen.findByRole('button', { name: /use photo/i }))

    // Dialog closes and the cropped result is previewed in its place.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByAltText(/cropped profile picture preview/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Tita Nena Kitchen')
    await user.click(screen.getByRole('button', { name: /save shop/i }))

    await waitFor(() => expect(api.createShop).toHaveBeenCalled())
    const form = vi.mocked(api.createShop).mock.calls[0][0]
    const submitted = form.get('shop[profile_photo]') as File

    expect(submitted).toBeInstanceOf(File)
    expect(await readText(submitted)).toBe('cropped-bytes')
    expect(await readText(submitted)).not.toBe('original-bytes')
    // Original mime type is preserved, so the API's allow-list still passes.
    expect(submitted.type).toBe('image/png')
  })

  it('discards the crop and uploads nothing when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    renderAt('/shops/new', '/shops/new')

    await user.upload(screen.getByLabelText(/profile picture/i), pngFile())
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByAltText(/cropped profile picture preview/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Tita Nena Kitchen')
    await user.click(screen.getByRole('button', { name: /save shop/i }))

    await waitFor(() => expect(api.createShop).toHaveBeenCalled())
    const form = vi.mocked(api.createShop).mock.calls[0][0]
    expect(form.get('shop[profile_photo]')).toBeNull()
  })

  it('leaves the saved photo showing until a new crop replaces it', async () => {
    vi.mocked(api.getShop).mockResolvedValue({
      shop: {
        ...existingShop,
        profile_photo: {
          id: 1,
          url: '/rails/blob/pic.jpg',
          filename: 'pic.jpg',
          byte_size: 100,
          content_type: 'image/jpeg',
        },
      },
    })

    renderAt('/shops/5/edit', '/shops/:id/edit')

    expect(await screen.findByAltText('pic.jpg')).toBeInTheDocument()
  })
})

describe('ShopFormPage back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })
    vi.mocked(api.getShop).mockResolvedValue({ shop: existingShop })
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })
  })

  it('offers a way back to the dashboard when editing', async () => {
    renderAt('/shops/5/edit', '/shops/:id/edit')

    const link = await screen.findByRole('link', { name: /back to dashboard/i })
    expect(link).toHaveAttribute('href', '/shops')
  })

  it('shows no back link when creating a shop', async () => {
    renderAt('/shops/new', '/shops/new')

    expect(await screen.findByRole('heading', { name: 'New shop' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back to dashboard/i })).not.toBeInTheDocument()
  })
})

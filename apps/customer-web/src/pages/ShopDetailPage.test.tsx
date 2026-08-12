import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDetailPage } from './ShopDetailPage'
import { AuthProvider } from '../auth'
import { CartProvider } from '../CartContext'
import { CartButton } from '../components/CartButton'
import { api, ApiError, setToken } from '../api/client'
import type { Shop } from '../api/types'

const { shop, item, user } = vi.hoisted(() => ({
  shop: {
    id: 1, name: "Lola's Kitchen", slug: 'lolas-kitchen', description: null,
    building: null, fulfillment_methods: ['pickup'] as Shop['fulfillment_methods'], open: true,
    profile_photo: null, cover_photo: null,
    average_rating: null, ratings_count: 0,
    price_range_cents: null, completed_orders_count: 0, demo: false, verified: false,
  },
  item: {
    id: 10, shop_id: 1, name: 'Adobo Bowl', description: null, price_cents: 18000,
    currency: 'PHP', enabled: true, stock_count: null, sold_out: false, tags: [], photos: [], demo: false,
  },
  user: {
    id: 5, email: 'neighbor@example.com',
    customer_profile: { id: 1, display_name: 'Neighbor', default_address_id: null },
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getShop: vi.fn().mockResolvedValue({ shop }),
      listItems: vi.fn().mockResolvedValue({ items: [item] }),
      listShopRatings: vi.fn().mockResolvedValue({ ratings: [] }),
      me: vi.fn().mockResolvedValue({ user }),
      getCart: vi.fn().mockResolvedValue({ cart: null }),
      addCartItem: vi.fn(),
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
      checkout: vi.fn(),
    },
  }
})

// CartButton stands in for the header here: the cart lives in the global
// header now, not on this page, but the page's flow still ends at the cart, so
// the tests need something to open it with.
function renderPage(initialEntries = ['/shops/lolas-kitchen']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <CartProvider>
          <CartButton />
          <Routes>
            <Route path="/shops" element={<p>All shops page</p>} />
            <Route path="/shops/:slug" element={<ShopDetailPage />} />
            <Route path="/login" element={<p>Login page</p>} />
            <Route path="/orders/:id/placed" element={<p>Order placed page</p>} />
            <Route path="/orders/:id" element={<p>Order page</p>} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function addButton(name = 'Adobo Bowl') {
  return screen.getByRole('button', { name: new RegExp(`add ${name} to cart`, 'i') })
}

describe('ShopDetailPage cart flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('adds to a local guest cart for an anonymous visitor, without calling the backend', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(addButton())
    expect(api.addCartItem).not.toHaveBeenCalled()

    const cartIcon = await screen.findByRole('button', { name: /cart, 1 item/i })
    await userEvent.click(cartIcon)
    const drawer = await screen.findByRole('dialog', { name: /your cart/i })
    expect(within(drawer).getByText('Your cart')).toBeInTheDocument()
    // Line total and subtotal, one item in the cart.
    expect(within(drawer).getAllByText('PHP 180.00')).toHaveLength(2)
  })

  it('redirects an anonymous visitor to login on checkout, retaining the guest cart', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(addButton())
    await userEvent.click(await screen.findByRole('button', { name: /cart, 1 item/i }))
    // The checkout handle now requires a drag gesture, not a plain click —
    // a keyboard Enter still confirms directly (see DragToConfirmButton).
    screen.getByRole('button', { name: /place order/i }).focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(api.checkout).not.toHaveBeenCalled()
    expect(localStorage.getItem('kapitmarket_guest_cart:1')).toBe(JSON.stringify({ 10: 1 }))
  })

  it('merges a pre-existing guest cart into the backend cart when a signed-in customer visits the shop', async () => {
    setToken('fake-token')
    localStorage.setItem('kapitmarket_guest_cart:1', JSON.stringify({ 10: 2 }))
    const mergedCart = {
      id: 1, shop_id: 1, status: 'active', subtotal_cents: 36000,
      items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 2, line_total_cents: 36000 }],
    }
    vi.mocked(api.addCartItem).mockResolvedValue({ cart: mergedCart })
    vi.mocked(api.getCart).mockResolvedValueOnce({ cart: mergedCart })

    renderPage()
    await screen.findByText('Adobo Bowl')

    expect(api.addCartItem).toHaveBeenCalledWith(1, 10, 2)
    const cartIcon = await screen.findByRole('button', { name: /cart, 2 items/i })
    await userEvent.click(cartIcon)
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
    expect(localStorage.getItem('kapitmarket_guest_cart:1')).toBeNull()
  })

  it('adds to the real backend cart for a signed-in customer, then places an order from the cart drawer', async () => {
    setToken('fake-token')
    vi.mocked(api.addCartItem).mockResolvedValue({
      cart: { id: 1, shop_id: 1, status: 'active', subtotal_cents: 18000, items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 1, line_total_cents: 18000 }] },
    })
    vi.mocked(api.checkout).mockResolvedValue({
      order: { id: 999 } as never,
    })

    renderPage()
    await screen.findByText('Adobo Bowl')

    await userEvent.click(addButton())
    expect(api.addCartItem).toHaveBeenCalledWith(1, 10)

    // The cart is a drawer behind the header icon now — nothing about it is on
    // the page itself until that icon is clicked.
    const cartIcon = await screen.findByRole('button', { name: /cart, 1 item/i })
    expect(screen.queryByText('Your cart')).not.toBeInTheDocument()
    await userEvent.click(cartIcon)
    expect(await screen.findByText('Your cart')).toBeInTheDocument()

    // The checkout handle now requires a drag gesture, not a plain click —
    // a keyboard Enter still confirms directly (see DragToConfirmButton).
    screen.getByRole('button', { name: /place order/i }).focus()
    await userEvent.keyboard('{Enter}')
    expect(api.checkout).toHaveBeenCalledWith(1, 'pickup')
    expect(await screen.findByText('Order placed page')).toBeInTheDocument()
  })

  it('renders a sold-out item dimmed with a disabled Sold out button and no stepper', async () => {
    const soldOutItem = { ...item, id: 20, name: 'Pandesal', sold_out: true, stock_count: 0 }
    vi.mocked(api.listItems).mockResolvedValueOnce({ items: [item, soldOutItem] })

    renderPage()
    await screen.findByText('Pandesal')

    const row = screen.getByText('Pandesal').closest('li')!
    expect(row).toHaveClass('dimmed')
    expect(within(row).getAllByText('Sold out')).toHaveLength(2) // label + disabled button
    expect(within(row).getByRole('button', { name: /sold out/i })).toBeDisabled()
    expect(within(row).queryByRole('button', { name: /add pandesal to cart/i })).not.toBeInTheDocument()
  })

  it('flags a sold-out line already in the cart and disables Place order', async () => {
    setToken('fake-token')
    const soldOutItem = { ...item, sold_out: true, stock_count: 0 }
    // The page's data-loading effect is keyed on [slug, user] and runs once
    // before AuthProvider's async api.me() resolves (user still null) and
    // again right after (user populated) — listItems is called both times,
    // so both need to resolve to the same sold-out item.
    vi.mocked(api.listItems).mockResolvedValueOnce({ items: [soldOutItem] }).mockResolvedValueOnce({ items: [soldOutItem] })
    vi.mocked(api.getCart).mockResolvedValueOnce({
      cart: { id: 1, shop_id: 1, status: 'active', subtotal_cents: 18000, items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 1, line_total_cents: 18000 }] },
    })

    renderPage()
    await screen.findByText('Adobo Bowl')

    await userEvent.click(await screen.findByRole('button', { name: /cart, 1 item/i }))

    expect(await screen.findByText(/gone sold out/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled()
    expect(api.checkout).not.toHaveBeenCalled()
  })

  it('surfaces a clear error if checkout still rejects with unavailable items despite passing client-side checks', async () => {
    setToken('fake-token')
    vi.mocked(api.addCartItem).mockResolvedValue({
      cart: { id: 1, shop_id: 1, status: 'active', subtotal_cents: 18000, items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 1, line_total_cents: 18000 }] },
    })
    vi.mocked(api.checkout).mockRejectedValue(
      new ApiError(422, 'unprocessable', 'Some items are no longer available', {
        unavailable_items: [{ item_id: 10, name: 'Adobo Bowl' }],
      }),
    )

    renderPage()
    await screen.findByText('Adobo Bowl')
    await userEvent.click(addButton())

    await userEvent.click(await screen.findByRole('button', { name: /cart, 1 item/i }))
    // The checkout handle now requires a drag gesture, not a plain click —
    // a keyboard Enter still confirms directly (see DragToConfirmButton).
    screen.getByRole('button', { name: /place order/i }).focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i)
  })
})

describe('ShopDetailPage item stepper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('swaps the "+" for a "− n +" stepper once the item is in the cart, without opening the cart', async () => {
    renderPage()
    await screen.findByText('Adobo Bowl')

    const row = screen.getByText('Adobo Bowl').closest('li')!
    expect(within(row).queryByText('1')).not.toBeInTheDocument()

    await userEvent.click(addButton())
    expect(within(row).getByText('1')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /remove one adobo bowl/i })).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('button', { name: /add adobo bowl to cart/i }))
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('Your cart')).not.toBeInTheDocument()
  })

  it('steps back down to a bare "+" when the last one is removed', async () => {
    renderPage()
    await screen.findByText('Adobo Bowl')

    const row = screen.getByText('Adobo Bowl').closest('li')!
    await userEvent.click(addButton())
    await userEvent.click(within(row).getByRole('button', { name: /remove one adobo bowl/i }))

    expect(within(row).queryByRole('button', { name: /remove one adobo bowl/i })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /add adobo bowl to cart/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cart, empty/i })).toBeInTheDocument()
  })
})

describe('ShopDetailPage hero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // clearAllMocks keeps implementations, so the photo-bearing shop set by one
    // test would otherwise leak into the fallback test below it.
    vi.mocked(api.getShop).mockResolvedValue({ shop } as never)
  })

  it('renders the cover photo and profile photo when the shop has them', async () => {
    vi.mocked(api.getShop).mockResolvedValue({
      shop: {
        ...shop,
        cover_photo: { id: 1, url: '/covers/1.jpg', filename: 'c.jpg', byte_size: 1, content_type: 'image/jpeg' },
        profile_photo: { id: 2, url: '/avatars/2.jpg', filename: 'p.jpg', byte_size: 1, content_type: 'image/jpeg' },
      },
    } as never)

    renderPage()
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    expect(document.querySelector('img.shop-cover')).toHaveAttribute('src', expect.stringContaining('/covers/1.jpg'))
    expect(document.querySelector('img.shop-avatar')).toHaveAttribute('src', expect.stringContaining('/avatars/2.jpg'))
  })

  it('falls back to the emoji/colour tiles when the shop has no photos', async () => {
    renderPage()
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    expect(document.querySelector('img.shop-cover')).toBeNull()
    expect(document.querySelector('.shop-cover.tile')).toBeInTheDocument()
    expect(document.querySelector('.shop-avatar.tile')).toBeInTheDocument()
  })

  it('offers a circular back button overlaid on the cover instead of a text link', async () => {
    renderPage()
    await screen.findByRole('heading', { name: "Lola's Kitchen" })

    const back = screen.getByRole('link', { name: /back to all shops/i })
    expect(back).toHaveAttribute('href', '/shops')
    expect(back).toHaveClass('shop-back')
    expect(screen.queryByText(/all shops$/i)).not.toBeInTheDocument()

    await userEvent.click(back)
    expect(await screen.findByText('All shops page')).toBeInTheDocument()
  })
})

describe('ShopDetailPage reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listItems).mockResolvedValue({ items: [item] })
    vi.mocked(api.getCart).mockResolvedValue({ cart: null })
  })

  it('collapses the review list behind a toggle, and does not fetch it until opened', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, average_rating: 4.2, ratings_count: 7 } })
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })

    renderPage()
    // The shop hero has its own rating summary too, so anchor on the toggle
    // itself (unique) rather than the "★ 4.2" text (which appears twice).
    await screen.findByRole('button', { name: /show reviews \(7\)/i })

    expect(api.listShopRatings).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /show reviews/i }))

    expect(api.listShopRatings).toHaveBeenCalledWith('lolas-kitchen', { limit: 5, offset: 0 })
    expect(await screen.findByRole('button', { name: /hide reviews/i })).toBeInTheDocument()
  })

  it('paginates 5 at a time, most-recent-first, with Newer/Older controls', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, average_rating: 4.5, ratings_count: 12 } })
    vi.mocked(api.listShopRatings).mockResolvedValue({
      ratings: [
        { id: 1, reviewer_display_name: 'Marco', score: 5, comment: null, created_at: '2026-01-01T00:00:00Z' },
      ],
    })

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /show reviews/i }))

    await screen.findByText('Marco')
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /newer/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /older/i })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: /older/i }))

    expect(api.listShopRatings).toHaveBeenLastCalledWith('lolas-kitchen', { limit: 5, offset: 5 })
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /newer/i })).toBeEnabled()
  })

  it('shows no toggle and no pagination for an unrated shop', async () => {
    vi.mocked(api.getShop).mockResolvedValue({ shop: { ...shop, average_rating: null, ratings_count: 0 } })
    vi.mocked(api.listShopRatings).mockResolvedValue({ ratings: [] })

    renderPage()
    await screen.findByText(/no reviews yet/i)

    expect(screen.queryByRole('button', { name: /show reviews/i })).not.toBeInTheDocument()
  })
})

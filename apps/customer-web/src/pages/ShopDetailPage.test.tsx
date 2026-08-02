import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDetailPage } from './ShopDetailPage'
import { AuthProvider } from '../auth'
import { api, ApiError, setToken } from '../api/client'

const { shop, item, user } = vi.hoisted(() => ({
  shop: {
    id: 1, name: "Lola's Kitchen", slug: 'lolas-kitchen', description: null,
    contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [],
    average_rating: null, ratings_count: 0,
  },
  item: {
    id: 10, shop_id: 1, name: 'Adobo Bowl', description: null, price_cents: 18000,
    currency: 'PHP', enabled: true, stock_count: null, sold_out: false, tags: [], photos: [],
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

function renderPage(initialEntries = ['/shops/lolas-kitchen']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/shops/:slug" element={<ShopDetailPage />} />
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/orders/:id" element={<p>Order page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ShopDetailPage cart flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('adds to a local guest cart for an anonymous visitor, without calling the backend', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(api.addCartItem).not.toHaveBeenCalled()

    const cartFab = await screen.findByRole('button', { name: /1 item.*180\.00/i })
    await userEvent.click(cartFab)
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
  })

  it('redirects an anonymous visitor to login on checkout, retaining the guest cart', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    const cartFab = await screen.findByRole('button', { name: /1 item/i })
    await userEvent.click(cartFab)
    await userEvent.click(screen.getByRole('button', { name: /place order/i }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(api.checkout).not.toHaveBeenCalled()
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
    const cartFab = await screen.findByRole('button', { name: /2 item/i })
    await userEvent.click(cartFab)
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
    expect(localStorage.getItem('kapitmarket_guest_cart:1')).toBeNull()
  })

  it('adds to the real backend cart for a signed-in customer, then places an order via the floating cart button', async () => {
    setToken('fake-token')
    vi.mocked(api.addCartItem).mockResolvedValue({
      cart: { id: 1, shop_id: 1, status: 'active', subtotal_cents: 18000, items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 1, line_total_cents: 18000 }] },
    })
    vi.mocked(api.checkout).mockResolvedValue({
      order: { id: 999 } as never,
    })

    renderPage()
    await screen.findByText('Adobo Bowl')

    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(api.addCartItem).toHaveBeenCalledWith(1, 10)

    // The cart summary panel is collapsed by default behind the floating
    // "N items · subtotal" button — it only appears once that's clicked.
    const cartFab = await screen.findByRole('button', { name: /1 item.*180\.00/i })
    expect(screen.queryByText('Your cart')).not.toBeInTheDocument()
    await userEvent.click(cartFab)
    expect(await screen.findByText('Your cart')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /place order/i }))
    expect(api.checkout).toHaveBeenCalledWith(1, 'pickup')
    expect(await screen.findByText('Order page')).toBeInTheDocument()
  })

  it('renders a sold-out item dimmed with a disabled Add to cart button', async () => {
    const soldOutItem = { ...item, id: 20, name: 'Pandesal', sold_out: true, stock_count: 0 }
    vi.mocked(api.listItems).mockResolvedValueOnce({ items: [item, soldOutItem] })

    renderPage()
    await screen.findByText('Pandesal')

    const row = screen.getByText('Pandesal').closest('li')!
    expect(row).toHaveClass('dimmed')
    expect(within(row).getAllByText('Sold out')).toHaveLength(2) // label + disabled button
    expect(within(row).getByRole('button', { name: /sold out/i })).toBeDisabled()
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

    const cartFab = await screen.findByRole('button', { name: /1 item/i })
    await userEvent.click(cartFab)

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
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))

    const cartFab = await screen.findByRole('button', { name: /1 item/i })
    await userEvent.click(cartFab)
    await userEvent.click(screen.getByRole('button', { name: /place order/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i)
  })
})

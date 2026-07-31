import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDetailPage } from './ShopDetailPage'
import { AuthProvider } from '../auth'
import { api, setToken } from '../api/client'

const { shop, item, user } = vi.hoisted(() => ({
  shop: {
    id: 1, name: "Lola's Kitchen", slug: 'lolas-kitchen', description: null,
    contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [],
  },
  item: {
    id: 10, shop_id: 1, name: 'Adobo Bowl', description: null, price_cents: 18000,
    currency: 'PHP', enabled: true, tags: [], photos: [],
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

  it('sends an anonymous visitor to sign in instead of adding to cart', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(api.addCartItem).not.toHaveBeenCalled()
  })

  it('adds to the real backend cart for a signed-in customer, then places an order at checkout', async () => {
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
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
    expect(api.addCartItem).toHaveBeenCalledWith(1, 10)

    await userEvent.click(screen.getByRole('button', { name: /place order/i }))
    expect(api.checkout).toHaveBeenCalledWith(1, 'pickup')
    expect(await screen.findByText('Order page')).toBeInTheDocument()
  })
})

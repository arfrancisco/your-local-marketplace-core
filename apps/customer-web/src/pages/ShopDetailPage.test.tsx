import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDetailPage } from './ShopDetailPage'
import { AuthProvider } from '../auth'
import { api } from '../api/client'

const { shop, item } = vi.hoisted(() => ({
  shop: {
    id: 1, name: "Lola's Kitchen", slug: 'lolas-kitchen', description: null,
    contact_number: null, address: null, fulfillment_methods: ['pickup'], open: true, photos: [],
  },
  item: {
    id: 10, shop_id: 1, name: 'Adobo Bowl', description: null, price_cents: 18000,
    currency: 'PHP', enabled: true, tags: [], photos: [],
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    getToken: () => null,
    setToken: vi.fn(),
    api: {
      ...actual.api,
      getShop: vi.fn().mockResolvedValue({ shop }),
      listItems: vi.fn().mockResolvedValue({ items: [item] }),
      me: vi.fn(),
      getCart: vi.fn().mockResolvedValue({ cart: null }),
      register: vi.fn().mockResolvedValue({
        token: 't', user: { id: 1, email: 'neighbor@example.com', customer_profile: { id: 1, display_name: 'Neighbor', default_address_id: null } },
      }),
      addCartItem: vi.fn().mockResolvedValue({
        cart: { id: 1, shop_id: 1, status: 'active', items: [{ id: 100, item_id: 10, name: 'Adobo Bowl', price_cents: 18000, currency: 'PHP', quantity: 1, line_total_cents: 18000 }], subtotal_cents: 18000 },
      }),
    },
  }
})

const addCartItem = vi.mocked(api.addCartItem)
const register = vi.mocked(api.register)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shops/lolas-kitchen']}>
      <AuthProvider>
        <Routes>
          <Route path="/shops/:slug" element={<ShopDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ShopDetailPage cart flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prompts for an account on first Add to cart, then adds the item once signed up', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))

    // Logged out: an account prompt appears instead of adding immediately.
    expect(await screen.findByText(/quick account to start your cart/i)).toBeInTheDocument()
    expect(addCartItem).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Name'), 'Neighbor')
    await userEvent.type(screen.getByLabelText('Email'), 'neighbor@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'sup3rsecret')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(register).toHaveBeenCalledWith('neighbor@example.com', 'sup3rsecret', 'Neighbor')
    // The originally-requested item is added automatically once signed in.
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
    expect(addCartItem).toHaveBeenCalledWith(1, 10, 1)
  })
})

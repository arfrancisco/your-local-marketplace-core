import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './auth'
import { CartProvider, useCart } from './CartContext'
import { CartButton } from './components/CartButton'
import { api } from './api/client'
import type { Item, Shop } from './api/types'

const shop: Shop = {
  id: 1, name: "Lola's Kitchen", slug: 'lolas-kitchen', description: null,
  contact_number: null, building: null, fulfillment_methods: ['pickup'], open: true,
  profile_photo: null, cover_photo: null, average_rating: null, ratings_count: 0,
  price_range_cents: null, completed_orders_count: 0,
}

const item: Item = {
  id: 10, shop_id: 1, name: 'Adobo Bowl', description: null, price_cents: 18000,
  currency: 'PHP', enabled: true, stock_count: null, sold_out: false, tags: [], photos: [],
}

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      getCart: vi.fn().mockResolvedValue({ cart: null }),
      addCartItem: vi.fn(),
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
      checkout: vi.fn(),
    },
  }
})

// Stands in for ShopDetailPage: pushes a shop + its items into the cart, then
// exposes the cart operations the item cards would call.
function Harness() {
  const { loadShopCart, addToCart, changeQuantity, count } = useCart()

  useEffect(() => {
    void loadShopCart(shop, [item])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <button onClick={() => addToCart(item)}>add one</button>
      <button onClick={() => changeQuantity(item.id, count - 1)}>remove one</button>
    </div>
  )
}

function renderCart() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CartProvider>
          <CartButton />
          <Harness />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('CartContext + header cart icon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows no badge on an empty cart', async () => {
    renderCart()
    const button = await screen.findByRole('button', { name: /cart, empty/i })
    expect(button.querySelector('.cart-badge')).toBeNull()
  })

  it('badges the icon with the total item count as items are added and removed', async () => {
    renderCart()
    await screen.findByRole('button', { name: /cart, empty/i })

    await userEvent.click(screen.getByRole('button', { name: 'add one' }))
    expect(await screen.findByRole('button', { name: /cart, 1 item$/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'add one' }))
    const button = await screen.findByRole('button', { name: /cart, 2 items/i })
    expect(button.querySelector('.cart-badge')).toHaveTextContent('2')

    await userEvent.click(screen.getByRole('button', { name: 'remove one' }))
    expect(await screen.findByRole('button', { name: /cart, 1 item$/i })).toBeInTheDocument()
  })

  it('bumps the icon when the count goes up, then clears the animation class', async () => {
    renderCart()
    const button = await screen.findByRole('button', { name: /cart, empty/i })
    expect(button).not.toHaveClass('bump')

    await userEvent.click(screen.getByRole('button', { name: 'add one' }))
    await waitFor(() => expect(button).toHaveClass('bump'))

    // Dropped again once the animation is over, so the next add can re-trigger.
    await waitFor(() => expect(button).not.toHaveClass('bump'), { timeout: 2000 })
  })

  it('does not bump when the count goes down', async () => {
    renderCart()
    const button = await screen.findByRole('button', { name: /cart, empty/i })

    await userEvent.click(screen.getByRole('button', { name: 'add one' }))
    await waitFor(() => expect(button).not.toHaveClass('bump'), { timeout: 2000 })

    await userEvent.click(screen.getByRole('button', { name: 'remove one' }))
    await screen.findByRole('button', { name: /cart, empty/i })
    expect(button).not.toHaveClass('bump')
  })

  it('opens the cart drawer when the icon is clicked, and closes it again', async () => {
    renderCart()
    await screen.findByRole('button', { name: /cart, empty/i })
    await userEvent.click(screen.getByRole('button', { name: 'add one' }))

    await userEvent.click(await screen.findByRole('button', { name: /cart, 1 item$/i }))
    const drawer = await screen.findByRole('dialog', { name: /your cart/i })
    expect(drawer).toHaveClass('sheet')
    expect(screen.getByText('Adobo Bowl')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /close cart/i }))
    expect(screen.queryByRole('dialog', { name: /your cart/i })).not.toBeInTheDocument()
  })

  it('keeps the anonymous cart entirely local — no backend calls', async () => {
    renderCart()
    await screen.findByRole('button', { name: /cart, empty/i })

    await userEvent.click(screen.getByRole('button', { name: 'add one' }))
    await screen.findByRole('button', { name: /cart, 1 item$/i })

    expect(api.addCartItem).not.toHaveBeenCalled()
    expect(api.getCart).not.toHaveBeenCalled()
    expect(localStorage.getItem('kapitmarket_guest_cart:1')).toBe(JSON.stringify({ 10: 1 }))
  })
})

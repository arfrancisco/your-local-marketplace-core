import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDetailPage } from './ShopDetailPage'
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
    api: {
      ...actual.api,
      getShop: vi.fn().mockResolvedValue({ shop }),
      listItems: vi.fn().mockResolvedValue({ items: [item] }),
      earlyAccess: vi.fn().mockResolvedValue({ status: 'registered' }),
    },
  }
})

const earlyAccess = vi.mocked(api.earlyAccess)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shops/lolas-kitchen']}>
      <Routes>
        <Route path="/shops/:slug" element={<ShopDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ShopDetailPage cart flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('adds items to a local cart with no account required, then gates checkout on early access', async () => {
    renderPage()

    await screen.findByText('Adobo Bowl')
    expect(screen.queryByText(/quick account/i)).not.toBeInTheDocument()

    const addButton = screen.getByRole('button', { name: /add to cart/i })
    await userEvent.click(addButton)
    await userEvent.click(addButton)

    expect(await screen.findByText('Your cart')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // quantity
    // Line total and subtotal both read PHP 360.00 here since it's a single-item cart.
    expect(screen.getAllByText('PHP 360.00')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(await screen.findByText(/ordering is coming soon/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Email'), 'neighbor@example.com')
    await userEvent.click(screen.getByRole('button', { name: /join early access/i }))

    expect(earlyAccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'neighbor@example.com', context: expect.stringContaining("Lola's Kitchen — checkout (2 items") }),
    )
  })

  it('persists the cart across a reload via localStorage', async () => {
    const { unmount } = renderPage()
    await screen.findByText('Adobo Bowl')
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    await screen.findByText('Your cart')
    unmount()

    renderPage()
    expect(await screen.findByText('Your cart')).toBeInTheDocument()
  })
})

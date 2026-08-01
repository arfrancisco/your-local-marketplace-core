import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ItemsPage } from './ItemsPage'
import { api } from '../api/client'
import type { Item } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listItems: vi.fn(),
      createItem: vi.fn(),
      enableItem: vi.fn(),
      disableItem: vi.fn(),
    },
  }
})

const baseItem: Item = {
  id: 1,
  shop_id: 5,
  name: 'Lumpia',
  description: null,
  price_cents: 15000,
  currency: 'PHP',
  enabled: true,
  stock_count: null,
  sold_out: false,
  position: 0,
  tags: [],
  photos: [],
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shops/:id/items" element={<ItemsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ItemsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the "Inventory" heading (renamed from "Items")', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [] })

    renderAt('/shops/5/items')

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
  })

  it('leaves stock_count out of the create request entirely when the field is left blank', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [] })
    vi.mocked(api.createItem).mockResolvedValue({ item: { ...baseItem, id: 2 } })

    renderAt('/shops/5/items')
    await screen.findByLabelText('Name')

    await userEvent.type(screen.getByLabelText('Name'), 'Turon')
    await userEvent.type(screen.getByLabelText('Price'), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))

    expect(api.createItem).toHaveBeenCalledTimes(1)
    const fd = vi.mocked(api.createItem).mock.calls[0][1]
    expect(fd.has('item[stock_count]')).toBe(false)
  })

  it('sends stock_count in the create request when a value is entered', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [] })
    vi.mocked(api.createItem).mockResolvedValue({ item: { ...baseItem, id: 3, stock_count: 10 } })

    renderAt('/shops/5/items')
    await screen.findByLabelText('Name')

    await userEvent.type(screen.getByLabelText('Name'), 'Turon')
    await userEvent.type(screen.getByLabelText('Price'), '50')
    await userEvent.type(screen.getByLabelText(/Stock count/), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))

    const fd = vi.mocked(api.createItem).mock.calls[0][1]
    expect(fd.get('item[stock_count]')).toBe('10')
  })

  it('shows an Edit link per item, and a sold-out/in-stock hint when stock is tracked', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, stock_count: 4, sold_out: false },
        { ...baseItem, id: 2, stock_count: 0, sold_out: true },
      ],
    })

    renderAt('/shops/5/items')

    expect(await screen.findAllByRole('link', { name: 'Edit' })).toHaveLength(2)
    expect(screen.getByText('4 in stock')).toBeInTheDocument()
    expect(screen.getByText('Sold out')).toBeInTheDocument()
  })
})

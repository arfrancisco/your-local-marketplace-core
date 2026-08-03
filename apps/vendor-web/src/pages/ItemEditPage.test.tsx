import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ItemEditPage } from './ItemEditPage'
import { api } from '../api/client'
import type { Item } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listItems: vi.fn(),
      updateItem: vi.fn(),
    },
  }
})

const existingItem: Item = {
  id: 7,
  shop_id: 5,
  name: 'Lumpia',
  description: 'Crispy spring rolls',
  price_cents: 15000,
  currency: 'PHP',
  enabled: true,
  archived: false,
  stock_count: 8,
  sold_out: false,
  position: 0,
  tags: [{ id: 1, name: 'savory', slug: 'savory' }],
  photos: [],
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shops/:id/items/:itemId/edit" element={<ItemEditPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ItemEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills the form from the existing item (found via listItems, no dedicated GET endpoint)', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [existingItem] })

    renderAt('/shops/5/items/7/edit')

    expect(await screen.findByDisplayValue('Lumpia')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Crispy spring rolls')).toBeInTheDocument()
    expect(screen.getByDisplayValue('150.00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('savory')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
    expect(api.listItems).toHaveBeenCalledWith(5)
  })

  it('shows a not-found state instead of crashing when the item id is not in this shop', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [] })

    renderAt('/shops/5/items/999/edit')

    expect(await screen.findByText('Item not found')).toBeInTheDocument()
  })

  it('submits edits via api.updateItem, including a blank stock count staying omitted', async () => {
    vi.mocked(api.listItems).mockResolvedValue({ items: [existingItem] })
    vi.mocked(api.updateItem).mockResolvedValue({ item: { ...existingItem, name: 'Lumpia Shanghai' } })

    renderAt('/shops/5/items/7/edit')
    await screen.findByDisplayValue('Lumpia')

    const nameInput = screen.getByLabelText(/^Name/)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Lumpia Shanghai')
    await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

    expect(api.updateItem).toHaveBeenCalledTimes(1)
    const [id, fd] = vi.mocked(api.updateItem).mock.calls[0]
    expect(id).toBe(7)
    expect(fd.get('item[name]')).toBe('Lumpia Shanghai')
    // Prefilled stock count (8) was left untouched, so it should still be sent.
    expect(fd.get('item[stock_count]')).toBe('8')

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })
})

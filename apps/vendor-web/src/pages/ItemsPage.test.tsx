import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
      updateItem: vi.fn(),
      archiveItem: vi.fn(),
      unarchiveItem: vi.fn(),
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
  archived: false,
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
    await userEvent.click(await screen.findByRole('button', { name: 'Add item' }))
    await screen.findByLabelText(/^Name/)

    await userEvent.type(screen.getByLabelText(/^Name/), 'Turon')
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
    await userEvent.click(await screen.findByRole('button', { name: 'Add item' }))
    await screen.findByLabelText(/^Name/)

    await userEvent.type(screen.getByLabelText(/^Name/), 'Turon')
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

  it('lays the items out as a table row per item, with a cell per column', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, name: 'Lumpia', tags: [{ id: 7, name: 'savory', slug: 'savory' }] },
        { ...baseItem, id: 2, name: 'Turon' },
      ],
    })

    renderAt('/shops/5/items')

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Order' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Item' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Price' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Stock' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()

    // Header row plus one row per item.
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByRole('cell', { name: 'Lumpia' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Turon' })).toBeInTheDocument()
    expect(screen.getAllByRole('cell', { name: 'PHP 150.00' })).toHaveLength(2)
    expect(screen.getByRole('cell', { name: 'savory' })).toBeInTheDocument()
    // Untracked stock reads as a placeholder rather than an empty cell.
    expect(screen.getAllByRole('cell', { name: 'Not tracked' })).toHaveLength(2)
  })

  it('labels the visibility toggle Hide/Show and calls the enable/disable endpoints', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, name: 'Lumpia', enabled: true },
        { ...baseItem, id: 2, name: 'Turon', enabled: false },
      ],
    })
    vi.mocked(api.disableItem).mockResolvedValue({
      item: { ...baseItem, id: 1, name: 'Lumpia', enabled: false },
    })

    renderAt('/shops/5/items')

    const hide = await screen.findByRole('button', { name: 'Hide' })
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument()

    await userEvent.click(hide)

    expect(api.disableItem).toHaveBeenCalledWith(1)
    // The row flips to "Show" once the item comes back disabled.
    expect(await screen.findAllByRole('button', { name: 'Show' })).toHaveLength(2)
  })

  it('states plainly whether an item is currently shown or hidden, separate from the action button', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, name: 'Lumpia', enabled: true },
        { ...baseItem, id: 2, name: 'Turon', enabled: false },
      ],
    })

    renderAt('/shops/5/items')

    expect(await screen.findByText('Shown in shop')).toBeInTheDocument()
    expect(screen.getByText('Hidden from shop')).toBeInTheDocument()
  })

  it('reorders items via arrow keys on the drag handle, as a keyboard-accessible fallback', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, name: 'Lumpia', position: 0 },
        { ...baseItem, id: 2, name: 'Turon', position: 1 },
      ],
    })
    vi.mocked(api.updateItem).mockImplementation(async (id) =>
      id === 1
        ? { item: { ...baseItem, id: 1, name: 'Lumpia', position: 1 } }
        : { item: { ...baseItem, id: 2, name: 'Turon', position: 0 } },
    )

    renderAt('/shops/5/items')
    await screen.findByText('Lumpia')

    const lumpiaHandle = screen.getByRole('button', { name: /drag to reorder Lumpia/i })
    lumpiaHandle.focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(api.updateItem).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(api.updateItem).mock.calls
    const callFor = (id: number) => calls.find((c) => c[0] === id)!
    expect((callFor(1)[1] as FormData).get('item[position]')).toBe('1')
    expect((callFor(2)[1] as FormData).get('item[position]')).toBe('0')

    // Rows swap places: Turon now leads.
    const names = (await screen.findAllByRole('cell', { name: /Lumpia|Turon/ })).map((c) => c.textContent)
    expect(names).toEqual(['Turon', 'Lumpia'])
  })

  it('archives an item, dropping it out of the active list', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [{ ...baseItem, id: 1, name: 'Lumpia' }],
    })
    vi.mocked(api.archiveItem).mockResolvedValue({ item: { ...baseItem, id: 1, name: 'Lumpia', archived: true } })

    renderAt('/shops/5/items')
    await screen.findByText('Lumpia')

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(api.archiveItem).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Lumpia')).not.toBeInTheDocument())
  })

  it('switches to the archived-items view and unarchives from there', async () => {
    vi.mocked(api.listItems).mockImplementation(async (_shopId, archived) =>
      archived
        ? { items: [{ ...baseItem, id: 2, name: 'Old Item', archived: true }] }
        : { items: [{ ...baseItem, id: 1, name: 'Lumpia' }] },
    )
    vi.mocked(api.unarchiveItem).mockResolvedValue({ item: { ...baseItem, id: 2, name: 'Old Item', archived: false } })

    renderAt('/shops/5/items')
    await screen.findByText('Lumpia')

    await userEvent.click(screen.getByRole('button', { name: 'Archived items' }))
    await screen.findByText('Old Item')
    expect(screen.queryByText('Lumpia')).not.toBeInTheDocument()
    // No Edit/Hide affordances or reorder handle for archived items — the
    // only meaningful action is bringing it back.
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Unarchive' }))
    expect(api.unarchiveItem).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByText('Old Item')).not.toBeInTheDocument())
  })

  it('reorders items by dragging a row onto another row\'s drop target', async () => {
    vi.mocked(api.listItems).mockResolvedValue({
      items: [
        { ...baseItem, id: 1, name: 'Lumpia', position: 0 },
        { ...baseItem, id: 2, name: 'Turon', position: 1 },
        { ...baseItem, id: 3, name: 'Halo-halo', position: 2 },
      ],
    })
    vi.mocked(api.updateItem).mockImplementation(async (id, fd) => {
      const position = Number((fd as FormData).get('item[position]'))
      const name = { 1: 'Lumpia', 2: 'Turon', 3: 'Halo-halo' }[id as number]
      return { item: { ...baseItem, id: id as number, name, position } }
    })

    renderAt('/shops/5/items')
    await screen.findByText('Lumpia')

    const lumpiaHandle = screen.getByRole('button', { name: /drag to reorder Lumpia/i })
    const halohaloRow = screen.getByText('Halo-halo').closest('tr')!

    // jsdom implements neither pointer capture nor elementFromPoint; stub
    // both so the pointer-events drag logic (which reads real screen
    // coordinates in a browser) can be exercised here.
    lumpiaHandle.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn().mockReturnValue(halohaloRow)

    fireEvent.pointerDown(lumpiaHandle, { pointerId: 1 })
    fireEvent.pointerMove(lumpiaHandle, { pointerId: 1, clientX: 10, clientY: 400 })
    fireEvent.pointerUp(lumpiaHandle, { pointerId: 1 })

    // Dropping Lumpia (index 0) onto Halo-halo's row (index 2) shifts every
    // row in between, so all three get a position PATCH, not just the two
    // endpoints.
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(3))

    const names = (await screen.findAllByRole('cell', { name: /Lumpia|Turon|Halo-halo/ })).map(
      (c) => c.textContent,
    )
    expect(names).toEqual(['Turon', 'Halo-halo', 'Lumpia'])
  })
})

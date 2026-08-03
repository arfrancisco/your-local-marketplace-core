import { useEffect, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Item } from '../api/types'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function ItemsPage() {
  const { id } = useParams()
  const shopId = Number(id)

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState('')
  const [stockCount, setStockCount] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    api.listItems(shopId).then((res) => setItems(res.items)).finally(() => setLoading(false))
  }, [shopId])

  async function toggleEnabled(item: Item) {
    const res = item.enabled ? await api.disableItem(item.id) : await api.enableItem(item.id)
    setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)))
  }

  const [moving, setMoving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function positionFormData(position: number) {
    const fd = new FormData()
    fd.append('item[position]', String(position))
    return fd
  }

  // Dropping onto an arbitrary row can shift every item between the old and
  // new spot, not just one neighbor, so this renumbers the whole list
  // sequentially and only PATCHes the rows whose position actually changed.
  async function moveItemTo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || moving) return
    const previous = items
    const reordered = [...items]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    setItems(reordered)
    setMoving(true)
    try {
      const changed = reordered
        .map((item, index) => ({ item, index }))
        .filter(({ item, index }) => previous.findIndex((p) => p.id === item.id) !== index)

      const updated = await Promise.all(
        changed.map(({ item, index }) => api.updateItem(item.id, positionFormData(index))),
      )
      setItems((prev) => {
        const next = [...prev]
        updated.forEach(({ item }) => {
          const index = next.findIndex((i) => i.id === item.id)
          if (index !== -1) next[index] = item
        })
        return next
      })
    } catch {
      setItems(previous)
    } finally {
      setMoving(false)
    }
  }

  // Pointer events (not native HTML5 drag-and-drop) so the same code path
  // handles mouse, touch, and pen — native drag-and-drop never fires for
  // touch input at all, which left this unusable on an actual phone despite
  // working fine on desktop.
  function onHandlePointerDown(e: PointerEvent<HTMLButtonElement>, index: number) {
    if (moving) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggedIndex(index)
  }

  function onHandlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (draggedIndex === null) return
    // Pointer capture keeps events targeted at the handle regardless of
    // where the finger/cursor actually is, so figure out what's visually
    // underneath from the raw coordinates instead.
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-item-index]')
    if (!row) return
    setDragOverIndex(Number(row.getAttribute('data-item-index')))
  }

  function onHandlePointerUp() {
    if (draggedIndex !== null && dragOverIndex !== null && dragOverIndex !== draggedIndex) {
      moveItemTo(draggedIndex, dragOverIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Arrow keys on the handle keep reordering keyboard-operable now that
  // dragging is the primary mechanism.
  function onHandleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      moveItemTo(index, index - 1)
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault()
      moveItemTo(index, index + 1)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.append('item[name]', name)
    fd.append('item[description]', description)
    fd.append('item[price_cents]', String(Math.round(parseFloat(price || '0') * 100)))
    tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => fd.append('item[tags][]', t))
    // Left out entirely when blank, rather than sending '' or 0, so the
    // server keeps stock_count as null (untracked) instead of treating the
    // item as sold out.
    if (stockCount.trim() !== '') fd.append('item[stock_count]', stockCount.trim())
    if (files) Array.from(files).forEach((f) => fd.append('item[photos][]', f))

    try {
      const res = await api.createItem(shopId, fd)
      setItems((prev) => [...prev, res.item])
      setName('')
      setDescription('')
      setPrice('')
      setTags('')
      setStockCount('')
      setFiles(null)
      setAddOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add item')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading items…</p>

  return (
    <div>
      <div className="row spread">
        <h1>Inventory</h1>
        <Link to="/shops">Back to shops</Link>
      </div>

      {items.length === 0 ? (
        <p className="muted">No items yet. Add your first one below.</p>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th scope="col" className="reorder-col">Order</th>
              <th scope="col">Item</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Tags</th>
              <th scope="col">Status</th>
              <th scope="col" className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                data-item-index={index}
                className={[
                  item.enabled ? '' : 'dimmed',
                  draggedIndex === index ? 'dragging' : '',
                  dragOverIndex === index && draggedIndex !== index ? 'drag-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td data-label="Order" className="reorder-cell">
                  <button
                    type="button"
                    className="drag-handle"
                    onPointerDown={(e) => onHandlePointerDown(e, index)}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={onHandlePointerUp}
                    onPointerCancel={onHandlePointerUp}
                    onKeyDown={(e) => onHandleKeyDown(e, index)}
                    disabled={moving}
                    aria-label={`Drag to reorder ${item.name}, or use arrow keys`}
                  >
                    ⠿
                  </button>
                </td>
                <td data-label="Item" className="item-name">{item.name}</td>
                <td data-label="Price">{formatPrice(item.price_cents, item.currency)}</td>
                <td data-label="Stock">
                  {item.stock_count === null
                    ? 'Not tracked'
                    : item.sold_out
                      ? 'Sold out'
                      : `${item.stock_count} in stock`}
                </td>
                <td data-label="Tags">
                  {item.tags.length > 0 ? item.tags.map((t) => t.name).join(', ') : '—'}
                </td>
                <td data-label="Status">
                  {/* The action button below says what tapping it will do; this
                      says what's actually true right now — easy to conflate
                      the two when they're both just "Show"/"Hide" text. */}
                  <span className={`item-status ${item.enabled ? 'is-shown' : 'is-hidden'}`}>
                    {item.enabled ? 'Shown in shop' : 'Hidden from shop'}
                  </span>
                </td>
                <td className="actions">
                  <div className="inventory-actions">
                    <Link className="button" to={`/shops/${shopId}/items/${item.id}/edit`}>Edit</Link>
                    <button onClick={() => toggleEnabled(item)}>
                      {item.enabled ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!addOpen && (
        <button
          type="button"
          className="add-item-fab"
          onClick={() => setAddOpen(true)}
          aria-label="Add item"
        >
          +
        </button>
      )}

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div
            className="modal add-item-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add item"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close"
              onClick={() => setAddOpen(false)}
            >
              ×
            </button>
            <form onSubmit={onCreate}>
              <h2>Add item</h2>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label>
                Price
                <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </label>
              <label>
                Tags (comma separated)
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rice meal, savory" />
              </label>
              <label>
                Stock count (optional — leave blank if you don't track stock)
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={stockCount}
                  onChange={(e) => setStockCount(e.target.value)}
                />
              </label>
              <label>
                Photos (up to 6)
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(e.target.files)} />
              </label>
              {error && <p role="alert" className="error">{error}</p>}
              <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add item'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

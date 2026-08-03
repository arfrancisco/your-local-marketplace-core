import { useEffect, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Item } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { ItemActionsMenu } from '../components/ItemActionsMenu'
import { ArchiveItemModal } from '../components/ArchiveItemModal'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

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
  const [showArchived, setShowArchived] = useState(false)
  const [archivingItem, setArchivingItem] = useState<Item | null>(null)

  useEffect(() => {
    setLoading(true)
    api.listItems(shopId, showArchived).then((res) => setItems(res.items)).finally(() => setLoading(false))
  }, [shopId, showArchived])

  async function toggleEnabled(item: Item) {
    const res = item.enabled ? await api.disableItem(item.id) : await api.enableItem(item.id)
    setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)))
  }

  // Archiving/unarchiving moves an item to the other view, so it no longer
  // belongs in whichever list is currently shown — drop it locally rather
  // than trying to update it in place.
  async function unarchiveItem(item: Item) {
    await api.unarchiveItem(item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
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
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('li[data-item-index]')
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
      <p className="back-link">
        <Link to="/shops">← Back to dashboard</Link>
      </p>
      <h1>Inventory</h1>

      <div className="row gap">
        <button type="button" onClick={() => setShowArchived(false)} disabled={!showArchived}>Active</button>
        <button type="button" onClick={() => setShowArchived(true)} disabled={showArchived}>Archived items</button>
      </div>

      {items.length === 0 ? (
        <p className="muted">
          {showArchived ? 'No archived items.' : 'No items yet. Add your first one below.'}
        </p>
      ) : (
        <ul className="list">
          {items.map((item, index) => (
            <li
              key={item.id}
              data-item-index={index}
              className={[
                'card',
                'row',
                'spread',
                'item-row',
                'inventory-item-row',
                item.enabled ? '' : 'hidden-item',
                draggedIndex === index ? 'dragging' : '',
                dragOverIndex === index && draggedIndex !== index ? 'drag-over' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="item-main">
                {!showArchived && (
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
                )}
                {item.photos[0] ? (
                  <img className="thumb" src={`${API_ORIGIN}${item.photos[0].url}`} alt={item.name} />
                ) : (
                  <div className="thumb tile" style={{ background: colorFor(item.name) }} aria-hidden>
                    {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
                  </div>
                )}
                <div>
                  <h3>{item.name}</h3>
                  {item.description && <p className="muted">{item.description}</p>}
                  {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
                  {item.sold_out && <p className="sold-out-label">Sold out</p>}
                </div>
              </div>
              <div className="price-col">
                <strong>{formatPrice(item.price_cents, item.currency)}</strong>
                {item.stock_count !== null && (
                  <span className="muted small">
                    {item.sold_out ? 'Sold out' : `${item.stock_count} in stock`}
                  </span>
                )}
                {!showArchived && (
                  // The action button below says what tapping it will do; this
                  // says what's actually true right now — easy to conflate
                  // the two when they're both just "Show"/"Hide" text.
                  <span className={`item-status ${item.enabled ? 'is-shown' : 'is-hidden'}`}>
                    {item.enabled ? 'Shown in shop' : 'Hidden from shop'}
                  </span>
                )}
                {showArchived && (
                  <button type="button" onClick={() => unarchiveItem(item)}>Unarchive</button>
                )}
              </div>
              {/* Pinned to the card's top-right corner rather than stacked in
                  price-col — keeps the bottom price row free of anything but
                  price/stock/status. */}
              {!showArchived && (
                <ItemActionsMenu
                  item={item}
                  shopId={shopId}
                  onToggleEnabled={() => toggleEnabled(item)}
                  onArchiveRequest={() => setArchivingItem(item)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {!showArchived && !addOpen && (
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
                Name (shown to customers, and matched when they search)
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Description (shown on the item — not used for search)
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label>
                Price
                <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </label>
              <label>
                Tags (comma separated — also matched when customers search, e.g. "vegan" or "spicy")
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
                Photos (up to 3)
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(e.target.files)} />
              </label>
              {error && <p role="alert" className="error">{error}</p>}
              <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add item'}</button>
            </form>
          </div>
        </div>
      )}

      {archivingItem && (
        <ArchiveItemModal
          item={archivingItem}
          onClose={() => setArchivingItem(null)}
          onArchived={() => {
            setItems((prev) => prev.filter((i) => i.id !== archivingItem.id))
            setArchivingItem(null)
          }}
        />
      )}
    </div>
  )
}

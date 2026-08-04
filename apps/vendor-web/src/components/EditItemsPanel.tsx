import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Item, Order } from '../api/types'

interface Line {
  item_id: number
  name: string
  quantity: number
}

interface Props {
  order: Order
  onClose: () => void
  onSaved: (order: Order) => void
}

// Vendor edits an in-progress order's line items (swap a sold-out item,
// adjust a quantity) — the plan is to tell the customer via chat first,
// then save here; no formal approval gate (see Orders::EditItems on the API).
// Lines whose underlying item was later deleted from the catalog
// (item_id === null) aren't editable through this endpoint, so they're left
// out of the editable set entirely rather than rendered read-only here.
export function EditItemsPanel({ order, onClose, onSaved }: Props) {
  const [lines, setLines] = useState<Line[]>(
    order.items
      .filter((line): line is typeof line & { item_id: number } => line.item_id !== null)
      .map((line) => ({ item_id: line.item_id, name: line.name, quantity: line.quantity }))
  )
  const [catalog, setCatalog] = useState<Item[]>([])
  const [addingItemId, setAddingItemId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listItems(order.shop_id).then((res) => setCatalog(res.items))
  }, [order.shop_id])

  function updateQuantity(itemId: number, quantity: number) {
    setLines((prev) => prev.map((l) => (l.item_id === itemId ? { ...l, quantity: Math.max(0, quantity) } : l)))
  }

  function addItem() {
    const item = catalog.find((i) => i.id === Number(addingItemId))
    if (!item) return
    setLines((prev) => [...prev, { item_id: item.id, name: item.name, quantity: 1 }])
    setAddingItemId('')
  }

  async function onSave() {
    setError(null)
    setSaving(true)
    try {
      const res = await api.updateOrderItems(
        order.id,
        lines.map((l) => ({ item_id: l.item_id, quantity: l.quantity }))
      )
      onSaved(res.order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update items')
    } finally {
      setSaving(false)
    }
  }

  const availableToAdd = catalog.filter(
    (item) => item.enabled && !item.sold_out && !lines.some((l) => l.item_id === item.id)
  )

  return (
    <div className="card edit-items-panel">
      <h2>Edit order</h2>
      <p className="edit-reminder">⚠ Let the customer know in chat first, then save your changes here.</p>
      <ul className="list">
        {lines.map((line) => (
          <li key={line.item_id} className="row spread">
            <span className={line.quantity === 0 ? 'muted' : undefined}>{line.name}</span>
            <div className="row gap">
              <button
                type="button"
                className="qty-btn"
                aria-label={`Decrease quantity of ${line.name}`}
                onClick={() => updateQuantity(line.item_id, line.quantity - 1)}
                disabled={line.quantity <= 0}
              >
                −
              </button>
              <span>{line.quantity}</span>
              <button
                type="button"
                className="qty-btn"
                aria-label={`Increase quantity of ${line.name}`}
                onClick={() => updateQuantity(line.item_id, line.quantity + 1)}
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      {availableToAdd.length > 0 && (
        <div className="row gap">
          <select value={addingItemId} onChange={(e) => setAddingItemId(e.target.value)} aria-label="Add an item from this shop">
            <option value="">Add an item…</option>
            {availableToAdd.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button type="button" onClick={addItem} disabled={!addingItemId}>Add</button>
        </div>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      <div className="row gap">
        <button type="button" className="button-success" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

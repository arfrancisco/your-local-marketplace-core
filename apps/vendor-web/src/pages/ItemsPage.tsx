import { useEffect, useState, type FormEvent } from 'react'
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

  useEffect(() => {
    api.listItems(shopId).then((res) => setItems(res.items)).finally(() => setLoading(false))
  }, [shopId])

  async function toggleEnabled(item: Item) {
    const res = item.enabled ? await api.disableItem(item.id) : await api.enableItem(item.id)
    setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)))
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
              <th scope="col">Item</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Tags</th>
              <th scope="col" className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.enabled ? '' : 'dimmed'}>
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

      <form className="card" onSubmit={onCreate}>
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
  )
}

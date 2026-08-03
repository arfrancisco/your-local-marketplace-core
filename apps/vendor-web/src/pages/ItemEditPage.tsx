import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Item } from '../api/types'

// No single-item GET endpoint exists on the API (only the per-shop index,
// create, and update-by-id), so this loads the shop's item list and picks
// the one being edited out of it — same approach ItemsPage already uses to
// list items, just filtered down to one. Route is nested under the shop
// (/shops/:id/items/:itemId/edit) so we have shopId without a lookup.
export function ItemEditPage() {
  const { id, itemId } = useParams()
  const shopId = Number(id)
  const targetId = Number(itemId)

  const [item, setItem] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState('')
  const [stockCount, setStockCount] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.listItems(shopId).then((res) => {
      if (cancelled) return
      const i = res.items.find((it) => it.id === targetId) ?? null
      if (!i) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setItem(i)
      setName(i.name)
      setDescription(i.description ?? '')
      setPrice((i.price_cents / 100).toFixed(2))
      setTags(i.tags.map((t) => t.name).join(', '))
      setStockCount(i.stock_count === null ? '' : String(i.stock_count))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [shopId, targetId])

  async function onSubmit(e: FormEvent) {
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
    // Left out entirely when blank so stock_count stays null (untracked)
    // rather than being coerced to 0/sold-out.
    if (stockCount.trim() !== '') fd.append('item[stock_count]', stockCount.trim())
    if (files) Array.from(files).forEach((f) => fd.append('item[photos][]', f))

    try {
      const res = await api.updateItem(targetId, fd)
      setItem(res.item)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save item')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading item…</p>

  if (notFound) {
    return (
      <div className="card narrow">
        <h1>Item not found</h1>
        <Link to={`/shops/${shopId}/items`}>Back to inventory</Link>
      </div>
    )
  }

  return (
    <div className="card narrow">
      <div className="row spread">
        <h1>Edit item</h1>
        <Link to={`/shops/${shopId}/items`}>Back to inventory</Link>
      </div>
      <form onSubmit={onSubmit}>
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
        {item && item.photos.length > 0 && (
          <div className="thumbs">
            {item.photos.map((p) => (
              <img key={p.id} src={`http://localhost:3000${p.url}`} alt={p.filename} />
            ))}
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        {saved && !error && <p className="muted">Saved.</p>}
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
      </form>
    </div>
  )
}

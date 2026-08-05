import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminItem } from '../api/types'

export function ItemDetailPage() {
  const { id } = useParams()
  const [item, setItem] = useState<AdminItem | null>(null)
  const [stockInput, setStockInput] = useState('')

  function refresh() {
    if (!id) return
    api.getItem(Number(id)).then((res) => {
      setItem(res.item)
      setStockInput(res.item.stock_count?.toString() ?? '')
    })
  }

  useEffect(refresh, [id])

  if (!item) return <p className="container">Loading…</p>

  return (
    <div className="container">
      <h1>{item.name} {item.demo && <span className="badge badge-demo">Demo</span>}</h1>
      <p className="muted">Shop #{item.shop_id}</p>
      <p>{(item.price_cents / 100).toFixed(2)} {item.currency}</p>
      <p>
        <button onClick={() => api.updateItem(item.id, { enabled: !item.enabled }).then(refresh)}>
          {item.enabled ? 'Disable' : 'Enable'}
        </button>
      </p>
      <label>
        Stock count (blank = untracked)
        <input value={stockInput} onChange={(e) => setStockInput(e.target.value)} />
      </label>
      <button
        onClick={() =>
          api
            .updateItem(item.id, { stock_count: stockInput === '' ? null : Number(stockInput) })
            .then(refresh)
        }
      >
        Save stock count
      </button>
      <p>
        <button
          onClick={() => {
            if (confirm(`Delete item "${item.name}"? This cannot be undone.`)) {
              api.deleteItem(item.id).then(() => window.history.back())
            }
          }}
        >
          Delete item
        </button>
      </p>
    </div>
  )
}

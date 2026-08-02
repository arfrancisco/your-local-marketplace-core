import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { AdminOrder, AdminOrderStatusEvent } from '../api/types'

export function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [events, setEvents] = useState<AdminOrderStatusEvent[]>([])
  const [toStatus, setToStatus] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    if (!id) return
    api.getOrder(Number(id)).then((res) => {
      setOrder(res.order)
      setToStatus(res.order.can_transition_to[0] ?? '')
    })
    api.listOrderStatusEvents({ order_id: Number(id) }).then((res) => setEvents(res.order_status_events))
  }

  useEffect(refresh, [id])

  if (!order) return <p className="container">Loading…</p>

  async function forceTransition() {
    setError(null)
    try {
      await api.forceTransitionOrder(order!.id, toStatus, reason)
      setReason('')
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not transition order')
    }
  }

  return (
    <div className="container">
      <Link to="/orders">← Orders</Link>
      <h1>{order.public_reference}</h1>
      <p>Status: {order.status} · Total: {(order.total_cents / 100).toFixed(2)} {order.currency}</p>

      <h2>Items</h2>
      <table>
        <thead><tr><th>Name</th><th>Qty</th><th>Line total</th></tr></thead>
        <tbody>
          {order.items.map((line) => (
            <tr key={line.id}><td>{line.name}</td><td>{line.quantity}</td><td>{(line.line_total_cents / 100).toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Force transition (admin override)</h2>
      {order.can_transition_to.length === 0 ? (
        <p className="muted">No legal transitions from this status.</p>
      ) : (
        <>
          <select value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
            {order.can_transition_to.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={forceTransition}>Transition</button>
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}

      <h2>Status history</h2>
      <table>
        <thead><tr><th>From</th><th>To</th><th>Actor</th><th>Reason</th><th>At</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.from_status ?? '—'}</td>
              <td>{e.to_status}</td>
              <td>{e.actor_user_email}</td>
              <td>{e.reason ?? '—'}</td>
              <td>{e.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.conversation_id && (
        <p><Link to={`/conversations/${order.conversation_id}`}>View chat transcript</Link></p>
      )}
    </div>
  )
}

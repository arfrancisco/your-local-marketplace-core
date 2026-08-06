import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Order } from '../api/types'

// Shown once, right after checkout, instead of dropping the customer
// straight onto the order page (CartContext's placeOrder navigates here
// first now). A deliberate extra tap to "View order" rather than another
// auto-redirect — the goal is just to make sure "order placed" registers
// as its own moment before the customer lands on the fuller order/chat view.
export function OrderPlacedPage() {
  const { id } = useParams()
  const orderId = Number(id)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getOrder(orderId).then((res) => setOrder(res.order)).finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <p>Loading…</p>
  if (!order) return <p>Order not found.</p>

  return (
    <div className="card order-placed-card">
      <h1>Order placed!</h1>
      <p>
        Your order from <strong>{order.shop_name}</strong> is in. The vendor
        needs to accept it before they start preparing it, so please wait for
        them to accept — you'll see it move through preparing, ready, and on
        to completed from your order page.
      </p>
      <Link className="link-button" to={`/orders/${order.id}`}>
        View order
      </Link>
    </div>
  )
}

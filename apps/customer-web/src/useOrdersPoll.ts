import { useEffect, useState } from 'react'
import { api } from './api/client'
import { useAuth } from './auth'
import type { Order } from './api/types'

// Shared poll cadence for every "does something on my orders need
// attention" consumer. Previously TabBar's unread dot and
// RatingNudgeModal's rate-your-order nudge each ran their own independent
// listOrders() poll on this same interval — two uncoordinated requests to
// the same endpoint per signed-in session, and a pattern a third consumer
// would likely have copied again rather than question. One poll, raw
// orders handed back; each consumer derives its own filter/selector from
// it instead of this hook picking one.
export const ORDERS_POLL_MS = 45_000

export function useOrdersPoll(): Order[] {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!user) {
      setOrders([])
      return
    }
    let cancelled = false
    function poll() {
      api
        .listOrders()
        .then((res) => {
          if (cancelled) return
          setOrders(res.orders)
        })
        .catch(() => {
          // Best-effort — a failed poll just leaves the previous snapshot.
        })
    }
    poll()
    const interval = setInterval(poll, ORDERS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id])

  return orders
}

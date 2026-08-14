import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api/client'
import { useAuth } from './auth'
import type { Order } from './api/types'

// Cadence for the one shared listOrders() poll. TabBar's unread dot and
// RatingNudgeModal's rate-your-order nudge used to each run their own
// independent poll on this interval — two uncoordinated requests to the same
// endpoint per signed-in session, and a pattern a third consumer would
// likely have copied again rather than question. OrdersPollProvider now runs
// that single fetch+interval; useOrdersPoll just reads its latest snapshot
// from context, so mounting more consumers never adds more requests — each
// still derives its own filter/selector from the shared snapshot.
export const ORDERS_POLL_MS = 45_000

const OrdersPollContext = createContext<Order[]>([])

// Mount once, above every consumer (App.tsx). Owns the actual fetch+interval
// — everything below just reads its output via useOrdersPoll().
export function OrdersPollProvider({ children }: { children: ReactNode }) {
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

  return <OrdersPollContext.Provider value={orders}>{children}</OrdersPollContext.Provider>
}

export function useOrdersPoll(): Order[] {
  return useContext(OrdersPollContext)
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api/client'
import { useMyShop } from './useMyShop'
import type { Order } from './api/types'

export const VENDOR_ORDERS_POLL_MS = 45_000

const VendorOrdersPollContext = createContext<Order[]>([])

// Single shared poll for the vendor's one shop's orders, consumed by both
// TabBar's attention dot and OrderList — mirrors customer-web's
// useOrdersPoll, which the same duplicate-fetch problem was already solved
// for there.
export function VendorOrdersPollProvider({ children }: { children: ReactNode }) {
  const shopId = useMyShop()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!shopId) {
      setOrders([])
      return
    }
    let cancelled = false
    function poll() {
      api
        .listVendorOrders(shopId!)
        .then((res) => {
          if (!cancelled) setOrders(res.orders)
        })
        .catch(() => {
          // Best-effort — a failed poll just leaves the previous snapshot.
        })
    }
    poll()
    const interval = setInterval(poll, VENDOR_ORDERS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [shopId])

  return <VendorOrdersPollContext.Provider value={orders}>{children}</VendorOrdersPollContext.Provider>
}

export function useVendorOrdersPoll(): Order[] {
  return useContext(VendorOrdersPollContext)
}

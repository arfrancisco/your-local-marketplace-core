import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api/client'
import { useAuth } from './auth'
import type { Shop } from './api/types'

interface MyShopState {
  shop: Shop | null
  loading: boolean
  setShop: (shop: Shop) => void
}

const MyShopContext = createContext<MyShopState>({ shop: null, loading: true, setShop: () => {} })

export function MyShopProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [shop, setShopState] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)

  // A one-time fetch, not re-run on navigation — ShopFormPage is the only
  // place a shop is ever created or edited, and it pushes the result into
  // this context directly via setShop (see its submit handler), so there's
  // nothing else that would make an existing snapshot go stale.
  useEffect(() => {
    // Wait for auth to settle first — otherwise the pre-`me()`-resolution
    // render (user still null) would look identical to "signed in, no
    // vendor_profile" and fire the empty-state branch prematurely. In the
    // real app RequireAuth already delays mounting past this point, but
    // this provider shouldn't depend on that to stay correct standalone.
    if (authLoading) return
    if (!user?.vendor_profile) {
      setShopState(null)
      setLoading(false)
      return
    }
    if (shop) return
    setLoading(true)
    let cancelled = false
    api
      .listShops()
      .then((res) => {
        if (!cancelled) setShopState(res.shops[0] ?? null)
      })
      .catch(() => {
        // Best-effort, matching this app's other background reads.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, user?.vendor_profile?.id, shop])

  const setShop = useCallback((next: Shop) => setShopState(next), [])

  return <MyShopContext.Provider value={{ shop, loading, setShop }}>{children}</MyShopContext.Provider>
}

export function useMyShopState(): MyShopState {
  return useContext(MyShopContext)
}

export function useMyShop(): number | null {
  return useContext(MyShopContext).shop?.id ?? null
}

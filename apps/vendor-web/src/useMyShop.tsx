import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
  // Mirrors `shop`, but updated synchronously the instant setShop() is
  // called, not on React's next render/effect pass. ShopFormPage can call
  // setShop() while this provider's own initial listShops() fetch is still
  // in flight; without this ref, that stale fetch's .then can still resolve
  // afterward and clobber the freshly-set shop back to null (or, via the
  // .finally, leave `loading` stuck true forever, since by then `shop` is
  // truthy and the effect's own re-run just no-ops on `if (shop) return`).
  // Checking this ref inside the fetch's .then closes that gap regardless
  // of how React schedules the effect's cleanup relative to the promise.
  const shopRef = useRef<Shop | null>(null)

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
      shopRef.current = null
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
        // A shop may have already arrived via setShop() while this was in
        // flight — don't let a stale response overwrite it.
        if (cancelled || shopRef.current) return
        setShopState(res.shops[0] ?? null)
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

  const setShop = useCallback((next: Shop) => {
    shopRef.current = next
    setShopState(next)
    // Providing a shop directly means there's nothing left to wait on, even
    // if the provider's own initial fetch is still in flight (see shopRef
    // above) — without this, `loading` would stay stuck at whatever the
    // in-flight fetch last set it to.
    setLoading(false)
  }, [])

  return <MyShopContext.Provider value={{ shop, loading, setShop }}>{children}</MyShopContext.Provider>
}

export function useMyShopState(): MyShopState {
  return useContext(MyShopContext)
}

export function useMyShop(): number | null {
  return useContext(MyShopContext).shop?.id ?? null
}

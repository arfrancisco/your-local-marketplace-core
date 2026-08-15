import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from './api/client'
import { useAuth } from './auth'

const MyShopContext = createContext<number | null>(null)

// Resolves the vendor's single shop id (see Shop's vendor_profile_id
// uniqueness constraint), just for building the tab bar's Inventory link
// and scoping its unread-order poll — not a shared cache of the full Shop
// object; ShopDashboardPage keeps its own richer fetch (open/close state,
// tour state) unchanged.
export function MyShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [shopId, setShopId] = useState<number | null>(null)
  // A brand-new vendor has no shop yet at mount (still on /onboarding) —
  // re-checking on every navigation, but only while still unresolved, picks
  // up the shop as soon as it's created without needing ShopFormPage to
  // call back into this provider directly. Cheap: a vendor has exactly one
  // shop, and this stops re-fetching entirely once resolved.
  const location = useLocation()

  useEffect(() => {
    if (!user?.vendor_profile) {
      setShopId(null)
      return
    }
    if (shopId) return
    let cancelled = false
    api.listShops().then((res) => {
      if (!cancelled) setShopId(res.shops[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [user?.vendor_profile?.id, location.pathname, shopId])

  return <MyShopContext.Provider value={shopId}>{children}</MyShopContext.Provider>
}

export function useMyShop(): number | null {
  return useContext(MyShopContext)
}

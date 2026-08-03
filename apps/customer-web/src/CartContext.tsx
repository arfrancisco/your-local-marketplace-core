import { createContext, useContext, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from './api/client'
import { useAuth } from './auth'
import type { FulfillmentMethod, Item, Shop } from './api/types'
import { readGuestCart, writeGuestCart, clearGuestCart } from './guestCart'
import { CartModal } from './components/CartModal'
import { ShopSwitchModal } from './components/ShopSwitchModal'

// Cart state used to live inside ShopDetailPage. It is global now because the
// cart icon lives in the header on every page (not just the shop page), so
// something above the router has to own the item count.
//
// "Global" here still means *one shop's* cart at a time — the backend cart is
// shop-scoped (ADR 0008, which allows a separate active cart per shop) and so
// is the anonymous localStorage cart, but this app enforces a stricter,
// customer-facing rule on top of that: only one of those shop carts is ever
// "the" cart at once. A customer places an order from one shop, then starts a
// new cart with a different shop if they want to order again — matching how
// checkout already works (it's always one shop at a time). Without this,
// switching between shops silently swapped which shop's cart the header
// badge/checkout showed, with no indication anything had changed.
//
// The provider holds whichever shop is currently active. Viewing a different,
// still-empty shop switches freely (nothing to lose). Once the active cart
// has items, viewing another shop's page no longer steals that state —
// loadShopCart() below just leaves that page's own items reading as "not
// added" until the customer actually tries to add one, which routes through
// addToCart's confirm-and-replace flow (pendingShopSwitch) instead of
// silently clobbering the existing cart.
export interface CartLine {
  cartItemId: number
  item: Item
  quantity: number
}

export interface PendingShopSwitch {
  fromShop: Shop
  toShop: Shop
}

interface CartState {
  shop: Shop | null
  lines: CartLine[]
  count: number
  subtotalCents: number
  currency: string
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  fulfillmentMethod: FulfillmentMethod | null
  setFulfillmentMethod: (method: FulfillmentMethod) => void
  placingOrder: boolean
  checkoutError: string | null
  hasSoldOutInCart: boolean
  loadShopCart: (shop: Shop, items: Item[]) => Promise<void>
  addToCart: (shop: Shop, item: Item) => Promise<void>
  changeQuantity: (itemId: number, quantity: number) => Promise<void>
  quantityOf: (itemId: number) => number
  placeOrder: () => Promise<void>
  pendingShopSwitch: PendingShopSwitch | null
  confirmShopSwitch: () => Promise<void>
  cancelShopSwitch: () => void
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  // Set while addToCart is waiting on the customer to confirm replacing their
  // active cart with a different shop's — see addToCart/confirmShopSwitch.
  const [pendingAdd, setPendingAdd] = useState<{ shop: Shop; item: Item } | null>(null)

  // Lifted verbatim from ShopDetailPage: for an anonymous visitor the cart is
  // local (guestCart.ts); for a signed-in customer it is the real backend cart,
  // and anything added while anonymous is drained into it on arrival so nothing
  // is lost the moment they sign in.
  async function loadShopCart(nextShop: Shop, items: Item[]) {
    // A different shop already has a non-empty active cart — just viewing
    // this shop's page shouldn't steal that state (see the file header
    // comment). Leave the active cart alone; this page's own quantityOf()
    // calls will naturally read 0 for all its items since none match the
    // active cart's lines, until addToCart's confirm flow actually switches.
    if (shop && shop.id !== nextShop.id && lines.length > 0) return

    setShop(nextShop)
    const methods = nextShop.fulfillment_methods
    setFulfillmentMethod((methods.includes('delivery') ? 'delivery' : methods[0]) ?? null)

    const byItemId = new Map(items.map((i) => [i.id, i]))

    if (!user) {
      const guestCart = readGuestCart(nextShop.id)
      setLines(
        Object.entries(guestCart)
          .map(([itemId, quantity]) => ({
            cartItemId: -Number(itemId),
            item: byItemId.get(Number(itemId))!,
            quantity,
          }))
          .filter((l) => l.item),
      )
      return
    }

    const guestCart = readGuestCart(nextShop.id)
    const guestEntries = Object.entries(guestCart)
    if (guestEntries.length > 0) {
      for (const [itemIdStr, quantity] of guestEntries) {
        const guestItem = byItemId.get(Number(itemIdStr))
        if (!guestItem || guestItem.sold_out) continue
        try {
          await api.addCartItem(nextShop.id, guestItem.id, quantity)
        } catch {
          // Best-effort — an individual line failing to merge shouldn't block
          // the rest, and the guest cart is cleared regardless since we don't
          // want to keep retrying a stale local cart.
        }
      }
      clearGuestCart(nextShop.id)
    }

    const cartRes = await api.getCart(nextShop.id)
    if (!cartRes.cart) {
      setLines([])
      return
    }
    setLines(
      cartRes.cart.items
        .map((line) => ({
          cartItemId: line.id,
          item: byItemId.get(line.item_id)!,
          quantity: line.quantity,
        }))
        .filter((l) => l.item),
    )
  }

  // Shared by addToCart (new shop, no confirmation needed) and
  // confirmShopSwitch (new shop, confirmation already given) — actually adds
  // the item, switching the active shop first if it isn't already this one.
  async function performAdd(targetShop: Shop, item: Item) {
    if (!shop || shop.id !== targetShop.id) {
      setShop(targetShop)
      const methods = targetShop.fulfillment_methods
      setFulfillmentMethod((methods.includes('delivery') ? 'delivery' : methods[0]) ?? null)
      setLines([])
    }

    if (!user) {
      const guestCart = readGuestCart(targetShop.id)
      const quantity = (guestCart[item.id] ?? 0) + 1
      guestCart[item.id] = quantity
      writeGuestCart(targetShop.id, guestCart)
      setLines((prev) => {
        const existing = prev.find((l) => l.item.id === item.id)
        if (existing) return prev.map((l) => (l.item.id === item.id ? { ...l, quantity } : l))
        return [...prev, { cartItemId: -item.id, item, quantity }]
      })
      return
    }

    const res = await api.addCartItem(targetShop.id, item.id)
    const line = res.cart.items.find((l) => l.item_id === item.id)!
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id)
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, quantity: line.quantity, cartItemId: line.id } : l,
        )
      }
      return [...prev, { cartItemId: line.id, item, quantity: line.quantity }]
    })
  }

  // Takes the item's own shop explicitly (rather than trusting whatever the
  // context's `shop` currently is) so this can tell a same-shop add apart
  // from a genuine switch. One-shop-at-a-time: if the active cart already has
  // items from a *different* shop, this doesn't add anything yet — it stashes
  // the attempt and asks for confirmation first (see pendingShopSwitch below).
  async function addToCart(targetShop: Shop, item: Item) {
    if (item.sold_out) return

    if (shop && shop.id !== targetShop.id && lines.length > 0) {
      setPendingAdd({ shop: targetShop, item })
      return
    }

    await performAdd(targetShop, item)
  }

  async function confirmShopSwitch() {
    if (!pendingAdd) return
    const { shop: targetShop, item } = pendingAdd
    setPendingAdd(null)

    if (shop) {
      if (!user) {
        clearGuestCart(shop.id)
      } else {
        try {
          await api.clearCart(shop.id)
        } catch {
          // Best-effort — proceeding with the new add matters more than a
          // failed cleanup call; the old cart is simply left abandoned
          // server-side rather than blocking the customer here.
        }
      }
    }

    await performAdd(targetShop, item)
  }

  function cancelShopSwitch() {
    setPendingAdd(null)
  }

  // Takes an item id rather than a cart-item id so callers (the item list's
  // stepper, the cart modal) don't have to track backend cart-line identity.
  async function changeQuantity(itemId: number, quantity: number) {
    if (!shop) return
    const line = lines.find((l) => l.item.id === itemId)
    if (!line) return

    if (!user) {
      const guestCart = readGuestCart(shop.id)
      if (quantity < 1) {
        delete guestCart[itemId]
        writeGuestCart(shop.id, guestCart)
        setLines((prev) => prev.filter((l) => l.item.id !== itemId))
        return
      }
      guestCart[itemId] = quantity
      writeGuestCart(shop.id, guestCart)
      setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity } : l)))
      return
    }

    if (quantity < 1) {
      await api.removeCartItem(line.cartItemId)
      setLines((prev) => prev.filter((l) => l.item.id !== itemId))
      return
    }
    await api.updateCartItem(line.cartItemId, quantity)
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity } : l)))
  }

  function quantityOf(itemId: number): number {
    return lines.find((l) => l.item.id === itemId)?.quantity ?? 0
  }

  async function placeOrder() {
    if (!shop || !fulfillmentMethod) return
    if (!user) {
      setIsOpen(false)
      navigate(`/login?return_to=${encodeURIComponent(`/shops/${shop.slug}`)}`)
      return
    }
    setCheckoutError(null)
    setPlacingOrder(true)
    try {
      const res = await api.checkout(shop.id, fulfillmentMethod)
      setLines([])
      setIsOpen(false)
      navigate(`/orders/${res.order.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.details?.unavailable_items) {
        // Race: cart looked fine client-side, but an item went sold-out between
        // render and checkout — same rejection shape as the existing
        // "enabled: false" case.
        setCheckoutError('Some items in your cart are no longer available. Please review your cart.')
      } else {
        setCheckoutError(err instanceof ApiError ? err.message : 'Could not place order')
      }
    } finally {
      setPlacingOrder(false)
    }
  }

  const value: CartState = {
    shop,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: lines.reduce((sum, line) => sum + line.quantity * line.item.price_cents, 0),
    currency: lines[0]?.item.currency ?? 'PHP',
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    fulfillmentMethod,
    setFulfillmentMethod,
    placingOrder,
    checkoutError,
    hasSoldOutInCart: lines.some((line) => line.item.sold_out),
    loadShopCart,
    addToCart,
    changeQuantity,
    quantityOf,
    placeOrder,
    pendingShopSwitch: pendingAdd && shop ? { fromShop: shop, toShop: pendingAdd.shop } : null,
    confirmShopSwitch,
    cancelShopSwitch,
  }

  // Both modals are rendered by the provider rather than by App so they are
  // available anywhere the cart icon is — including in tests that mount a
  // single page rather than the whole app.
  return (
    <CartContext.Provider value={value}>
      {children}
      <CartModal />
      <ShopSwitchModal />
    </CartContext.Provider>
  )
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

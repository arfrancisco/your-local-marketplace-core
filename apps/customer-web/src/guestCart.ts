// Shop-scoped, client-only cart for anonymous visitors. Browsing and adding
// items is public; only checkout requires a real account (the backend
// Cart/CartItem, ADR 0008, requires a customer_profile). Once the visitor
// signs in, this is drained into the real backend cart and cleared — see
// CartContext's loadShopCart.
const PREFIX = 'kapitmarket_guest_cart:'

function storageKey(shopId: number): string {
  return `${PREFIX}${shopId}`
}

export function readGuestCart(shopId: number): Record<number, number> {
  try {
    const raw = localStorage.getItem(storageKey(shopId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function writeGuestCart(shopId: number, cart: Record<number, number>): void {
  localStorage.setItem(storageKey(shopId), JSON.stringify(cart))
}

export function clearGuestCart(shopId: number): void {
  localStorage.removeItem(storageKey(shopId))
}

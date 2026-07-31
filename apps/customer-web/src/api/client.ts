import type { Cart, FulfillmentMethod, Item, Message, Order, Shop, Tag, User } from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
// Shared with vendor-web's key — both apps are same-origin now (customer at
// /, vendor at /vendor), and a User can hold both a customer_profile and a
// vendor_profile at once (capability-based, not a role column). Signing in
// on either app signs you in on both, rather than needing two logins for
// one identity.
const TOKEN_KEY = 'kapitmarket_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, string[]>

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, method = 'GET', body?: Record<string, unknown> | FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body // browser sets multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  if (res.status === 204) return null as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error ?? {}
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Request failed', err.details)
  }
  return data as T
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: User }>('/auth/register', 'POST', {
      user: { email, password, display_name: displayName, roles: ['customer'] },
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', 'POST', { email, password }),
  me: () => request<{ user: User }>('/me'),

  listShops: (query?: string) =>
    request<{ shops: Shop[] }>(`/shops${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  getShop: (slug: string) => request<{ shop: Shop }>(`/shops/${slug}`),
  listItems: (slug: string) => request<{ items: Item[] }>(`/shops/${slug}/items`),
  listTags: () => request<{ tags: Tag[] }>('/tags'),

  earlyAccess: (payload: {
    email?: string
    mobile_number?: string
    name?: string
    interest?: string
    context?: string
  }) => request<{ status: string }>('/early_access', 'POST', { early_access_signup: payload }),

  // Cart is scoped to one shop at a time (ADR 0008). Checkout/order placement
  // is not built yet — the cart itself is real, persisted backend state.
  getCart: (shopId: number) => request<{ cart: Cart | null }>(`/cart?shop_id=${shopId}`),
  addCartItem: (shopId: number, itemId: number, quantity = 1) =>
    request<{ cart: Cart }>('/cart/items', 'POST', { shop_id: shopId, item_id: itemId, quantity }),
  updateCartItem: (cartItemId: number, quantity: number) =>
    request<{ cart: Cart }>(`/cart/items/${cartItemId}`, 'PATCH', { quantity }),
  removeCartItem: (cartItemId: number) => request<{ cart: Cart }>(`/cart/items/${cartItemId}`, 'DELETE'),

  // Checkout converts the cart into a real order (rest of M3, ADR 0009) —
  // requires the lightweight real account cart already requires.
  checkout: (shopId: number, fulfillmentMethod: FulfillmentMethod, customerNote?: string) =>
    request<{ order: Order }>('/cart/checkout', 'POST', {
      shop_id: shopId, fulfillment_method: fulfillmentMethod, customer_note: customerNote,
    }),

  listOrders: () => request<{ orders: Order[] }>('/orders'),
  getOrder: (id: number) => request<{ order: Order }>(`/orders/${id}`),
  cancelOrder: (id: number) => request<{ order: Order }>(`/orders/${id}/transitions`, 'POST', { to_status: 'cancelled' }),

  getConversation: (orderId: number) =>
    request<{ conversation: { id: number; order_id: number }; messages: Message[] }>(
      `/orders/${orderId}/conversation`
    ),
  postMessage: (orderId: number, body: string | null, image?: File | null) => {
    if (image) {
      const fd = new FormData()
      if (body) fd.append('body', body)
      fd.append('image', image)
      return request<{ message: Message }>(`/orders/${orderId}/messages`, 'POST', fd)
    }
    return request<{ message: Message }>(`/orders/${orderId}/messages`, 'POST', { body })
  },
}

import type { Address, CancellationReasonCode, Cart, FulfillmentMethod, Item, Message, Order, Rating, Shop, Tag, User } from './types'

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
  // Shape varies by error code: validation_failed -> Record<string, string[]>,
  // rate_limited -> { retry_after: number }, vendor_profile 403 -> { reasons: string[] }.
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

// The one endpoint request() itself must never report failures for — reporting
// a failure of the failure-reporting endpoint would recurse.
const CLIENT_ERROR_REPORT_PATH = '/client_errors'

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

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch (networkError) {
    // fetch itself threw (offline, DNS, CORS, etc.) — no response at all. This
    // is a bug-shaped failure the same as a 5xx, not a caught/expected one, so
    // it is worth capturing; the throw below is unchanged from before this
    // wrapper existed, so callers still see exactly what they saw previously.
    if (path !== CLIENT_ERROR_REPORT_PATH) {
      void reportClientError({
        name: networkError instanceof Error ? networkError.name : 'NetworkError',
        message: networkError instanceof Error ? networkError.message : String(networkError),
      })
    }
    throw networkError
  }

  if (res.status === 204) return null as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error ?? {}
    // 5xx means something broke on our end, worth the same capture an
    // uncaught render crash gets. A 4xx (validation, sold out, wrong
    // password, ...) is expected business logic, not a bug, so it is
    // deliberately left uncaptured here to keep error_logs meaningful.
    if (res.status >= 500 && path !== CLIENT_ERROR_REPORT_PATH) {
      void reportClientError({
        name: err.code ?? 'ApiError',
        message: `${method} ${path} -> ${res.status}: ${err.message ?? 'Request failed'}`,
      })
    }
    // When the backend attaches an error_id (see error_handling.rb), fold it
    // into the message so every existing "show err.message" call site gets a
    // correlation token for free, without a change at each call site.
    const message = err.details?.error_id
      ? `${err.message ?? 'Request failed'} (Error ID: ${err.details.error_id} — mention this if you report the issue)`
      : (err.message ?? 'Request failed')
    throw new ApiError(res.status, err.code ?? 'error', message, err.details)
  }
  return data as T
}

export interface RegisterPayload {
  email: string
  mobile_number: string
  password: string
  is_resident: boolean
  // Only meaningful (and only sent) when is_resident is true.
  willing_to_verify_residency?: boolean
  terms_accepted: boolean
  email_marketing_opt_in?: boolean
  sms_marketing_opt_in?: boolean
}

export interface CompleteProfilePayload {
  first_name: string
  last_name: string
  address: {
    recipient_name?: string
    mobile_number?: string
    building: string
    unit?: string
    street_address?: string
    city?: string
    notes?: string
    delivery_instructions?: string
  }
}

export interface UpdateAddressPayload {
  recipient_name?: string
  mobile_number?: string
  building?: string
  unit?: string
  street_address?: string
  city?: string
  notes?: string
  delivery_instructions?: string
}

export interface ClientErrorReport {
  name?: string
  message: string
  stack?: string
}

// Fire-and-forget crash reporting to our own API — this is what stands in for
// a third-party error-monitoring SDK. Deliberately swallows every failure: it
// is called from an ErrorBoundary, from request()'s own 5xx/network capture,
// and from an 'unhandledrejection' listener, i.e. when the app is *already*
// broken, so a failed report must never surface a second error or reject an
// unhandled promise (which would re-enter the listener and loop). Callers
// that don't need it can ignore the resolved value entirely (most just call
// this without awaiting); ErrorBoundary uses it to show a correlation id.
export async function reportClientError(report: ClientErrorReport): Promise<number | undefined> {
  try {
    const data = await request<{ status: string; error_id?: number }>('/client_errors', 'POST', {
      name: report.name,
      message: report.message,
      stack: report.stack,
      source: 'customer-web',
      url: window.location.href,
      user_agent: navigator.userAgent,
    })
    return data?.error_id
  } catch {
    return undefined
  }
}

export const api = {
  register: (payload: RegisterPayload) =>
    request<{ token: string; user: User }>('/auth/register', 'POST', { user: payload }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', 'POST', { email, password }),
  me: () => request<{ user: User }>('/me'),

  requestMobileVerification: () => request<{ message?: string }>('/verifications/mobile', 'POST'),
  confirmMobileVerification: (code: string) =>
    request<{ user: User }>('/verifications/mobile/confirm', 'POST', { code }),
  requestEmailVerification: () => request<{ message?: string }>('/verifications/email', 'POST'),
  confirmEmailVerification: (code: string) =>
    request<{ user: User }>('/verifications/email/confirm', 'POST', { code }),

  completeProfile: (payload: CompleteProfilePayload) =>
    request<{ user: User; address: Address }>('/me/complete_profile', 'POST', { ...payload }),

  requestPasswordReset: (email: string) =>
    request<{ message?: string }>('/password_resets', 'POST', { email }),
  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    request<{ message?: string }>('/password_resets/confirm', 'POST', {
      email, code, new_password: newPassword,
    }),

  becomeVendor: () => request<{ user: User }>('/me/vendor_profile', 'POST'),

  sendFeedback: (payload: { message: string; email?: string; page_url?: string }) =>
    request<{ status: string }>('/feedback', 'POST', payload),

  listAddresses: () => request<{ addresses: Address[] }>('/addresses'),
  updateAddress: (id: number, payload: UpdateAddressPayload) =>
    request<{ address: Address }>(`/addresses/${id}`, 'PATCH', { ...payload }),

  listShops: (query?: string) =>
    request<{ shops: Shop[] }>(`/shops${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  getShop: (slug: string) => request<{ shop: Shop }>(`/shops/${slug}`),
  listItems: (slug: string) => request<{ items: Item[] }>(`/shops/${slug}/items`),
  listTags: () => request<{ tags: Tag[] }>('/tags'),

  // Public shop reviews. The aggregate (average_rating/ratings_count) already
  // rides along on the Shop payload; this is the list behind it.
  listShopRatings: (slug: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    if (params?.offset !== undefined) query.set('offset', String(params.offset))
    const suffix = query.toString() ? `?${query}` : ''
    return request<{ ratings: Rating[] }>(`/shops/${slug}/ratings${suffix}`)
  },

  // Cart is scoped to one shop at a time (ADR 0008). Checkout/order placement
  // is not built yet — the cart itself is real, persisted backend state.
  getCart: (shopId: number) => request<{ cart: Cart | null }>(`/cart?shop_id=${shopId}`),
  addCartItem: (shopId: number, itemId: number, quantity = 1) =>
    request<{ cart: Cart }>('/cart/items', 'POST', { shop_id: shopId, item_id: itemId, quantity }),
  updateCartItem: (cartItemId: number, quantity: number) =>
    request<{ cart: Cart }>(`/cart/items/${cartItemId}`, 'PATCH', { quantity }),
  removeCartItem: (cartItemId: number) => request<{ cart: Cart }>(`/cart/items/${cartItemId}`, 'DELETE'),

  // Clears a whole shop's cart in one call — used by the one-shop-at-a-time
  // cart policy (CartContext) when the customer confirms replacing their
  // current cart with a different shop's.
  clearCart: (shopId: number) => request<null>(`/cart?shop_id=${shopId}`, 'DELETE'),

  // Checkout converts the cart into a real order (rest of M3, ADR 0009) —
  // requires the lightweight real account cart already requires.
  checkout: (shopId: number, fulfillmentMethod: FulfillmentMethod, customerNote?: string) =>
    request<{ order: Order }>('/cart/checkout', 'POST', {
      shop_id: shopId, fulfillment_method: fulfillmentMethod, customer_note: customerNote,
    }),

  listOrders: () => request<{ orders: Order[] }>('/orders'),
  getOrder: (id: number) => request<{ order: Order }>(`/orders/${id}`),
  cancelOrder: (id: number, params: { reason_code: CancellationReasonCode | string; reason?: string }) =>
    request<{ order: Order }>(`/orders/${id}/transitions`, 'POST', { to_status: 'cancelled', ...params }),

  // Only valid on a completed order, and only once (enforced by the API).
  rateOrder: (orderId: number, score: number, comment?: string) =>
    request<{ rating: Rating }>(`/orders/${orderId}/ratings`, 'POST', { score, comment }),

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
  markConversationRead: (orderId: number) =>
    request<null>(`/orders/${orderId}/conversation/mark_read`, 'POST'),
}

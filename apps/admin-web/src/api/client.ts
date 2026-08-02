import type {
  AdminUser, AdminVendorProfile, AdminShop, AdminItem, AdminOrder, AdminOrderStatusEvent,
  AdminFeedbackSubmission, AdminApiToken, AdminVerificationChallenge, AdminCustomerProfile,
  AdminAddress, AdminCart, AdminTag, AdminEarlyAccessSignup, AdminConversation, Pagination,
} from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

// Deliberately distinct from 'kapitmarket_token', the bearer-token key
// shared by customer-web/vendor-web for real customer/vendor accounts.
// admin-web authenticates via a single shared HTTP Basic credential (the
// operator, not a User row) and must never collide with or be readable by
// that other auth system.
const CREDENTIALS_KEY = 'kapitmarket_admin_basic_auth'

interface Credentials {
  username: string
  password: string
}

export function getCredentials(): Credentials | null {
  const raw = localStorage.getItem(CREDENTIALS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Credentials
  } catch {
    return null
  }
}

export function setCredentials(username: string, password: string): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }))
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY)
}

function authHeader(): string | undefined {
  const creds = getCredentials()
  if (!creds) return undefined
  return 'Basic ' + btoa(`${creds.username}:${creds.password}`)
}

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, method = 'GET', body?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {}
  const auth = authHeader()
  if (auth) headers['Authorization'] = auth

  let payload: BodyInit | undefined
  if (body !== undefined) {
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

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

export const api = {
  // Users
  listUsers: (params?: { status?: string; q?: string; page?: number }) =>
    request<{ users: AdminUser[]; meta: Pagination }>(`/admin/users${qs(params)}`),
  getUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}`),
  suspendUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}/suspend`, 'POST'),
  reactivateUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}/reactivate`, 'POST'),

  // Vendor profiles
  listVendorProfiles: (params?: { verification_status?: string; page?: number }) =>
    request<{ vendor_profiles: AdminVendorProfile[]; meta: Pagination }>(`/admin/vendor_profiles${qs(params)}`),
  getVendorProfile: (id: number) => request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}`),
  approveVendorProfile: (id: number) =>
    request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}/approve`, 'POST'),
  rejectVendorProfile: (id: number) =>
    request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}/reject`, 'POST'),

  // Shops
  listShops: (params?: { status?: string; q?: string; page?: number }) =>
    request<{ shops: AdminShop[]; meta: Pagination }>(`/admin/shops${qs(params)}`),
  getShop: (id: number) => request<{ shop: AdminShop }>(`/admin/shops/${id}`),
  updateShop: (id: number, payload: Partial<AdminShop>) =>
    request<{ shop: AdminShop }>(`/admin/shops/${id}`, 'PATCH', { shop: payload }),
  deleteShop: (id: number) => request<null>(`/admin/shops/${id}`, 'DELETE'),

  // Items
  listItems: (params?: { shop_id?: number; q?: string; page?: number }) =>
    request<{ items: AdminItem[]; meta: Pagination }>(`/admin/items${qs(params)}`),
  getItem: (id: number) => request<{ item: AdminItem }>(`/admin/items/${id}`),
  updateItem: (id: number, payload: Partial<AdminItem>) =>
    request<{ item: AdminItem }>(`/admin/items/${id}`, 'PATCH', { item: payload }),
  deleteItem: (id: number) => request<null>(`/admin/items/${id}`, 'DELETE'),

  // Orders
  listOrders: (params?: { status?: string; shop_id?: number; page?: number }) =>
    request<{ orders: AdminOrder[]; meta: Pagination }>(`/admin/orders${qs(params)}`),
  getOrder: (id: number) => request<{ order: AdminOrder }>(`/admin/orders/${id}`),
  forceTransitionOrder: (id: number, toStatus: string, reason: string) =>
    request<{ order: AdminOrder }>(`/admin/orders/${id}/transitions`, 'POST', { to_status: toStatus, reason }),

  // Order status events (audit)
  listOrderStatusEvents: (params?: { order_id?: number; page?: number }) =>
    request<{ order_status_events: AdminOrderStatusEvent[]; meta: Pagination }>(`/admin/order_status_events${qs(params)}`),

  // Conversations
  getConversation: (id: number) => request<{ conversation: AdminConversation }>(`/admin/conversations/${id}`),

  // Feedback
  listFeedback: (params?: { resolved?: string; page?: number }) =>
    request<{ feedback_submissions: AdminFeedbackSubmission[]; meta: Pagination }>(`/admin/feedback_submissions${qs(params)}`),
  resolveFeedback: (id: number) =>
    request<{ feedback_submission: AdminFeedbackSubmission }>(`/admin/feedback_submissions/${id}/resolve`, 'POST'),
  reopenFeedback: (id: number) =>
    request<{ feedback_submission: AdminFeedbackSubmission }>(`/admin/feedback_submissions/${id}/reopen`, 'POST'),

  // API tokens
  listApiTokens: (params?: { user_id?: number; page?: number }) =>
    request<{ api_tokens: AdminApiToken[]; meta: Pagination }>(`/admin/api_tokens${qs(params)}`),
  revokeApiToken: (id: number) => request<{ api_token: AdminApiToken }>(`/admin/api_tokens/${id}`, 'DELETE'),

  // Verification challenges (audit)
  listVerificationChallenges: (params?: { user_id?: number; purpose?: string; page?: number }) =>
    request<{ verification_challenges: AdminVerificationChallenge[]; meta: Pagination }>(`/admin/verification_challenges${qs(params)}`),

  // Customer profiles
  listCustomerProfiles: (params?: { page?: number }) =>
    request<{ customer_profiles: AdminCustomerProfile[]; meta: Pagination }>(`/admin/customer_profiles${qs(params)}`),

  // Addresses
  listAddresses: (params?: { user_id?: number; page?: number }) =>
    request<{ addresses: AdminAddress[]; meta: Pagination }>(`/admin/addresses${qs(params)}`),

  // Carts
  listCarts: (params?: { status?: string; page?: number }) =>
    request<{ carts: AdminCart[]; meta: Pagination }>(`/admin/carts${qs(params)}`),

  // Tags
  listTags: (params?: { page?: number }) => request<{ tags: AdminTag[]; meta: Pagination }>(`/admin/tags${qs(params)}`),
  deleteTag: (id: number) => request<null>(`/admin/tags/${id}`, 'DELETE'),

  // Early access signups
  listEarlyAccessSignups: (params?: { page?: number }) =>
    request<{ early_access_signups: AdminEarlyAccessSignup[]; meta: Pagination }>(`/admin/early_access_signups${qs(params)}`),
  deleteEarlyAccessSignup: (id: number) => request<null>(`/admin/early_access_signups/${id}`, 'DELETE'),
}

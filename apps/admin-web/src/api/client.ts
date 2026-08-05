import type {
  AdminUser, AdminVendorProfile, AdminShop, AdminItem, AdminOrder, AdminOrderStatusEvent,
  AdminFeedbackSubmission, AdminApiToken, AdminVerificationChallenge, AdminCustomerProfile,
  AdminAddress, AdminCart, AdminTag, AdminConversation, AdminErrorLog,
  AdminAccount, AdminAuditLogEntry,
  Pagination,
} from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

// Deliberately distinct from 'kapitmarket_token', the bearer-token key
// shared by customer-web/vendor-web for real customer/vendor accounts.
// admin-web now authenticates real per-admin accounts (AdminUser/
// AdminApiToken on the backend) via their own bearer token, kept in its own
// storage key so it never collides with or is readable by that other auth
// system.
const TOKEN_KEY = 'kapitmarket_admin_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// There's no GET /admin/me endpoint on this API surface, so the signed-in
// admin's identity (used for display and for disabling self-service actions
// like "deactivate" on your own row) is cached alongside the token rather
// than re-fetched. Session validity itself is still re-checked against the
// server on load (see auth.tsx) — this cache is never trusted on its own.
const ACCOUNT_KEY = 'kapitmarket_admin_account'

export function getStoredAdminAccount(): AdminAccount | null {
  const raw = localStorage.getItem(ACCOUNT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminAccount
  } catch {
    return null
  }
}

export function setStoredAdminAccount(account: AdminAccount | null): void {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  else localStorage.removeItem(ACCOUNT_KEY)
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
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

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

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

export interface ClientErrorReport {
  name?: string
  message: string
  stack?: string
}

// Fire-and-forget crash reporting to our own API — this is what stands in for
// a third-party error-monitoring SDK. Deliberately returns void and swallows
// every failure: it is called from an ErrorBoundary and from an
// 'unhandledrejection' listener, i.e. when the app is *already* broken, so a
// failed report must never surface a second error or reject an unhandled
// promise (which would re-enter the listener and loop).
//
// Note this posts to the *public* /client_errors endpoint, not an /admin one:
// admin-web can crash before the operator has signed in.
export function reportClientError(report: ClientErrorReport): void {
  try {
    void request('/client_errors', 'POST', {
      name: report.name,
      message: report.message,
      stack: report.stack,
      source: 'admin-web',
      url: window.location.href,
      user_agent: navigator.userAgent,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

export interface CreateAdminAccountPayload {
  email: string
  password: string
  password_confirmation: string
  first_name?: string
  last_name?: string
}

export const api = {
  // Admin auth (real per-admin accounts, not the old shared Basic Auth
  // credential). The login response's JSON field is still `admin_user`
  // (that's what the backend calls it) — only the frontend TS type is
  // renamed to AdminAccount to avoid colliding with the unrelated
  // marketplace-User AdminUser type below.
  login: (email: string, password: string) =>
    request<{ token: string; admin_user: AdminAccount }>('/admin/auth/login', 'POST', { email, password }),
  logout: () => request<null>('/admin/auth/logout', 'POST'),

  // Admin accounts (self-service admin-operator management)
  listAdminAccounts: (params?: { page?: number }) =>
    request<{ admin_users: AdminAccount[]; meta: Pagination }>(`/admin/admin_users${qs(params)}`),
  createAdminAccount: (payload: CreateAdminAccountPayload) =>
    request<{ admin_user: AdminAccount }>('/admin/admin_users', 'POST', { admin_user: payload }),
  deactivateAdminAccount: (id: number) =>
    request<{ admin_user: AdminAccount }>(`/admin/admin_users/${id}/deactivate`, 'POST'),
  reactivateAdminAccount: (id: number) =>
    request<{ admin_user: AdminAccount }>(`/admin/admin_users/${id}/reactivate`, 'POST'),

  // Audit logs (read-only)
  listAuditLogs: (params?: { admin_user_id?: number; resource_type?: string; page?: number }) =>
    request<{ audit_logs: AdminAuditLogEntry[]; meta: Pagination }>(`/admin/audit_logs${qs(params)}`),
  getAuditLog: (id: number) => request<{ audit_log: AdminAuditLogEntry }>(`/admin/audit_logs/${id}`),

  // Users
  listUsers: (params?: { status?: string; q?: string; demo?: boolean; page?: number }) =>
    request<{ users: AdminUser[]; meta: Pagination }>(`/admin/users${qs(params)}`),
  getUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}`),
  suspendUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}/suspend`, 'POST'),
  reactivateUser: (id: number) => request<{ user: AdminUser }>(`/admin/users/${id}/reactivate`, 'POST'),

  // Vendor profiles
  listVendorProfiles: (params?: { verification_status?: string; demo?: boolean; page?: number }) =>
    request<{ vendor_profiles: AdminVendorProfile[]; meta: Pagination }>(`/admin/vendor_profiles${qs(params)}`),
  getVendorProfile: (id: number) => request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}`),
  approveVendorProfile: (id: number) =>
    request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}/approve`, 'POST'),
  rejectVendorProfile: (id: number) =>
    request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}/reject`, 'POST'),
  clearVendorCancellationRestriction: (id: number) =>
    request<{ vendor_profile: AdminVendorProfile }>(`/admin/vendor_profiles/${id}/clear_cancellation_restriction`, 'POST'),

  // Shops
  listShops: (params?: { status?: string; q?: string; demo?: boolean; page?: number }) =>
    request<{ shops: AdminShop[]; meta: Pagination }>(`/admin/shops${qs(params)}`),
  getShop: (id: number) => request<{ shop: AdminShop }>(`/admin/shops/${id}`),
  updateShop: (id: number, payload: Partial<AdminShop>) =>
    request<{ shop: AdminShop }>(`/admin/shops/${id}`, 'PATCH', { shop: payload }),
  deleteShop: (id: number) => request<null>(`/admin/shops/${id}`, 'DELETE'),

  // Items
  listItems: (params?: { shop_id?: number; q?: string; demo?: boolean; page?: number }) =>
    request<{ items: AdminItem[]; meta: Pagination }>(`/admin/items${qs(params)}`),
  getItem: (id: number) => request<{ item: AdminItem }>(`/admin/items/${id}`),
  updateItem: (id: number, payload: Partial<AdminItem>) =>
    request<{ item: AdminItem }>(`/admin/items/${id}`, 'PATCH', { item: payload }),
  deleteItem: (id: number) => request<null>(`/admin/items/${id}`, 'DELETE'),

  // Orders
  listOrders: (params?: { status?: string; shop_id?: number; demo?: boolean; page?: number }) =>
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

  // Error logs
  listErrorLogs: (params?: { resolved?: string; source?: string; page?: number }) =>
    request<{ error_logs: AdminErrorLog[]; meta: Pagination }>(`/admin/error_logs${qs(params)}`),
  getErrorLog: (id: number) => request<{ error_log: AdminErrorLog }>(`/admin/error_logs/${id}`),
  resolveErrorLog: (id: number) => request<{ error_log: AdminErrorLog }>(`/admin/error_logs/${id}/resolve`, 'POST'),
  reopenErrorLog: (id: number) => request<{ error_log: AdminErrorLog }>(`/admin/error_logs/${id}/reopen`, 'POST'),

  // API tokens
  listApiTokens: (params?: { user_id?: number; page?: number }) =>
    request<{ api_tokens: AdminApiToken[]; meta: Pagination }>(`/admin/api_tokens${qs(params)}`),
  revokeApiToken: (id: number) => request<{ api_token: AdminApiToken }>(`/admin/api_tokens/${id}`, 'DELETE'),

  // Verification challenges (audit)
  listVerificationChallenges: (params?: { user_id?: number; purpose?: string; page?: number }) =>
    request<{ verification_challenges: AdminVerificationChallenge[]; meta: Pagination }>(`/admin/verification_challenges${qs(params)}`),

  // Customer profiles
  listCustomerProfiles: (params?: { demo?: boolean; page?: number }) =>
    request<{ customer_profiles: AdminCustomerProfile[]; meta: Pagination }>(`/admin/customer_profiles${qs(params)}`),
  verifyResidency: (id: number) =>
    request<{ customer_profile: AdminCustomerProfile }>(`/admin/customer_profiles/${id}/verify_residency`, 'POST'),
  rejectResidency: (id: number) =>
    request<{ customer_profile: AdminCustomerProfile }>(`/admin/customer_profiles/${id}/reject_residency`, 'POST'),
  clearCustomerCancellationRestriction: (id: number) =>
    request<{ customer_profile: AdminCustomerProfile }>(`/admin/customer_profiles/${id}/clear_cancellation_restriction`, 'POST'),

  // Addresses
  listAddresses: (params?: { user_id?: number; page?: number }) =>
    request<{ addresses: AdminAddress[]; meta: Pagination }>(`/admin/addresses${qs(params)}`),

  // Carts
  listCarts: (params?: { status?: string; page?: number }) =>
    request<{ carts: AdminCart[]; meta: Pagination }>(`/admin/carts${qs(params)}`),

  // Tags
  listTags: (params?: { page?: number }) => request<{ tags: AdminTag[]; meta: Pagination }>(`/admin/tags${qs(params)}`),
  deleteTag: (id: number) => request<null>(`/admin/tags/${id}`, 'DELETE'),
}

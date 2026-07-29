import type { Item, Shop, User } from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
const TOKEN_KEY = 'vendor_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// Mirrors the API's error envelope so the UI can show a real message.
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

type Body = Record<string, unknown> | FormData | undefined

async function request<T>(path: string, method = 'GET', body?: Body): Promise<T> {
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
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', 'POST', { email, password }),
  me: () => request<{ user: User }>('/me'),

  listShops: () => request<{ shops: Shop[] }>('/vendor/shops'),
  getShop: (id: number) => request<{ shop: Shop }>(`/vendor/shops/${id}`),
  createShop: (form: FormData) => request<{ shop: Shop }>('/vendor/shops', 'POST', form),
  updateShop: (id: number, form: FormData) => request<{ shop: Shop }>(`/vendor/shops/${id}`, 'PATCH', form),
  openShop: (id: number) => request<{ shop: Shop }>(`/vendor/shops/${id}/open`, 'POST'),
  closeShop: (id: number) => request<{ shop: Shop }>(`/vendor/shops/${id}/close`, 'POST'),

  listItems: (shopId: number) => request<{ items: Item[] }>(`/vendor/shops/${shopId}/items`),
  createItem: (shopId: number, form: FormData) =>
    request<{ item: Item }>(`/vendor/shops/${shopId}/items`, 'POST', form),
  updateItem: (id: number, form: FormData) => request<{ item: Item }>(`/vendor/items/${id}`, 'PATCH', form),
  enableItem: (id: number) => request<{ item: Item }>(`/vendor/items/${id}/enable`, 'POST'),
  disableItem: (id: number) => request<{ item: Item }>(`/vendor/items/${id}/disable`, 'POST'),
}

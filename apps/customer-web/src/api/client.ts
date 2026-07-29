import type { Item, Shop, Tag, User } from './types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
const TOKEN_KEY = 'customer_token'

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

async function request<T>(path: string, method = 'GET', body?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let payload: string | undefined
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

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: User }>('/auth/register', 'POST', {
      user: { email, password, display_name: displayName, roles: ['customer'] },
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', 'POST', { email, password }),
  me: () => request<{ user: User }>('/me'),

  listShops: () => request<{ shops: Shop[] }>('/shops'),
  getShop: (slug: string) => request<{ shop: Shop }>(`/shops/${slug}`),
  listItems: (slug: string) => request<{ items: Item[] }>(`/shops/${slug}/items`),
  listTags: () => request<{ tags: Tag[] }>('/tags'),
}

const BASE = process.env.ADMIN_API_BASE_URL ?? 'https://prisma.kapitmarket.ph/api/v1'
const TOKEN = process.env.ADMIN_TOKEN

if (!TOKEN) {
  throw new Error('ADMIN_TOKEN must be set')
}

const authHeader = `Bearer ${TOKEN}`

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null

  const data = (await res.json().catch(() => null)) as ApiErrorBody | null
  if (!res.ok) {
    throw new Error(`${res.status} ${data?.error?.code ?? 'error'}: ${data?.error?.message ?? res.statusText}`)
  }
  return data
}

export const adminGet = (path: string) => request(path)
export const adminPost = (path: string, body?: unknown) => request(path, 'POST', body)
export const adminPatch = (path: string, body?: unknown) => request(path, 'PATCH', body)
export const adminDelete = (path: string) => request(path, 'DELETE')

export function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

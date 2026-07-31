import { createConsumer, type Consumer } from '@rails/actioncable'
import { getToken } from './client'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
// The API base URL points at .../api/v1; ActionCable is mounted at the API
// host's root (/cable), not under the versioned API path.
const CABLE_BASE = API_BASE.replace(/\/api\/v1\/?$/, '').replace(/^http/, 'ws')

let consumer: Consumer | null = null

// One shared WebSocket connection for the whole app, re-created if the auth
// token changes (e.g. after login/logout).
export function getConsumer(): Consumer {
  const token = getToken()
  const url = `${CABLE_BASE}/cable?token=${encodeURIComponent(token ?? '')}`
  if (!consumer || consumer.url !== url) {
    consumer?.disconnect()
    consumer = createConsumer(url)
  }
  return consumer
}

import type { OrderStatus } from './api/types'

// Mirrors vendor-web's orderStatus.ts (same 5-bucket idea, same colors, so
// "in progress" means the same shade of blue in both apps) but written
// separately per ADR 0001 — no shared package between the two clients — and
// with labels reframed for what the customer is doing, not the vendor: they
// have nothing to "act" on while an order is placed, they're just waiting.
export type StatusGroupKey = 'waiting' | 'in_progress' | 'ready' | 'done' | 'terminal'

export const STATUS_GROUPS: Record<StatusGroupKey, { label: string; statuses: OrderStatus[] }> = {
  waiting:      { label: 'Waiting',      statuses: ['placed'] },
  in_progress:  { label: 'In progress',  statuses: ['accepted', 'preparing'] },
  ready:        { label: 'Ready',        statuses: ['ready_for_pickup', 'out_for_delivery'] },
  done:         { label: 'Completed',    statuses: ['completed'] },
  terminal:     { label: 'Rejected / cancelled', statuses: ['rejected', 'cancelled'] },
}

// Order matters only for iteration convenience below; lookup is by key.
export const PILL_GROUPS: StatusGroupKey[] = ['waiting', 'in_progress', 'ready']
export const DROPDOWN_GROUPS: StatusGroupKey[] = ['done', 'terminal']

export function groupKeyForStatus(status: OrderStatus): StatusGroupKey {
  const found = (Object.keys(STATUS_GROUPS) as StatusGroupKey[]).find((key) =>
    STATUS_GROUPS[key].statuses.includes(status)
  )
  // STATUS_GROUPS covers every OrderStatus, so this is unreachable in
  // practice; the fallback keeps the function total instead of throwing.
  return found ?? 'terminal'
}

// CSS class suffix, appended as `status-${key}` — kept as a plain function
// (not baked into STATUS_GROUPS) since the class name IS the key already.
export function statusBadgeClass(key: StatusGroupKey): string {
  return `status-${key.replace(/_/g, '-')}`
}

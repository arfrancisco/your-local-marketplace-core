import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { RatingForm } from './Ratings'
import type { Order } from '../api/types'

const STORAGE_PREFIX = 'kapitmarket_rating_nudge_shown:'

function shownKey(orderId: number): string {
  return `${STORAGE_PREFIX}${orderId}`
}

function alreadyShown(orderId: number): boolean {
  try {
    return localStorage.getItem(shownKey(orderId)) != null
  } catch {
    return false
  }
}

function markShown(orderId: number): void {
  try {
    localStorage.setItem(shownKey(orderId), '1')
  } catch {
    // Best-effort — if storage is unavailable the nudge just won't persist
    // across polls, no worse than not having this feature.
  }
}

// Independent poll on the same cadence as ActiveOrderButton's (App.tsx,
// ACTIVE_ORDER_REFRESH_MS = 45s) — deliberately a *second*, separate poll,
// not a refactor of that one, so this stays additive and doesn't risk that
// already-shipped/tested component.
const POLL_MS = 45_000

// Global, always-mounted nudge: pops up the rating form for a just-completed,
// still-unrated order from anywhere in the app, not just that order's own
// page. Opens at most once per order, ever, per browser — the localStorage
// flag is set the moment the modal opens (not on submit/dismiss), so after
// that, the orders-list badge and the delayed chat reminder (backend) are
// the only ongoing nudges for that order.
export function RatingNudgeModal() {
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!user) {
      setOrder(null)
      return
    }

    let cancelled = false

    function poll() {
      api
        .listOrders()
        .then((res) => {
          if (cancelled) return
          // Decide inside the setOrder updater, not before it: if a modal is
          // already open (current != null), this tick must neither replace
          // it nor mark some other candidate as shown — marking a candidate
          // shown without ever actually displaying its modal would burn its
          // one-time popup for nothing. Deferring the decision to here makes
          // "already open" and "mark + open" mutually exclusive by
          // construction.
          setOrder((current) => {
            if (current) return current

            const candidates = res.orders.filter((o) => o.status === 'completed' && !o.rating && !alreadyShown(o.id))
            if (candidates.length === 0) return current

            // Never stack multiple modals — pick the oldest-completed one.
            const oldest = candidates.reduce((a, b) =>
              (a.completed_at ?? '') <= (b.completed_at ?? '') ? a : b,
            )

            markShown(oldest.id)
            return oldest
          })
        })
        .catch(() => {
          // Best-effort — a failed poll just tries again next tick.
        })
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id])

  if (!order) return null

  function close() {
    setOrder(null)
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Rate your order" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={close}>×</button>
        <h2>Your order is complete!</h2>
        <p className="muted">{order.shop_name}</p>
        <RatingForm orderId={order.id} onRated={close} />
        <button className="link-button" onClick={close}>Maybe later</button>
      </div>
    </div>
  )
}

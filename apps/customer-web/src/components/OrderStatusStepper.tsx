import type { FulfillmentMethod, OrderStatus } from '../api/types'

// Mirrors vendor-web's OrderStatusStepper (same steps, same states, same
// colors) but written separately per ADR 0001 — no shared package between
// the two clients — same convention as this app's CancelOrderModal.

type StepState = 'done' | 'current' | 'upcoming' | 'skipped' | 'terminal'

interface Step {
  key: OrderStatus
  label: string
  state: StepState
}

// The happy-path sequence, one row per Order::STATUSES value (app/models/
// order.rb) that isn't a terminal off-path status — kept in sync by hand,
// same convention as OrderStatus itself in api/types.ts. ready_for_pickup
// and out_for_delivery are alternatives for the same stage: only one
// applies, depending on the order's fulfillment_method, but both are
// listed so every status has a place to render.
const HAPPY_PATH: { key: OrderStatus; label: string }[] = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_for_pickup', label: 'Ready for pickup' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'completed', label: 'Completed' },
]

const STAGE: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  ready_for_pickup: 3,
  out_for_delivery: 3,
  completed: 4,
  rejected: -1,
  cancelled: -1,
}

function buildSteps(status: OrderStatus, fulfillmentMethod: FulfillmentMethod, acceptedAt: string | null): Step[] {
  // Cancelled/rejected don't fit linearly after "completed" — per the
  // TRANSITIONS table in app/models/order.rb, rejected is only reachable
  // from 'placed', and cancelled only from 'placed' or 'accepted' (never
  // from 'preparing' onward). That means accepted_at alone tells us exactly
  // how far the order actually got before it stopped, no event history
  // needed. Show what really happened, then a single red terminal step,
  // instead of rendering every later step as if it were merely "not yet
  // reached" when it was in fact never reachable from here again.
  if (status === 'rejected' || status === 'cancelled') {
    const steps: Step[] = [{ key: 'placed', label: 'Placed', state: 'done' }]
    if (status === 'cancelled' && acceptedAt) {
      steps.push({ key: 'accepted', label: 'Accepted', state: 'done' })
    }
    steps.push({
      key: status,
      label: status === 'rejected' ? 'Rejected' : 'Cancelled',
      state: 'terminal',
    })
    return steps
  }

  const currentStage = STAGE[status]
  return HAPPY_PATH.map((step) => {
    const inapplicable =
      (step.key === 'ready_for_pickup' && fulfillmentMethod !== 'pickup') ||
      (step.key === 'out_for_delivery' && fulfillmentMethod !== 'delivery')
    if (inapplicable) return { ...step, state: 'skipped' }

    const stage = STAGE[step.key]
    if (stage < currentStage) return { ...step, state: 'done' }
    if (stage > currentStage) return { ...step, state: 'upcoming' }
    // stage === currentStage: the step matching the order's live status.
    // "completed" reads as a checkmark like any other passed step rather
    // than a pulsing "current" one — there's nothing left after it.
    return { ...step, state: step.key === 'completed' ? 'done' : 'current' }
  })
}

function Marker({ state }: { state: StepState }) {
  if (state === 'done') return <span className="stepper-marker step-done" aria-hidden="true">✓</span>
  if (state === 'terminal') return <span className="stepper-marker step-terminal" aria-hidden="true">!</span>
  return <span className={`stepper-marker step-${state}`} aria-hidden="true" />
}

export function OrderStatusStepper({
  status,
  fulfillmentMethod,
  acceptedAt,
}: {
  status: OrderStatus
  fulfillmentMethod: FulfillmentMethod
  acceptedAt: string | null
}) {
  const steps = buildSteps(status, fulfillmentMethod, acceptedAt)

  return (
    <ol className="order-status-stepper">
      {steps.map((step) => (
        <li
          key={step.key}
          className={`stepper-step step-${step.state}`}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <Marker state={step.state} />
          <span className="stepper-label">
            {step.label}
            {step.state === 'skipped' && <span className="stepper-skip-note"> (not this order's fulfillment)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

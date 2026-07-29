# ADR 0003 — Order lifecycle and direct placement

Status: accepted
Date: 2026-07-29

## Context

The handover models orders as the product of a cart checkout, with a state
machine beginning at `cart -> placed`. This phase defers the cart (ADR 0004)
but still needs orders so that chat and ratings have something to attach to.

## Decision

Orders are placed **directly** from a single item, with no cart stage:

`POST /orders` takes `shop_id`, `item_id`, `quantity`.

The state machine drops the `cart` stage but is otherwise the handover's:

```
placed -> accepted -> preparing -> ready_for_pickup | out_for_delivery -> completed
placed -> rejected
placed | accepted -> cancelled
```

Rules preserved from the handover:

- Only an active, `accepting_orders` shop can receive a newly placed order.
- At placement, item name and price are **snapshotted** into `order_items`
  inside a transaction and never re-read live afterward. This discipline is
  kept even without a cart, because an order is a historical record.
- Availability (item enabled, shop open) is validated at placement time.
- The vendor controls `accepted`, `preparing`, and readiness transitions.
- The customer may request cancellation; whether it is allowed depends on the
  current state.
- Every transition writes an `order_status_events` row (actor, from, to,
  reason).
- `completed` unlocks rating.

A single service object, `Orders::Place`, owns placement: validate shop and
item, snapshot, compute totals server-side, create order + order_item + initial
status event + the order's conversation, atomically.

## Consequences

- The order model is shaped to accept a cart-built order later (multiple
  `order_items`) without rework — the cart just becomes another way to
  populate the same structure.
- Server-side pricing and snapshotting are in place from day one, so adding a
  cart later does not require retrofitting price-integrity guarantees.
- No idempotency-key handling yet (the handover suggested it for cart
  checkout). Direct single-item placement has a smaller double-submit surface;
  revisit if it becomes a problem.

# ADR 0008 — Cart reintroduced, superseding ADR 0004

Status: accepted
Date: 2026-07-29

## Context

ADR 0004 deferred the cart so the first build could reach a working
order→chat→rating loop faster, on a direct single-item order (ADR 0003).

While building the public discovery demo (customer-web, seeded shops), it
became clear that a single-item "Order now" button is awkward the moment a
real menu is browsable: a customer looking at Lola's Kitchen naturally wants
adobo *and* pandesal in one order, not two separate ones. That is the common
case for food, not an edge case, so the deferral no longer holds.

## Decision

Reintroduce the cart now, ahead of full order placement. Scope:

- `carts` (customer_profile_id, shop_id, status: active | converted |
  abandoned) and `cart_items` (cart_id, item_id, quantity, customer_note).
- **A cart is scoped to exactly one shop.** A customer may have a separate
  active cart per shop, but never one cart spanning multiple vendors. This
  preserves the "no multi-vendor checkout" non-goal without banning cart
  outright — the constraint moves from "no cart" to "cart per shop".
- Adding/updating/removing cart items is real, persisted backend work
  (`/api/v1/cart`), not client-side/demo-only state.
- Cart → order conversion (checkout, price/availability revalidation,
  snapshotting into `orders`/`order_items`) is **not** part of this change. It
  is the remainder of M3, built once demand is validated. In the interim demo,
  a cart's "Checkout" action opens the early-access signup instead of placing
  a real order — the same gate the old single-item "Order now" button used.

## Consequences

- ADR 0004 is superseded; ADR 0003 (direct single-item order) is narrowed to
  mean "no cart-to-order conversion yet", not "no cart at all".
- The order model (`orders`, `order_items` as snapshot rows,
  `order_status_events`) is unaffected and still to be built when M3 resumes
  in full — ADR 0004's original observation holds: order_items already
  supports multiple line items, so checkout will populate it from a cart
  rather than reshaping anything.
- The demo now gives a materially better demand signal: which items people
  actually add and in what combination, not just whether they click a button.
- Slightly more work before the demo ships (real cart CRUD + specs), accepted
  because it is genuine M3 progress rather than throwaway demo code.

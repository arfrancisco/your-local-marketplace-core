# ADR 0004 — Cart deferred

Status: accepted
Date: 2026-07-29

## Context

The handover treats the single-shop cart as core (add/update/remove items,
reprice, revalidate at checkout). Building it now would add tables
(`carts`, `cart_items`), a repricing service, and checkout-time revalidation
before we have validated that neighbors even want multi-item orders.

## Decision

Do not build the cart in this phase. Customers place a direct single-item
order instead (ADR 0003). No `carts` or `cart_items` tables, no
`/carts/...` endpoints.

## Consequences

- Faster path to a working end-to-end loop (order -> chat -> rating), which is
  what the phase is really trying to prove.
- The order model already supports multiple `order_items`, so adding a cart
  later means populating the existing order structure from a cart rather than
  reshaping orders.
- Price-integrity discipline (server-side snapshot at placement) is already in
  place, so the cart's checkout revalidation has a foundation to build on.

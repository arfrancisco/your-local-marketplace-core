# Milestone plan

The build is phased. Each milestone is a reviewable slice. Recommended review
stops after M0 and after M3 (the points where architecture is most
load-bearing).

## M0 — Foundation

Scaffold `apps/api` (Rails API + PostgreSQL). Auth + capability-based
authorization foundation (Pundit-style policies). Active Storage configured
for R2 (local disk/MinIO in dev). Redis + Sidekiq. API versioning under
`/api/v1`, a consistent JSON error format, a health-check endpoint, CI, and a
seed strategy. `docker-compose.yml` for Postgres + Redis.

**Acceptance:** app boots locally, CI passes, a verified test user can
authenticate.

## M1 — Vendor publishes a shop

Vendor profile. Shop create with descriptive address (no geo), manual
open/close (`accepting_orders`). Item CRUD with images, tags, enable/disable.
Image upload limits enforced server-side (JPEG/PNG/WebP, 5 MB, 6/item,
3/shop). Minimal `apps/vendor-web` UI for shop and catalog management.

**Acceptance:** a vendor can create an open shop with at least one orderable
item.

## M2 — Customer discovery (cart-free)

Customer profile + descriptive address. `GET /shops` community listing with
the daily rotating order (ADR 0007). Shop and catalog browse pages. Minimal
`apps/customer-web` UI for discovery only — no cart, no add-to-cart.

**Acceptance:** a customer can see all open shops in rotation order and view
their items. No distance logic involved.

## M3 — Direct order placement + lifecycle

`POST /orders` direct single-item placement with server-side price/name
snapshot (ADR 0003). Vendor order queue. Accept/reject. Status progression
with `order_status_events` history. Cancellation rules. No cart, no order
edits.

**Acceptance:** a customer can place a single-item order and the vendor can
take it through to completion.

## M4 — Per-order chat + ratings

Per-order `conversations` / `messages` with single-image attachments (Active
Storage → R2). `conversation_reads` for unread tracking. Action Cable
real-time delivery with a polling fallback. Completion ratings (score +
comment, one per order/reviewer, uniqueness enforced). No order edits.

**Acceptance:** customer and vendor can exchange text and image messages on an
order, and the customer can rate the order once completed.

## Out of scope this phase

Cart, order edits, online payments, courier dispatch, promotions/fees,
multi-vendor checkout, inventory counts, admin interface, mobile clients.

# your-local-marketplace-core — Project Context

Read this first. Start here instead of from zero.

## What this is

A **micro-hyperlocal** marketplace: neighbors selling to neighbors across a
small cluster of adjacent buildings/units. Fulfillment is customer pickup or
vendor delivery — both a short walk. Deliberately **not** a radius-based
local-search app: no geo, no distance, no map. See `docs/adr/0002-no-geo-discovery.md`.

One Rails API (`apps/api`) serves two React web clients (`apps/customer-web`,
`apps/vendor-web`). An Android client is planned for a **separate repo**, stack
undecided (leaning native Kotlin/Compose over React Native). The API is built
to serve it without changes.

## Current phase

M0–M4 are done, and the build has gone well beyond the original phase
boundary: a real cart (ADR 0008 reversed the original cart deferral),
registration/verification, vendor onboarding, an admin panel (web + MCP
server), several rounds of mobile/UX polish, and Open Graph social previews.
Order edits are still deferred (ADR 0005), and there is still no payment
gateway: vendor-managed payment via chat (ADR 0009) is a permanent design
choice, not a phase limitation. Mobile clients remain a separate, not yet
started repo.

| Milestone | Scope | Status |
|---|---|---|
| Docs/ADRs | README, ERD, ADRs, milestone plan | ✅ done |
| M0 | Rails API foundation: auth, authz, storage, Redis/Sidekiq, CI | ✅ done |
| M1 | Vendor publishes a shop with items | ✅ done |
| M2 | Customer discovery (cart-free), daily-rotating shop list | ✅ done |
| M3 | Cart, checkout, order lifecycle (cart reintroduced by ADR 0008) | ✅ done |
| M4 | Per-order chat with images + ratings | ✅ done |
| Beyond M4 | Registration/verification, vendor onboarding, admin panel, UX/mobile polish, social previews | ✅ done |

What's actually left isn't more engineering, it's the product decisions in
`docs/open-decisions.md` (pilot location, fulfillment mode, cancellation
policy, etc.) that need an answer before this goes live to real neighbors.

## Where the detail lives

- **Full build plan**: `/home/armfrancisco/.claude/plans/typed-nibbling-hare.md`
  (scope, domain model, API surface, build order, verification), a historical
  planning doc from before M0. The ADRs and `docs/architecture.md` are the
  current source of truth where they disagree with it.
- **Architecture overview (current)**: `docs/architecture.md`
- **Milestones (historical, frozen at the original M0–M4 plan)**: `docs/milestones.md`
- **Data model**: `docs/erd.md`
- **Decisions (authoritative)**: `docs/adr/` — where these disagree with the
  original spec, the ADRs win.
- **Original product spec (historical)**: `docs/product-handover.md`
- **Open questions**: `docs/open-decisions.md`
- **Legal drafts (needs lawyer review before go-live)**: `docs/legal/` —
  Terms and Conditions, Privacy Policy

## Key decisions already made (see ADRs for the why)

- Monorepo, one API + two web clients (0001)
- No geographic discovery (0002)
- Order lifecycle/state machine (0003); its original "no cart, direct
  single-item placement" mechanic is obsolete, superseded in practice by a
  real cart-based checkout (0008)
- Cart is real, reintroduced (0008, superseding 0004's original deferral);
  order edits are still deferred (0005)
- Images on Cloudflare R2, S3-compatible Active Storage; upload limits:
  JPEG/PNG/WebP, 5MB, 3/item, 1 per shop photo field, 1/chat message (0006)
- `GET /shops` uses a daily rotating order, never alphabetical (0007)
- No payment gateway, vendor-managed payment arranged via chat instead (0009)

## Conventions

- No em-dashes in prose. Keep writing plain and direct.
- Business rules live in the Rails API, not the clients. Thin controllers,
  service objects for order placement / status transitions / ratings.
- Prices/names are snapshotted into `order_items` at placement, never re-read
  live. Orders are historical records.
- Commit/push only when asked. Host: Railway (compute) + R2 (media).

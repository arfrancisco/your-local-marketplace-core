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

Building M0–M4 only. **No cart, no order edits, no payments, no mobile** this
phase. Orders are placed directly from a single item (no cart step) so chat and
ratings have something to attach to.

| Milestone | Scope | Status |
|---|---|---|
| Docs/ADRs | README, ERD, ADRs, milestone plan | ✅ done, pushed |
| M0 | Rails API foundation: auth, authz, storage, Redis/Sidekiq, CI | ✅ done |
| M1 | Vendor publishes a shop with items | ✅ done |
| M2 | Customer discovery (cart-free), daily-rotating shop list | ✅ done |
| M3 | Direct single-item order placement + lifecycle | ⬜ |
| M4 | Per-order chat with images + ratings | ⬜ |

Recommended review stops after M0 and after M3.

## Where the detail lives

- **Full build plan**: `/home/armfrancisco/.claude/plans/typed-nibbling-hare.md`
  (scope, domain model, API surface, build order, verification). Read this
  before starting M0.
- **Milestones**: `docs/milestones.md`
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
- Direct single-item order placement; no cart stage (0003)
- Cart deferred (0004); order edits deferred (0005)
- Images on Cloudflare R2, S3-compatible Active Storage; upload limits:
  JPEG/PNG/WebP, 5MB, 3/item, 1 per shop photo field, 1/chat message (0006)
- `GET /shops` uses a daily rotating order, never alphabetical (0007)

## Conventions

- No em-dashes in prose. Keep writing plain and direct.
- Business rules live in the Rails API, not the clients. Thin controllers,
  service objects for order placement / status transitions / ratings.
- Prices/names are snapshotted into `order_items` at placement, never re-read
  live. Orders are historical records.
- Commit/push only when asked. Host: Railway (compute) + R2 (media).

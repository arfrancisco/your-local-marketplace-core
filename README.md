# your-local-marketplace-core

A marketplace for neighbors selling to neighbors.

## What this is (and what it is not)

This is a **micro-hyperlocal** marketplace: the intended footprint is a small
cluster of neighboring buildings or units, not a city, district, or even a
full neighborhood in the usual sense. Think a handful of adjacent buildings
where residents already live within walking distance of each other.

A vendor is a neighbor selling their own products. A customer is another
neighbor. Fulfillment is either **pickup by the customer** or **delivery by
the vendor** — both of which are a short walk. There is no courier network
and no platform-managed logistics.

**This is deliberately not a radius-based local-search app.** There is no
"find shops near me", no distance sorting, no service radius, no map. Within
a few adjacent buildings there is no meaningful distance to filter or sort
by, so the product does not model one. Addresses are descriptive text
(unit and building, delivery instructions) rather than coordinates.

If a future version needs to span a genuinely larger area, that is a real
product change requiring a geo model — not a config tweak. See
`docs/adr/0002-no-geo-discovery.md`.

Live in production at **prisma.kapitmarket.ph**, hosted on Railway.

## Shape of the system

One Ruby on Rails API backend serves three React web clients:

```
apps/api/            Rails API — all business rules live here
apps/customer-web/   React client for customers
apps/vendor-web/     React client for vendors
apps/admin-web/      React client for internal admin (accounts, moderation, audit log)
admin-mcp/           MCP server exposing the admin API to Claude/agent tooling
e2e/                 Playwright end-to-end tests, run against the full local stack
```

An Android client is planned but lives in a **separate repo**, and its stack
is still undecided (see `docs/open-decisions.md`). The API is designed to
serve it without changes.

## Current scope

M0 through M4 (the original phased plan) are done, and the build has gone
well beyond that original boundary:

| Milestone | Scope | Status |
|---|---|---|
| M0 | Foundation: Rails API, auth, authorization, storage, CI | done |
| M1 | Vendor publishes a shop with items | done |
| M2 | Customer discovery (cart-free), daily-rotating shop list | done |
| M3 | Cart, checkout, order lifecycle | done |
| M4 | Per-order chat with images, and ratings after completion | done |
| Beyond M4 | Registration/verification, vendor onboarding, admin panel, mobile/UX polish, social previews | done |

A shopping cart was originally deferred past M3 and later reintroduced (ADR
0008) — checkout is now cart-based, not single-item. Order edits are still
deferred (ADR 0005). There is no payment gateway: vendors arrange payment
with customers directly over chat (ADR 0009) — a permanent design choice,
not a phase limitation.

What's left isn't more engineering so much as the product decisions in
`docs/open-decisions.md` (pilot location, fulfillment mode, cancellation
policy, etc.) that need an answer before this goes live to real neighbors
beyond the current beta.

## Documentation

- `CLAUDE.md` — orientation doc for working in this repo (architecture,
  conventions, where things live); a good second stop after this README
- `docs/architecture.md` — current system architecture
- `docs/erd.md` — data model
- `docs/adr/` — architecture decision records (authoritative wherever they
  disagree with `docs/product-handover.md` or `docs/milestones.md`)
- `docs/open-decisions.md` — product questions still unanswered
- `docs/milestones.md` — the original M0–M4 plan, frozen historically
- `docs/product-handover.md` — the original product spec this repo grew from
- `docs/legal/` — Terms and Conditions, Privacy Policy (drafts — need lawyer
  review before go-live)

## Local development

Prerequisites: Ruby, Node, Docker.

```bash
docker compose up -d    # Postgres + Redis
```

Each app has its own README with setup/run instructions: `apps/api/`,
`apps/customer-web/`, `apps/vendor-web/`, `e2e/`.

## Contributing

`main` is protected — changes land via pull request, not a direct push.

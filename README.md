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

## Shape of the system

One Ruby on Rails API backend serves two React web clients:

```
apps/api/            Rails API — all business rules live here
apps/customer-web/   React client for customers
apps/vendor-web/     React client for vendors
```

An Android client is planned but lives in a **separate repo**, and its stack
is still undecided (see `docs/open-decisions.md`). The API is designed to
serve it without changes.

## Current scope

The build is phased. This repo currently targets:

| Milestone | Scope |
|---|---|
| M0 | Foundation: Rails API, auth, authorization, storage, CI |
| M1 | Vendor publishes a shop with items |
| M2 | Customer discovers shops and browses items (no cart) |
| M3 | Customer places a direct single-item order; vendor fulfills it |
| M4 | Per-order chat with images, and ratings after completion |

**Deliberately not built yet**: shopping cart, order edits/change requests,
online payments, courier dispatch, promotions or fees, multi-vendor
checkout, inventory counts, admin interface, mobile clients.

Orders in this phase are placed directly against a single item rather than
assembled in a cart. The cart is a later milestone; the order model is built
to accept one without rework.

## Documentation

- `docs/product-handover.md` — the original product spec this repo grew from
- `docs/open-decisions.md` — product questions still unanswered
- `docs/erd.md` — data model
- `docs/adr/` — architecture decision records

## Local development

Prerequisites: Ruby, Node, Docker.

```bash
docker compose up -d    # Postgres + Redis
```

Per-app setup instructions live in each app's own README once scaffolded.

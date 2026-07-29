# ADR 0002 — No geographic discovery

Status: accepted
Date: 2026-07-29

## Context

The original product handover assumes a city-scale marketplace: customers
"discover nearby shops" filtered by latitude/longitude and a configurable
service radius, with PostGIS suggested for distance queries. That framing
carried a lot of weight in the spec (a `GET /shops/nearby` endpoint, lat/lng
on shops and addresses, `service_radius_meters`, geospatial tests).

The actual product is far smaller: a **micro-hyperlocal** marketplace spanning
a handful of adjacent buildings or units — neighbors selling to neighbors.
Everyone is already within a short walk. There is no meaningful distance to
filter or sort by within that footprint.

## Decision

Drop geographic discovery entirely for this product.

- No latitude/longitude on shops or addresses. Addresses are descriptive text
  (unit, building, delivery instructions).
- No `service_radius`, no distance filtering, no PostGIS.
- No `GET /shops/nearby`. Discovery is `GET /shops` — a simple listing of all
  active, open shops in the community.
- Ordering of that listing is handled by ADR 0007 (daily rotation), not by
  distance.

## Consequences

- Simpler data model and no geospatial dependency or tests.
- The README states plainly that this is not a radius-based local-search app,
  so the omission is not later mistaken for an oversight.
- If the product ever needs to span a genuinely larger area, reintroducing geo
  is a real product change requiring a new data model and endpoints — not a
  config flag. That is an acceptable future cost given the current scale.

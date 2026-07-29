# ADR 0007 — Daily rotating shop order

Status: accepted
Date: 2026-07-29

## Context

`GET /shops` lists all open shops in the community (ADR 0002 — no distance to
sort by). The default sort must not systematically favor any vendor.
Alphabetical ordering does exactly that: shops whose names start early in the
alphabet permanently sit at the top. With neighbors selling to neighbors,
that is a real fairness problem.

## Decision

Order the shop listing by a **daily rotation**. For each open shop compute a
sort key from its identity and the current day-of-year, e.g.:

```
sort_key = (shop_numeric_id + day_of_year) % open_shop_count
```

recomputed per request from the current date. This gives each open shop the
top position on a predictable, evenly distributed schedule across the
day-of-year cycle, with no extra database column and no scheduled job.

It is deterministic for a given date, so specs freeze time and assert an exact
ordering.

## Consequences

- No vendor is permanently advantaged; rotation is fair and explainable ("your
  shop leads on these days").
- Fully testable without randomness flakiness.
- The rotation is by shop, not personalized per customer — acceptable and
  simpler at this scale. If personalization or engagement-based ranking is
  ever wanted, that is a deliberate future change, not a default we backed
  into.
- Because it is computed per request from the date, there is no migration or
  backfill; changing the formula later is a code change only.

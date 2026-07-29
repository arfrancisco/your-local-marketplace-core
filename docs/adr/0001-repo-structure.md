# ADR 0001 — Monorepo with one API and two web clients

Status: accepted
Date: 2026-07-29

## Context

The product is one Rails API backend serving two React web clients (customer
and vendor). An Android client is planned but will live in its own repo with
an undecided stack. We need a repository layout that lets the owner run and
understand the whole web system with minimal ceremony, without prematurely
committing to shared-package tooling.

## Decision

Use a single monorepo containing the API and both web clients:

```
apps/api/            Rails API
apps/customer-web/   React
apps/vendor-web/     React
```

No `packages/` shared-code layer yet. If the two web clients grow genuinely
shared code (an API client, shared types), extract it then — not
speculatively.

The Android client is explicitly **out** of this repo. Its stack is undecided
(see ADR — none yet; tracked in `docs/open-decisions.md`), and forcing it into
this monorepo would couple an unrelated build toolchain to the web release.

## Consequences

- One clone, one place to see the whole web product.
- The API is the single source of business rules; clients stay thin.
- Cross-cutting changes (API contract + client) are one commit.
- When the Android repo appears, contract drift between it and the API is a
  real risk to watch; a generated/shared API schema may be worth adding then.

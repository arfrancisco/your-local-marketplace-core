# ADR 0005 — Order edits deferred

Status: accepted
Date: 2026-07-29

## Context

The handover bundles order change requests/edits into Milestone 4 alongside
chat and ratings, with an `order_change_requests` table and an
accept/reject/withdraw flow with its own audit trail. This is meaningful
complexity: proposing changes, agreeing on them, copying accepted changes into
normalized order items, and auditing all of it.

For this phase, the point of M4 is communication (chat) and feedback
(ratings). If a neighbor needs to change an order, they can simply talk about
it in the order chat and the vendor can cancel/re-place, which is acceptable
at this scale.

## Decision

Do not build order edits in this phase. No `order_change_requests` table, no
change-request endpoints. If an order needs to change, participants use chat
and, if necessary, cancellation + a new order.

## Consequences

- M4 is substantially smaller and focused on chat + ratings.
- The order lifecycle (ADR 0003) already forbids arbitrary mutation of placed
  orders, so when edits are eventually added they slot in as an explicit,
  audited flow rather than loosening existing guarantees.
- Chat carries the informal "can you change X" conversation in the meantime,
  which is honest about how neighbors at this scale actually coordinate.

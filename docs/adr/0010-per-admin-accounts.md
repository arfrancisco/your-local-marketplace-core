# ADR 0010 — Per-admin accounts, bearer sessions, and an audit trail

Status: accepted
Date: 2026-08-04

## Context

The entire `/admin` surface (16+ resource controllers covering users, shops,
orders, feedback, error logs, and more) has been gated by one shared HTTP
Basic Auth credential (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, defaulting to
`admin`/`admin` if unset in non-production environments) since the admin
panel was first built. That was fine for a single operator standing the
panel up. It stops being fine once a second person needs access: there is
no per-admin identity, so every action in the system looks like it came
from "admin"; a leaked or shared credential can't be revoked for one person
without breaking it for everyone; and there is no real login/logout —
admin-web's "login" is just caching the username/password locally and
re-sending it as a Basic Auth header on every request. The team is expected
to grow, and this was flagged independently by a legal-readiness review as
a real, currently-live production risk, not just a hygiene concern.

## Decision

**A new, isolated model set, not an extension of `User`/`ApiToken`.**
`AdminUser` (table `admin_users`, `has_secure_password`) and
`AdminApiToken` (table `admin_api_tokens`, `belongs_to :admin_user`) mirror
the *pattern* already used for customer/vendor auth (`User`/`ApiToken`:
SHA-256 digest storage, 30-day TTL, `issue!`/`authenticate`) rather than
making the existing models polymorphic or adding a role column. This keeps
the admin security boundary architecturally separate from marketplace-user
identity. It's the same call this project already made once, in ADR 0001,
to duplicate rather than share across the customer/vendor web-client split
— here it's the same preference applied to a second axis: duplication over
a cross-cutting shared abstraction, specifically because admin identity and
marketplace-user identity should never be able to leak into or be confused
with each other.

**One auth concern swap, not sixteen controller edits.** A new
`Admin::Authentication` concern (mirroring the existing `Authentication`
concern used by customer/vendor auth) replaces
`Api::V1::Admin::BaseController#authenticate_admin!`'s hand-rolled
Basic-Auth decode with a bearer-token lookup against `AdminApiToken`. Every
existing admin resource controller already inherits this one base
controller, so the auth mechanism changes in a single file. Deactivated
admins are checked on **every request**, not just at login, so revoking an
admin's access takes effect immediately rather than only on their next
sign-in.

**An audit trail via one `around_action`, not sixteen controllers touched.**
`Api::V1::Admin::BaseController` gets an `around_action :record_audit_log`
that fires on any mutating request (POST/PATCH/PUT/DELETE) once
`current_admin_user` is set, writing a best-effort `AdminAuditLog` row:
admin, HTTP method, path, controller/action, resource type/id (inferred
from `controller_name`/`params[:id]`), status code, filtered params, IP.
This is kept deliberately approximate — no before/after diff of what
changed — rather than a full change-log system, because the actual ask is
"who did this," not a general-purpose revision history. Reads are
deliberately not logged: they don't need attribution the way a mutation
does, and logging every GET would make the table's growth rate and signal-
to-noise ratio far worse for no real benefit.

**First admin via a rake task; everyone after that is self-service.**
`admin_users:create` (env-var driven, aborts if any `AdminUser` already
exists) creates the very first account, since there's no admin yet to grant
one through the UI. After that, admin-web's new "Admin accounts" page
(backed by `Api::V1::Admin::AdminUsersController`) handles create/
deactivate/reactivate without needing server access each time — the
locked-in scope decision behind giving the team page-level self-service
rather than keeping account creation rake-task-only forever. Deactivating
an admin also immediately expires their existing tokens, and an admin
can't deactivate their own account (a self-lockout guard).

**Basic Auth is deleted outright — no dual-auth transition window.** A
period where either the old shared credential or new per-admin tokens both
work would be strictly worse than what exists today (it doubles the attack
surface instead of closing it), and there is no meaningful test coverage
gap a transition period would protect: the existing admin request specs
already just assert 401-on-bad-credentials, a property that holds equally
well against bearer tokens. The deploy sequence is: migrate, bootstrap the
first `AdminUser` in production, confirm login works, then ship the code
that removes Basic Auth entirely and requires `ADMIN_ENABLED=true` (which
replaces the old `ADMIN_USERNAME`-presence check that used to gate whether
the admin routes even existed, since that env var no longer exists).

**admin-mcp gets a pre-minted long-lived token, not an interactive login.**
It's a long-running local process, not something a human logs into each
session. A second rake task, `admin_users:mint_token[email,ttl_days]`,
mints a longer-lived `AdminApiToken` (default 180 days) explicitly
out-of-band — server/rake access required, not exposed through the HTTP
login endpoint, which always issues the standard 30-day token, same as
customer/vendor. `admin-mcp/.env`'s `ADMIN_USERNAME`/`ADMIN_PASSWORD`
become a single `ADMIN_TOKEN`.

**Sidekiq::Web is explicitly left untouched.** The `/sidekiq` dashboard
keeps its own, separate `SIDEKIQ_WEB_USERNAME`/`PASSWORD` Basic Auth pair.
It's a different tool for a different audience (infrastructure/queue
inspection, not marketplace administration), and folding it into the new
`AdminUser` system would couple two things that don't need to be coupled.
This was a locked-in scope decision going in, not something reconsidered
during implementation.

## Consequences

- Every admin action is now attributable to a specific person, not a shared
  "admin" identity — the actual goal of this change.
- Revoking one admin's access no longer requires rotating a credential
  every other admin also depends on.
- The audit trail answers "who did this" for any mutation, browsable in
  admin-web's Audit log page and via admin-mcp, but is not a full diff/
  history system — if that's ever needed, it's a separate, later decision.
- `AdminUser`/`AdminApiToken` are one more model pair to maintain in
  parallel with `User`/`ApiToken`, a cost accepted deliberately for the
  isolation it buys, consistent with this project's existing tolerance for
  duplication over shared abstraction (ADR 0001).
- There is no dual-auth fallback period in production; the cutover happens
  in one deploy, in the sequence above, not gradually.
- Sidekiq::Web's Basic Auth is a known, accepted exception to "no more
  Basic Auth in this codebase" — intentionally out of scope here, not an
  oversight.

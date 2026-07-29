# Open decisions

Questions that are not yet answered but do not block the current build.
Resolve before the relevant milestone ships to real neighbors.

## Product

1. **Pilot location** — which specific cluster of buildings is the first pilot?
2. **Fulfillment** — pickup only, vendor delivery only, or both, for the pilot?
   (The data model supports both; this is about what to enable.)
3. **Cancellation policy** — which order states allow customer self-cancel vs.
   require vendor agreement?
4. **Order edits** — when edits are eventually built, may a vendor edit an
   accepted order directly, or must every change be customer-approved?
   (Edits are out of scope for the current phase — see ADR 0005.)
5. **Vendor verification** — must a vendor be verified before publishing a
   shop, or can they publish immediately and be verified later?
6. **Rating direction** — customer-rates-vendor only, or mutual ratings?
   (Current build: customer-rates-order after completion. Mutual is a later
   question.)
7. **Notification channels** — email, SMS, push, in-app? Which are required
   for the pilot? (Note the known push-delivery unreliability documented in
   the personal-os project may or may not apply here — this is a separate
   app.)
8. **Currency, tax, receipts** — single currency assumed for now; are receipts
   or tax handling needed for the pilot?
9. **Multiple shops per user** — may one user operate more than one shop?

## Technical / platform

10. **Android client stack** — **undecided.** Will live in a separate repo.
    Leaning toward native Kotlin + Jetpack Compose over React Native for
    Android-specific compatibility (background tasks, notifications, camera,
    OEM quirks), but not committed. iOS is not currently planned. The API in
    this repo is being built to serve whatever client stack wins, so this
    decision does not block backend work.

11. **Hosting** — Railway is the current intended host for the API. Image
    storage is deliberately *not* on Railway (see ADR 0006 — Cloudflare R2).

12. **Verification delivery** — email and SMS verification are modeled, but the
    actual sending providers (SMTP service, SMS gateway) are not chosen. In
    development these can be stubbed/logged rather than actually sent.

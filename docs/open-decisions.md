# Open decisions

Questions that are not yet answered but do not block the current build.
Resolve before the relevant milestone ships to real neighbors.

All of M0 through M4 (and a fair amount beyond it, see `CLAUDE.md`'s
"Current phase") are built. Nothing left on this list is an engineering
task; every item below is a product or business call for the founder to
make before going live to real neighbors.

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
   shop, or can they publish immediately and be verified later? (Current
   default: publish immediately. `verification_status` exists on
   `vendor_profile` but nothing gates shop creation on it today.)
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
   (Current default: one shop per vendor, enforced by a uniqueness
   validation on `vendor_profile_id`, not a DB constraint. Documented in
   `shop.rb` as easy to lift if this changes.)

## Technical / platform

10. **Android client stack** — **undecided.** Will live in a separate repo.
    Leaning toward native Kotlin + Jetpack Compose over React Native for
    Android-specific compatibility (background tasks, notifications, camera,
    OEM quirks), but not committed. iOS is not currently planned. The API in
    this repo is being built to serve whatever client stack wins, so this
    decision does not block backend work.

11. **Hosting (resolved).** Railway hosts the API (compute) and Cloudflare R2
    hosts image storage (see ADR 0006). Live in production at
    prisma.kapitmarket.ph.

12. **Verification delivery (resolved, one operational step pending).** SMS
    verification uses Semaphore; email verification uses Cloudflare Email
    Service. Both are implemented and wired in (not stubbed/logged only).
    Semaphore requires a custom Sender Name to be approved before production
    SMS can go out under the app's own name; their stated turnaround is up to
    5 business days with no official expedited option (checked directly with
    their FAQ). Confirm this has actually cleared, and whether any shared/
    default sender ID still works for OTP delivery in the meantime, before
    relying on SMS verification for real users.

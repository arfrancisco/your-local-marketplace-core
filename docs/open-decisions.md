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
3. **Cancellation abuse (resolved).** Both the cancellation mechanism and its
   consequences are built and live. Either a customer or a vendor may cancel
   while an order is `placed` or `accepted` (not once preparation has
   started), and must select a reason code (see
   `Order::CUSTOMER_CANCELLATION_REASONS`/`VENDOR_CANCELLATION_REASONS` and
   `Orders::TransitionStatus`). A two-tier abuse check
   (`Orders::CancellationAbuseCheck`) runs on every cancellation: 3
   cancellations by the same customer or vendor within a rolling 14-day
   window trigger a temporary restriction (blocks the customer from
   checkout, or closes the vendor's shop), admin-clearable via
   `clear_cancellation_restriction` on `Api::V1::Admin::CustomerProfilesController`
   /`VendorProfilesController`. A second offense after being cleared once
   escalates to a full account suspension (`User#status = "suspended"`, the
   same mechanism already enforced at login). This is documented in the
   Terms and Conditions (Section 3, "Eligibility and accounts") and
   surfaced to users as a small-print reminder in both apps'
   `CancelOrderModal`.
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

12. **Verification delivery (email resolved; SMS still temporarily disabled
    for beta).** SMS verification uses Semaphore; email verification uses
    Cloudflare Email Service. Both are implemented and wired in (not
    stubbed/logged only). Email verification is now fully resolved and
    mandatory: registration step 2 (`VerifyEmailPage.tsx`) requires
    confirming the emailed code before signup can finish — there's no
    "skip for now" option. `VITE_SKIP_VERIFICATION` no longer does
    anything; it was removed from customer-web's runtime code and only
    survives as a harmless leftover in a type declaration
    (`vite-env.d.ts`) and `.env.example`.

    SMS is the part still disabled. Semaphore requires a custom Sender Name
    to be approved before production SMS can go out under the app's own
    name; their stated turnaround is up to 5 business days with no official
    expedited option (checked directly with their FAQ), and there's no
    confirmation yet that it has cleared. Until then, mobile verification
    stays unused in place: `VerifyMobilePage.tsx` is still in the codebase,
    swapped out of the registration flow in favor of the email step above.
    Once Semaphore's sender name is confirmed approved, swap it back in as
    the same kind of mandatory step email verification already is, not as a
    skippable one (its old "Skip for now" link should not come back).

    The backend `SKIP_VERIFICATION` env var (Railway, gates the
    email-verified requirement in `Vendors::EligibilityCheck` for becoming
    a vendor) still exists in code. It's now largely moot for new users
    since registration verifies their email regardless, but flip it off if
    it's still set in Railway.

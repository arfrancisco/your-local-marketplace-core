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

12. **Verification delivery (resolved — mobile is now the mandatory
    registration step).** SMS verification uses Semaphore; email
    verification uses Resend. Both are implemented and wired in — no
    channel is stubbed/logged only. Semaphore's custom Sender Name
    approval (the prior blocker) landed, so SMS is now registration's
    mandatory step 2 (`VerifyMobilePage.tsx`) — no "skip for now" option.
    `VerifyEmailPage.tsx` is still in the codebase, unused in the
    registration flow (kept in case email ever needs to become primary
    again, same pattern `VerifyMobilePage.tsx` had before this swap).

    Customers need `mobile_verified?` to check out (`Carts::Checkout`) —
    no exceptions for anyone who registers going forward, since mobile
    verification is a non-skippable registration step now. Accounts that
    predate this swap (registered back when email was the mandatory step,
    so they have `email_verified_at` but no `mobile_verified_at`) may
    substitute `email_verified?` instead, gated by a hard cutover
    timestamp (`Carts::Checkout::MOBILE_VERIFICATION_MANDATORY_SINCE`) —
    this avoids locking out pre-existing accounts post-swap without a
    backfill, while keeping mobile verification actually mandatory for
    everyone who registers after the cutover.

    This swap has a side effect worth naming: `Vendors::EligibilityCheck`
    (unchanged by this swap) still requires `email_verified?` for becoming
    a vendor, so that's now a real second verification step on top of the
    mobile verification every customer already completes at registration,
    not a duplicate of it — a genuine two-tier trust bar, not a leftover.

    `VITE_SKIP_VERIFICATION` no longer does anything on the frontend; it
    was removed from customer-web's runtime code and only survives as a
    harmless leftover in a type declaration (`vite-env.d.ts`) and
    `.env.example`.

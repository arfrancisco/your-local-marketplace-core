# Implementation handover: what's left before beta goes live

No prior version of this doc existed. This is a fresh punch list, written
2026-08-05, pulling together what changed today, what's still broken or
undone, and the product decisions (`docs/open-decisions.md`) that were
already known to be open. Nothing here is graded by difficulty, it's
graded by whether it blocks a real neighbor signing up and using the app.

## What got fixed today (context for the rest of this doc)

Two production bugs turned out to share a root cause, and fixing them
surfaced a few more gaps worth tracking:

1. **Admin panel 404 in production**: `ADMIN_ENABLED` was never set on
   Railway, and no `AdminUser` existed yet. Fixed: env var set, first admin
   bootstrapped via the `admin_users:create` rake task.
2. **Verification emails never sent**: two layered causes. First,
   `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` were configured locally but never
   copied to Railway. Second, and worse: **no Sidekiq worker process has
   ever actually run in production.** `Procfile` defines one, but only the
   Puma web service was provisioned, so every background job (not just
   verification, all of them) has been enqueuing and silently never
   processing since this app went live. Fixed: Resend credentials set on
   the `api` service, a dedicated `worker` Railway service provisioned
   running Sidekiq, confirmed processing real queued jobs including an
   actual verification email delivered end to end.
3. **`FEEDBACK_NOTIFICATION_EMAIL` was also unset in production**, same
   pattern as #2's first cause. This is the address `FeedbackNotificationJob`
   and `ErrorAlertJob` send to, so in-app feedback and internal error alerts
   have likely never reached an inbox either. Now set on both `api` and
   `worker`.
4. Contact email consolidated to `team.kapitmarket@gmail.com` (legal docs,
   feedback notifications, error alerts) instead of a personal address.
5. Added a `demo` flag on `User` (derived across Shop/Item/Order/Rating/
   VendorProfile/CustomerProfile) so seeded data is visually distinguishable
   from real beta-user activity in the admin panel.
6. Added a real admin-driven residency-verification workflow for customers
   (`CustomerProfile#residency_verification_status`), mirroring the vendor
   verification flow that already existed. Previously residency was
   self-declared only, and the legal docs said so explicitly, those docs
   are now updated to match the new reality.

The takeaway worth sitting with: **#2 means background jobs silently never
ran in production until today.** Anything gated on a background job
(verification, feedback/error notifications, image analysis) may have
quietly failed for every real user who signed up before this fix. Worth
deciding whether any early beta testers need a manual follow-up.

## Still open: infrastructure / ops

- ~~Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the `api` service's
  Railway variables.~~ **Done 2026-08-07**, partially: both values were
  overwritten with inert placeholders (a working GraphQL `variableDelete`
  mutation still wasn't reachable with the credentials available this
  session either — same gap as before, actual deletion still needs the
  Railway dashboard).
- ~~Change the admin password.~~ **Done 2026-08-07** — the exposed
  placeholder above was live and unrotated for two days; rotated directly
  against the `admin_users` table (verified the new hash authenticates).
  The old value is still recoverable from this file's git history, which a
  rotation neutralizes but doesn't erase — worth keeping in mind before
  ever making this repo public.
- ~~Worker service Redis latency.~~ **Done 2026-08-07** — `worker` is now
  explicitly pinned to Southeast Asia (matching `api`/Redis) via
  `scale_service`, rather than relying on whatever region it happened to
  land in by default. Worth a log check after the next real-load period to
  confirm the "extremely poorly" warning is actually gone, not just
  unlikely to still be relevant.
- **Silent error swallowing in the two jobs that most need alerting.**
  `VerificationDeliveryJob#perform_request` and presumably other
  provider-calling jobs deliberately rescue and swallow `StandardError`
  rather than raise into Sidekiq's retry storm. That means if Resend or
  Semaphore starts failing again, the app's own `ErrorLog` observability
  (built to catch exactly this class of failure) will never see it. Worth
  a narrower fix: log to `ErrorLog` explicitly inside the rescue, without
  changing the no-raise behavior.
- **"Deploy-ready config + instructions"**: the oldest open item in the
  build tracker, never closed out. Worth a final pass: is there a written,
  current runbook for "how to deploy this from scratch," or does that
  knowledge only exist in this session's history now?
- **admin-web observability follow-up**: customer-web and vendor-web both
  got error-ID display and broadened crash capture; admin-web didn't yet.

## Still open: legal

`docs/legal/README.md` and the two draft documents are honest about their
own gaps, but a few are now stale relative to what's actually built:

- **Never reviewed by a lawyer.** This is the blocking item. Everything
  else in this section is prep work for that review, not a substitute
  for it. Get a Philippines-licensed lawyer to review both documents
  before real (non-beta-tester) signups open, per the DPA exposure
  `docs/legal/README.md` already flags.
- **Privacy policy still says the email/SMS provider "hasn't been
  selected yet."** It has: Resend (email) and Semaphore (SMS) are both
  live in production as of earlier sessions. Update `docs/legal/
  privacy-policy.md` section 3 to name them as subprocessors instead of
  leaving it generic, this is a factual update, not a legal judgment call,
  but the lawyer should see the final wording too.
- **`docs/open-decisions.md` item 12 says email verification uses
  "Cloudflare Email Service."** It doesn't, it uses Resend. Minor, but
  worth fixing so the doc doesn't mislead the next person who reads it.
- **The README's "Implementation not yet done" section is stale.** It
  lists `terms_accepted_at`, marketing opt-in columns, `Auth::RegisterUser`
  validation, and a signup checkbox as not built. All of these are built
  (confirmed: `terms_accepted` is wired through `LoginPage.tsx` in
  customer-web and covered by a test). Update or delete that section so it
  stops reading as an outstanding task.
- **Effective date is still a placeholder** ("upon beta launch, date to be
  confirmed") in both documents. Fill in the real date when beta actually
  opens to non-tester users.
- **Vendor permits for food/goods** are flagged inline in the ToS as
  needing a lawyer's specific attention if vendors will sell home-cooked
  food. Surface this explicitly in the review request.

## Still open: verification status itself

Worth confirming directly now that the pipeline actually works, since the
written state and the actual configured state may have drifted:

- **`SKIP_VERIFICATION` is not currently set on the production `api`
  service** (checked via Railway variables today). `docs/open-decisions.md`
  describes verification as "currently switched off end to end" for beta,
  but the unset default means the code path (`Vendors::EligibilityCheck`)
  actually **requires** email verification right now. Since verification
  email delivery was broken until today's fix, this may have been quietly
  blocking real users from becoming vendors. Decide: turn `SKIP_VERIFICATION`
  back on deliberately for the remainder of the beta, or leave it off now
  that delivery actually works and test a real signup end to end to confirm.
- **`VITE_SKIP_VERIFICATION`** (customer-web, build-time flag controlling
  the mobile-verification screen) wasn't checked this session. Confirm its
  current value in the Dockerfile/build args matches the decision above.
- **Semaphore's custom Sender Name approval status is unconfirmed.**
  `docs/open-decisions.md` notes this was pending as of its last update,
  with no official expedited path. Check current status before flipping
  verification back on for SMS.

## Still open: product decisions (not engineering, founder calls)

Unchanged from `docs/open-decisions.md`, repeated here only because
"decide these" is itself a go-live blocker even though no code is needed:

1. Pilot location: which specific cluster of buildings?
2. Fulfillment: pickup only, delivery only, or both for the pilot?
3. Cancellation policy: which order states allow customer self-cancel?
4. Vendor verification: gate shop creation on it, or verify after publish
   (today's default)? The admin tooling to actually verify now exists for
   both vendors and residents, so this is more answerable today than it
   was when the question was first written.
5. Rating direction: customer-rates-vendor only (current), or mutual?
6. Notification channels required for the pilot: email, SMS, push, in-app?
7. Currency/tax/receipts needed for the pilot?
8. Multiple shops per vendor, ever?
9. Business registration (DTI/BIR): not needed to run the free beta, but
   blocks turning on any platform fee later. No rush, just don't forget it
   exists once fees are on the table.

## Suggested order of attack

1. Remove the leftover admin bootstrap vars and change the admin password
   (five minutes, pure cleanup, no dependencies).
2. Decide the `SKIP_VERIFICATION` question and test one real signup end to
   end now that the worker actually processes jobs.
3. Fix the two stale legal-doc claims (provider names, the "not yet built"
   section) so the documents are accurate before they go to a lawyer.
4. Send the documents for legal review. This has the longest lead time of
   anything on this list, start it in parallel with everything else rather
   than last.
5. Everything else in "infrastructure / ops" can happen opportunistically.
6. The product decisions block a real pilot regardless of engineering
   state, work through them whenever the founder has time, ideally before
   step 4's legal review comes back so the reviewed documents don't need a
   second pass.

# Legal compliance implementation: handover brief

**For:** an engineer or agent picking this up cold
**Branch to work on:** `claude/terms-conditions-privacy-q7i9fy` (or a fresh
branch off it)
**Prerequisite reading:** `docs/legal/README.md` (findings), then the two
documents themselves. Repo conventions are in `CLAUDE.md`.

## Why this exists

KapitMarket PH now has a Terms and Conditions and a Privacy Policy
(`docs/legal/terms-and-conditions.md`, `docs/legal/privacy-policy.md`).
They were written against the real implementation and revised on
2026-08-04 after an audit against the code.

**The documents exist as text. Almost none of what they promise is
enforced by the app.** This brief lists the work needed to close that
gap, in priority order. Items P0-1 through P0-3 must land before the beta
takes signups from real neighbors, because until then the app either
makes promises it cannot keep or actively leaks data.

Some of these are also code correctness/security fixes that are worth
doing regardless of the legal angle.

## Ground rules

- **The legal text is already written. Do not rewrite it.** If code
  cannot match a statement in the documents, change the code, or flag it
  and propose a text change. Do not quietly reword the policy to match a
  shortcut.
- **No em-dashes in prose** (`CLAUDE.md`). Both legal documents are
  currently clean of them. Keep it that way.
- Business rules live in the Rails API, not the clients. Thin
  controllers, service objects for the real logic.
- **Out of scope, do not build:** payment gateway (ADR 0009 makes this a
  permanent boundary), any geo/location feature (ADR 0002), analytics or
  advertising trackers (deliberately declined, see the Notion build log
  2026-08-01), ratings (a separate milestone).
- Commit as you go with clear messages. Do not open a PR or merge to
  `main` unless asked.

## Test commands

```bash
# API
cd apps/api
bin/rails db:test:prepare
bundle exec rspec

# Web clients (each)
cd apps/customer-web && npm run test && npm run build
cd apps/vendor-web   && npm run test && npm run build
```

Specs live in `apps/api/spec/{models,requests,services,factories}`. Match
the existing style. The suite was 163 examples green as of 2026-07-31.

---

# P0: must land before real signups

## P0-1. Consent gating at registration

**Problem.** Nothing requires a user to agree to the Terms or Privacy
Policy before an account is created, and neither web client links to the
documents at all. There is also no record of who agreed to what version.

**Also in scope here:** capturing marketing opt-in as a *separate*
unchecked-by-default choice. Under RA 10173 and NPC guidance, marketing
consent must be specific and unbundled, and cannot be a condition of
using the Service. Privacy Policy Section 3 commits to exactly this.
Getting the column in now means the consent is captured correctly from
day one, even though nothing sends marketing yet.

### Backend

**Migration** on `users`:

| Column | Type | Notes |
|---|---|---|
| `terms_accepted_at` | `datetime` | null until accepted |
| `terms_version` | `string` | the version accepted |
| `email_marketing_opt_in` | `boolean` | `null: false, default: false` |
| `sms_marketing_opt_in` | `boolean` | `null: false, default: false` |
| `marketing_opt_in_at` | `datetime` | when opt-in was given, null if never |

Backfill is not a concern (no production users yet). If any exist,
backfill `terms_accepted_at` to null and treat them as needing
re-acceptance on next sign-in rather than silently grandfathering them.

**Version constant.** Add something like `app/models/legal.rb`:

```ruby
module Legal
  # Bump when either document changes materially. Must match the
  # "Last updated" date in docs/legal/*.md.
  CURRENT_VERSION = "2026-08-04".freeze
end
```

**Enforcement** in `app/services/auth/register_user.rb` (the single
chokepoint, since `POST /api/v1/auth/register` is the only path that
creates a user):

- Accept `terms_accepted:` (boolean), `email_marketing_opt_in:`,
  `sms_marketing_opt_in:`.
- Raise `ApiError::UnprocessableEntity` if `terms_accepted` is not true.
  Message: something like "You must accept the Terms and Privacy Policy
  to create an account."
- On success set `terms_accepted_at: Time.current`, `terms_version:
  Legal::CURRENT_VERSION`, the two opt-in booleans, and
  `marketing_opt_in_at` only if at least one opt-in is true.
- **Do not default the opt-ins to true, and do not infer them from
  `terms_accepted`.** They are independent.

Update `registration_params` in
`app/controllers/api/v1/registrations_controller.rb` to permit the new
fields.

Expose `terms_accepted_at`, `terms_version`, and the two opt-in booleans
on `app/serializers/user_serializer.rb` so clients can tell when
re-acceptance is needed.

**Specs:** registration rejected without acceptance; accepted with it and
stamps version; opt-ins default false when omitted; opt-ins stored
independently of acceptance.

### Serving the documents

Both clients need reachable pages. **Keep `docs/legal/*.md` as the single
source of truth.** Recommended approach: a small prebuild script in each
app's `package.json` that copies the two markdown files into
`src/legal/`, imported with Vite's `?raw` suffix and rendered. A minimal
renderer is enough; adding `react-markdown` is acceptable if you would
rather not hand-roll it.

Do not fork the text into JSX. If the copies drift, the version stamp
becomes a lie.

Add routes in **customer-web** (`src/App.tsx`): `/terms` and `/privacy`,
plus footer links visible without signing in. **vendor-web**
(`src/App.tsx`) needs the same two routes, outside `RequireAuth`.

### Frontend: customer-web only

Note: **vendor-web has no registration flow** (`src/auth.tsx` exposes
only `login`). Accounts are created through customer-web. Two places
call register and both need the checkbox:

- `src/components/AuthModal.tsx` (the inline add-to-cart signup)
- `src/pages/LoginPage.tsx` (`mode === 'register'`)

In each, when in register mode:

- A **required** checkbox, unchecked by default: "I agree to the Terms
  and Conditions and Privacy Policy", with both phrases as links to the
  new routes. Submit must be blocked until checked.
- Two **optional** checkboxes, unchecked by default, visually separated
  from the required one: email updates, and SMS updates. Label them
  honestly, for example "Email me occasional updates and promotions
  (optional)". Do not pre-check, do not bundle into one control with the
  required checkbox.
- Thread the three booleans through `register()` in `src/auth.tsx` and
  `api.register()` in `src/api/client.ts`.

**Acceptance:** you cannot create an account through any UI path or
directly against the API without explicit acceptance; a fresh account has
both marketing flags false unless deliberately checked; `/terms` and
`/privacy` render in both apps without signing in.

---

## P0-2. Stop leaking secrets and private messages into logs

Three separate leaks. All small fixes.

**a. Verification codes are logged in plaintext.**
`app/jobs/verification_delivery_job.rb` does
`Rails.logger.info("... code=#{code} ...")`. Privacy Policy Section 1
says codes are stored only as hashes, which is true of the database but
false of the logs.

Fix: guard the log line so it only runs in development, or drop it
entirely when a real delivery provider is wired in. Never log the
plaintext code in production.

**b. Verification codes and chat bodies pass through unfiltered request
params.** `config/initializers/filter_parameter_logging.rb` currently
filters `:passw, :secret, :token, :_key, :crypt, :salt, :certificate,
:otp, :ssn`. The verification confirm endpoint uses `code`, and
`POST /api/v1/orders/:id/messages` uses `body`. Neither is filtered, so
verification codes and the full text of private chat messages are
written to the Rails log.

Fix: add `:code` and `:body` to the filter list. Consider also
`:mobile_number` and `:sent_to`.

**c. Bearer tokens travel in the WebSocket query string.**
`app/channels/application_cable/connection.rb` reads
`request.params[:token]`, so `wss://.../cable?token=<live 30-day token>`
appears in access logs and any proxy in between. Privacy Policy Section
10 claims tokens are stripped from logs.

Fix, in preference order:

1. Issue a short-lived single-use "cable ticket" from an authenticated
   endpoint (60 seconds, one-time) and exchange that on connect, keeping
   the long-lived token out of URLs entirely.
2. If deferring, say so and soften the Privacy Policy sentence rather
   than leaving an inaccurate claim in place.

**Acceptance:** grep a captured production-mode log after exercising
sign-in, verification, and chat, and find no plaintext code, no message
body, and no bearer token.

---

## P0-3. A real account-closure path

**Problem.** Privacy Policy Section 9 and Terms Section 13 both let users
request account deletion. There is no endpoint, no service, no rake task.
Worse, the obvious implementation is actively harmful:

`User has_one :customer_profile, dependent: :destroy` chains through
`CustomerProfile has_many :orders, dependent: :destroy` to `order_items`,
`order_status_events`, and `conversation`. **Destroying a customer would
destroy the vendor's record of those sales.** The same is true through
`vendor_profile → shops → orders` in the other direction.

In practice `user.destroy` would probably raise a foreign key violation
first, because `messages.sender_user_id` and
`order_status_events.actor_user_id` have FK constraints and no
`dependent:` rule. Either way there is no working path today.

**Build `Users::CloseAccount`** (a service, not a `destroy`). It must
anonymize in place and never call `user.destroy`.

Design:

- Add `"closed"` to `User::STATUSES`; set `status: "closed"`.
- Destroy all the user's `api_tokens` so sessions die immediately.
- Replace `email` with a non-routable unique placeholder (the column is
  `null: false` and uniquely indexed), for example
  `"closed-#{user.id}@kapitmarket.invalid"`. Null out `mobile_number`,
  `email_verified_at`, `mobile_verified_at`. Reset `password_digest` to a
  fresh random value so the old password stops working.
- Delete: `addresses`, `carts` and their `cart_items`, and all
  `verification_challenges`.
- Rename `customer_profile.display_name` and
  `vendor_profile.display_name` to something neutral such as
  "Former member".
- For a vendor: set every shop to `status: "suspended"`,
  `accepting_orders: false` so listings stop being discoverable. Do not
  destroy shops or items, because `order_items.item_id` references them.
- **Keep, untouched:** `orders`, `order_items`, `order_status_events`,
  `conversations`, `messages`. These are the counterparty's record.

Then update `Auth::AuthenticateUser` to reject `status == "closed"` the
same way it already rejects `"suspended"`.

Exposure: a rake task or console-only entry point is acceptable for the
beta, since Privacy Policy Section 9 describes this as a manual
email-driven process. Do not promise a self-service button in the UI
unless you build one.

**Specs, and be strict here:** closing a customer's account leaves their
orders, order items, status events, and chat messages intact and still
readable by the vendor; the closed user cannot sign in; personal fields
are gone; no foreign key violation is raised. Add the mirror test for a
vendor account.

**If you change what is retained or deleted, update Privacy Policy
Section 9 to match.** The list in the policy and the behavior of this
service must stay in sync.

---

# P1: soon after, before the beta widens

## P1-1. Privacy notice at early-access collection

`apps/customer-web/src/components/EarlyAccessModal.tsx` collects name,
email, mobile, and interest through a public endpoint, with no privacy
notice and no consent language. Those contact details are exactly the
ones intended for future marketing.

Add a short notice above the submit button linking to `/privacy`, plus an
explicit opt-in checkbox if these addresses will ever receive marketing.
Retroactive consent is not consent. If the checkbox is added, store it on
`early_access_signups` (new boolean column, default false).

## P1-2. Strip EXIF metadata from uploads

Active Storage keeps uploads byte-for-byte and nothing in
`app/models/concerns/image_attachable.rb` strips metadata. A phone photo
can carry GPS coordinates, which is a poor fit for a product that
deliberately has no geo (ADR 0002). Privacy Policy Section 1 currently
discloses this honestly, which is the correct interim position.

Strip metadata on upload (an `ImageProcessing`/vips step in the attach
path). When done, update that paragraph in Privacy Policy Section 1.

## P1-3. Vendor identity capture (RA 11967)

The Internet Transactions Act of 2023, fully in force since 20 June 2025,
requires online marketplaces to collect and hold identifying information
about merchants *before* they list, maintain a merchant list, and act on
takedown orders. Failure to exercise ordinary diligence creates
subsidiary liability to the consumer, with DTI fines up to ₱1,000,000.

`vendor_profiles.verification_status` already exists with the states
`unverified/pending/verified/rejected` and is completely dormant, and
Terms Section 4 already commits vendors to providing this on request.

Minimum viable version: fields to record what was collected (legal name,
contact number, ID or business registration reference, who checked it,
when), a way to move `verification_status`, and a decision on whether an
unverified vendor may publish at all (this is open decision #5 in
`docs/open-decisions.md`). Console-level actions are fine to start,
consistent with the "no admin interface yet" stance.

This is both a compliance obligation and the product's core trust wedge,
so it should not be treated as paperwork.

---

# P2: housekeeping

- **Name the email/SMS provider.** Privacy Policy Section 4 lists it as
  "an email and SMS delivery provider" not yet chosen. Once selected (a
  Resend connector is available in this workspace), name it there as a
  subprocessor and wire it into `VerificationDeliveryJob`, which is the
  designated seam.
- **Stale comment** in `config/routes.rb` says customer discovery is
  "Authenticated". `ShopsController` calls `skip_before_action
  :authenticate!`, so it is public, which is the intended design. Fix the
  comment.
- **ADR 0009 is stale** on payment delivery. It describes the QR
  auto-posting as the first chat message; the implementation reads it
  live into a pinned panel (`OrderSerializer`, and the revised comment in
  `Carts::Checkout` says so). Update the ADR, or add a superseding note,
  so the ADR set stays authoritative per `CLAUDE.md`.
- **`CLAUDE.md` milestone table is stale**: it lists M3 and M4 as not
  started and says "no cart" this phase, but ADR 0008 reintroduced carts
  and both milestones are largely built. Worth a pass.

---

# Definition of done for P0

- A user cannot be created, through any client or a direct API call,
  without an explicit recorded acceptance of a specific document version.
- Marketing opt-ins exist, default to false, and are captured separately
  from acceptance.
- Both documents are reachable in both web clients without signing in.
- Production-mode logs contain no verification codes, no chat message
  bodies, and no bearer tokens.
- Closing an account works, leaves the counterparty's transaction record
  intact, and is covered by specs.
- Full API suite green, both frontend suites green, both clients build.
- `docs/legal/README.md` findings list updated to reflect what is now
  fixed.

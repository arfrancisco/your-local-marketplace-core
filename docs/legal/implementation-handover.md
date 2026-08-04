# Legal compliance: audit findings and implementation brief

**Written:** 2026-08-04
**Audited against:** `main` @ `07d8342` (vendor-web Inventory redesign)
**For:** an engineer or agent picking this up cold
**Prerequisite reading:** `CLAUDE.md`, then the two documents in this folder.

## Why this exists

`docs/legal/terms-and-conditions.md` and `docs/legal/privacy-policy.md`
were drafted on 2026-08-01 against the schema and ADRs **as they existed
then**, and are wired into customer-web as in-app pages and modals.

The app has moved a long way since. Ratings shipped, an admin panel
shipped, real email/SMS providers were wired in, vendors gained private
notes about customers, error and feedback capture landed, registration
gained required fields, and image limits changed. **Both documents now
describe an app that no longer exists in several material places.**

This is the "legal docs content review" item that sits at the top of the
Notion "Still to build" list as a pre-launch gate. This brief is the
findings from that review plus the work needed to close them.

Two things are true at once and both matter:

1. Several statements in the documents are now **factually wrong** about
   what the app does. That is worse than an omission, because users are
   agreeing to it and it is published.
2. Several kinds of personal data are collected with **no disclosure at
   all**, including some a data subject cannot see and would not expect.

Nothing here is legal advice, and neither document has been reviewed by a
lawyer. That review is still needed before launch.

## Start here: two fixes that need no decisions

Do these before anything else in this brief. Both are live in production
right now, both are a few lines, and neither depends on any of the
decisions in Part F.

**1. Verification codes are being written to production logs in
plaintext** (`app/jobs/verification_delivery_job.rb`). Resend and
Semaphore are actually sending now, so every OTP and its destination
address is landing in the log. Guard the `Rails.logger.info` line to
development only, or delete it. Full detail in **C-1**.

**2. Private chat messages and verification codes are passing through
unfiltered request params**
(`config/initializers/filter_parameter_logging.rb`). `code` and `body`
are not in the filter list, so verification codes and the full text of
users' private messages are written to the Rails log on every request.
Add both. Full detail in **C-2**.

Neither is theoretical and neither needs sign-off. Everything else in
this brief can wait behind them.

---

# Part A: Statements that are now wrong

Fix each in both the repo copy and the customer-web copy (see D-1 on the
duplication problem). Bump the version stamp when done (see D-2).

| # | Document says | Reality in code |
|---|---|---|
| A-1 | Operator is "Alain Roy Francisco, doing business as KapitMarket PH", at unit 3017 | Owner asked (2026-08-04) to use **KapitMarket PH only**, no personal name, and to drop the unit number to building level. See A-1 note below. |
| A-2 | "A mobile number is optional" | **Required.** `Auth::RegisterUser#validate_required_fields!` rejects a blank `mobile_number`. |
| A-3 | Ratings: "If ratings are enabled on your account" | **Ratings are fully built.** `ratings` table, `Ratings::Create`, 1 to 5 score plus comment, one per order per reviewer per reviewee, polymorphic `reviewee`, shown publicly on shop pages in both clients. |
| A-4 | Cancellation policy is "still being finalized" with a bracketed TODO | Decided in code. `Order::TRANSITIONS` plus `OrdersController#transition` allow a customer to `cancelled` only, and only from `placed` or `accepted`. Vendors may reject from `placed`, cancel from `placed`/`accepted`. **A cancellation reason is now required** (`order_status_events.reason_code`). |
| A-5 | Silent on order edits; ADR 0005 says deferred | `Orders::EditItems` exists and lets a **vendor edit items on an in-progress order**. Both the Terms and ADR 0005 need reconciling with this. |
| A-6 | Image limits: 6 per item, 3 per shop | Now **3 per item**, **1 shop profile photo**, **1 shop cover photo**, 5 opening-message photos, 1 per chat message. See `has_images` in `app/models/{item,shop,message}.rb`. |
| A-7 | "An email/SMS delivery provider we haven't selected yet" | **Chosen and live.** Email via **Resend** (`https://api.resend.com/emails`), SMS via **Semaphore** (`https://api.semaphore.co/api/v4/otp`). Both are named subprocessors and both process data outside the Philippines. |
| A-8 | Delivery address is "building, unit" | `addresses` now also has **`city`** and **`street_address`**. |
| A-9 | Account identifiers are email, mobile, display name | `users` now also stores **`first_name`** and **`last_name`**. |
| A-10 | "Prices... never changed retroactively" as the whole order story | Still true for `order_items` snapshots, but A-5's vendor edit path changes an in-progress order. Describe both. |

**A-1 note on naming.** Using "KapitMarket PH" alone is what the owner
wants, and it is fine as an interim position, but be aware: an
unregistered trade name is not a legal entity, so it provides no
liability separation, and RA 11967 expects marketplace operators to be
identifiable and registered. The durable fix is DTI business name
registration. Do not present the trade name as if it were a registered
company.

---

# Part B: Personal data collected with no disclosure

Each of these is real personal data being processed today with nothing in
the Privacy Policy about it. Under RA 10173 the data subject has to be
told. Add each to Section 1 (what we collect), Section 2 (why, and on
what basis), and where relevant Section 3 (who sees it).

**B-1. Vendor notes about customers.** `vendor_customer_notes` lets a
vendor write a private note about a customer ("no-showed for pickup") and
set a **`flagged`** boolean. The model comment is explicit that it is
never shown to the customer and never visible to another vendor.

This is the most sensitive gap in the list. A person is being profiled by
a counterparty, in a record they cannot see, that can influence how they
are treated. It is not disclosed anywhere.

**Decided (F-1): keep the feature, disclose it, and include the notes in
DPA access requests.** So the Privacy Policy must say vendors may keep
private notes about customers they have dealt with, and that a customer
can obtain those notes through an access request. The Terms must tell
vendors the same thing, so a vendor writing a note knows it is not
permanently private. Still worth raising with the lawyer, but the
position is settled.

**B-2. Operator access to private chat.** The `Api::V1::Admin` namespace
includes `conversations_controller`, `addresses_controller`,
`carts_controller`, `api_tokens_controller`,
`verification_challenges_controller`, and more. Authorization is a
**single shared HTTP Basic credential** (`ADMIN_USERNAME`/
`ADMIN_PASSWORD`), no per-admin accounts, no audit trail.

Both documents currently imply chat is visible only to the two order
participants. That is not true: the operator can read all of it.

**Decided (F-2): keep the access, disclose it plainly scoped to support,
fraud investigation and dispute mediation, and add an audit log.** The
policy wording will say access is logged, so build the log (see Part F)
rather than writing the claim first.

**B-3. Feedback submissions.** `feedback_submissions` stores free-text
`message`, `email`, `page_url`, and `user_id`, and
`FeedbackNotificationJob` emails them onward. Not disclosed.

**B-4. Error logs.** `error_logs` stores `backtrace`, `message`,
`request_path`, `request_method`, and **`user_id`**, and `ErrorAlertJob`
emails alerts. This ties a real person to their activity. Not disclosed.

**B-5. Password reset.** `Auth::RequestPasswordReset` and
`Auth::ResetPassword` exist. The reset flow and its token handling are
not described anywhere in the Privacy Policy.

**B-6. Social preview crawlers.** `SocialPreviews::DetectCrawler` and
`InjectMetaTags` serve shop name, description, and imagery to
**Facebook and Instagram** crawlers when a shop link is shared. That is a
disclosure of shop content to Meta. Small, but it is third-party sharing
and the policy currently says there is none.

**B-7. IP addresses.** `Rack::Attack` throttles by IP across auth,
verification, early access, and discovery. IP is personal data and is not
listed.

**B-8. Guest carts.** Anonymous visitors build a cart in browser local
storage before any account exists. The local-storage paragraph currently
only mentions the auth token.

**B-9. Image metadata.** Nothing strips EXIF from uploads, so a phone
photo can carry GPS coordinates into a product that deliberately has no
geo (ADR 0002). Either disclose it or strip it. Stripping is better.

---

# Part C: Code and security fixes

**C-1. Verification codes are logged in plaintext. Fix first.**
`VerificationDeliveryJob#perform` unconditionally runs:

```ruby
Rails.logger.info("[VerificationDelivery] channel=... to=... code=#{code} ...")
```

This was tolerable when it was the only delivery mechanism. Now that
Resend and Semaphore actually send, it is a pure liability: a live OTP
and its destination address sit in production logs. Guard it to
development only, or delete it.

**C-2. `filter_parameters` misses `:code` and `:body`.**
`config/initializers/filter_parameter_logging.rb` filters `:passw,
:secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn`. The
verification confirm endpoint uses **`code`**, and
`POST /orders/:id/messages` uses **`body`**. So verification codes and
the full text of private chat messages are written to the Rails log. Add
both, and consider `:mobile_number`, `:sent_to`, `:message`, `:note`.

**C-3. Bearer token in the WebSocket query string.**
`ApplicationCable::Connection` reads `request.params[:token]`, so a live
30-day token appears in `wss://.../cable?token=...` and lands in access
and proxy logs. Preferred fix: a short-lived single-use cable ticket
exchanged on connect. If deferring, do not let the Privacy Policy claim
tokens are kept out of logs.

**C-4. Admin credentials default to `admin`/`admin`.**
`Api::V1::Admin::BaseController` does `ENV.fetch("ADMIN_USERNAME",
"admin")` and the same for the password. If either env var is ever unset
in production, the entire admin surface, including everyone's private
chat, is behind `admin`/`admin`. Make production fail loudly rather than
fall back. Consider an access log for admin reads of chat and addresses,
which also makes B-2's disclosure honest.

**C-5. There is still no account closure path, and the obvious one is
destructive.** No `CloseAccount` service, no endpoint, no rake task, yet
both documents let users request deletion.

`User has_one :customer_profile, dependent: :destroy` chains through
`CustomerProfile has_many :orders, dependent: :destroy` to `order_items`,
`order_status_events`, and the conversation. **Destroying a customer
would destroy the vendor's record of those sales**, and vice versa
through `vendor_profile → shops → orders`. In practice it would likely
raise a foreign key violation first, on `messages.sender_user_id`,
`order_status_events.actor_user_id`, or `ratings.reviewer_user_id`, none
of which have a `dependent:` rule.

Build `Users::CloseAccount` as an anonymize-in-place service. It must
never call `user.destroy`:

- Add `"closed"` to `User::STATUSES`, set it, destroy all `api_tokens`.
- Replace `email` with a unique non-routable placeholder (the column is
  `null: false` and uniquely indexed), null `mobile_number`, both
  verified stamps, `first_name`, `last_name`; reset `password_digest` to
  random.
- Delete `addresses`, `carts` and `cart_items`, `verification_challenges`,
  and (per F-5) every `vendor_customer_notes` row about this customer.
- Neutralize `customer_profile.display_name` and
  `vendor_profile.display_name`.
- For vendors, set shops to `status: "suspended"`, `accepting_orders:
  false`. Do not destroy shops or items, since `order_items.item_id`
  references them.
- **Keep** `orders`, `order_items`, `order_status_events`,
  `conversations`, `messages`, `ratings`.
- Reject `"closed"` in `Auth::AuthenticateUser` the way `"suspended"`
  already is.

Specs must assert that closing a customer leaves the vendor's orders,
status events, chat, and ratings intact and readable, and that no foreign
key violation is raised. Then make Privacy Policy Section on deletion
match exactly what this does.

---

# Part D: Consistency and process

**D-1. The legal text exists in two places with no sync mechanism.**
`docs/legal/*.md` and `apps/customer-web/src/legal/*.md` are byte
identical today and there is no script keeping them that way. They will
drift. Add a prebuild copy step in `apps/customer-web/package.json`, or a
CI check that fails when they differ. Do not hand-edit one and forget the
other.

**D-2. The accepted-version stamp is hardcoded and will go stale.**
`Auth::RegisterUser::CURRENT_TERMS_VERSION = "2026-08-01"`. Any edit to
either document must bump this and the "Last updated" line together,
otherwise the acceptance record points at a version nobody agreed to.
Consider deriving it from the documents rather than a hand-maintained
constant, and decide what happens to existing users when it changes
(re-acceptance prompt, or nothing).

**D-3. vendor-web has no legal pages.** customer-web has `TermsPage`,
`PrivacyPage`, `LegalDoc`, and `LegalModal`. vendor-web has none.
Vendors currently reach the documents only through customer-web. Since
vendors carry more obligations under the Terms than customers do, add the
routes there too.

**D-4. ADR 0005 is stale.** It says order edits are deferred;
`Orders::EditItems` exists. `CLAUDE.md` repeats the stale claim. Either
supersede the ADR or narrow its wording to match what was actually built.

---

# Part E: Content the documents still lack

These were identified in the 2026-08-04 review and are missing from the
current versions. A previous revision drafting all of them exists on the
branch `backup/legal-revision-20260804` (see `docs/legal/*.md` there);
its **structure and clause text are reusable**, but its factual claims
were written against the 2026-07-31 code and must be re-checked against
Part A before any of it is copied over.

- **RA 11967, the Internet Transactions Act of 2023**, fully in force
  since 20 June 2025, regulates online marketplaces directly: collect and
  hold merchant identifying information before listing, maintain a
  merchant list, act on takedown orders. Subsidiary liability for failing
  to exercise ordinary diligence, DTI fines up to ₱1,000,000. Nothing in
  the Terms reflects this. It maps onto the dormant
  `vendor_profiles.verification_status`, so it is the same work as the
  trust and safety milestone, not extra paperwork.
- **Lawful basis per processing purpose**, which RA 10173 requires.
- **Breach notification**: NPC and affected users within 72 hours, per
  the DPA IRR.
- **Cookies and local storage** as its own section.
- **Consumer rights savings clause** so the liability cap does not
  purport to waive non-waivable rights under RA 7394.
- **Platform IP ownership**, a **reporting and takedown route**,
  **electronic communications consent**, and the standard
  **severability / no waiver / assignment / entire agreement / force
  majeure** set. All currently absent.
- **Age**: the Terms require 18+, but no date of birth is collected.
  Phrase it as a representation, not a verified fact.
- **Em-dashes**: `CLAUDE.md` forbids them in prose. Both current legal
  documents are full of them.

---

# Part F: Decisions made (owner, 2026-08-04)

These were open questions. They are now answered. Implement to these,
and do not reopen them without the owner.

| # | Question | Decision |
|---|---|---|
| F-1 | Vendor notes about customers | **Keep the feature, disclose it, and include the notes in DPA access requests.** |
| F-2 | Operator access to private chat | **Keep the access, disclose it, and add an audit log.** |
| F-3 | Vendor identity collection | **Collect at vendor signup, publish the shop immediately, verify afterwards.** |
| F-4 | Re-consent on a version bump | **Prompt on next sign-in and block until the new version is accepted.** |
| F-5 | Vendor notes when a customer closes their account | **Delete them along with the rest of that customer's personal data.** |
| F-6a | Food permits and safety wording | **Keep the general wording**: the vendor represents they hold whatever the law requires, and must show proof on request. Do not name specific clearances. |
| F-6b | Contact addresses | **Set up role addresses on `kapitmarket.ph`** (`support@`, `privacy@`) forwarding to the owner's inbox. Replace the personal Gmail in both documents. |

Still genuinely open, and not blocking: the real **effective date** (set
it when the beta opens) and **when DTI registration actually happens**
(see A-1; it is what makes the trade-name usage durable rather than
interim).

## Work these decisions create

Beyond the disclosure edits already covered in Part B, the decisions add
the following build items:

**F-2 → admin access audit log.** Record every admin read of a
conversation, address, cart, or API token: what was accessed, which
record, and when. A dedicated table is fine; it does not need a UI yet.
The Privacy Policy will say operator access is logged, so the log has to
actually exist. Fix C-4's `admin`/`admin` fallback in the same pass.

**F-3 → vendor identity capture.** Add fields to record what was
collected at vendor signup (legal name, contact number, ID or business
registration reference) plus who checked it and when. Collection is
mandatory before a shop can be created; publishing is not gated on
review. `verification_status` moves manually afterwards. This satisfies
RA 11967's "collect before listing" without making the owner a
bottleneck, and it resolves `docs/open-decisions.md` #5.

**F-4 → re-consent flow.** When `terms_version` on a user is older than
`CURRENT_TERMS_VERSION`, the clients must show what changed and require
acceptance before the user can continue. Needs: the comparison exposed
on the `/me` payload, a blocking prompt in customer-web (and vendor-web
once D-3 lands), and an endpoint to record the new acceptance. Pair this
with D-2 so bumping the constant is a deliberate, complete action.

**F-1 and F-5 → access request and closure behavior.** `Users::CloseAccount`
(C-5) must delete that customer's `vendor_customer_notes` along with
addresses and carts. Separately, whatever process answers a DPA access
request has to include notes written about that customer. Vendors should
be told, in the Terms, that notes they write about a customer may be
disclosed to that customer on a lawful request.

**F-6b → role addresses.** Create `support@kapitmarket.ph` and
`privacy@kapitmarket.ph`, then replace every `armfrancisco@gmail.com`
occurrence in both documents and in this brief.

# Scope boundaries

Do not build, and do not write into the documents as if they existed: a
payment gateway (ADR 0009 makes this permanent), any geo or distance
feature (ADR 0002), analytics or advertising trackers (deliberately
declined on 2026-08-04; the reasoning is in the Notion build log).

Do not soften a document to match a shortcut. If the code cannot do what
the text promises, change the code or escalate. The text is the promise
users agree to.

# Test commands

```bash
cd apps/api && bin/rails db:test:prepare && bundle exec rspec
cd apps/customer-web && npm run test && npm run build
cd apps/vendor-web   && npm run test && npm run build
```

# Suggested order

1. **C-1, C-2** first. They are small, and every day they stay unfixed
   more live OTPs and private messages go into logs.
2. **Part A** corrections, since the published text is currently wrong.
3. **F-6b** role addresses, so the contact details only get rewritten
   once rather than twice.
4. **C-4 plus the F-2 audit log** together, then the B-2 disclosure.
   Build the log before the policy claims it exists.
5. **Part B** remaining disclosures, B-1 first.
6. **C-5** account closure including the F-5 note deletion, then align
   the deletion section to what it actually does.
7. **D-1, D-2 with the F-4 re-consent flow, D-3, D-4**, then **C-3**.
8. **F-3** vendor identity capture, which also closes
   `docs/open-decisions.md` #5.
9. **Part E** content additions, then the lawyer review.

# Definition of done

- No statement in either document contradicts the code. Walk Part A row
  by row.
- Every category of personal data in `db/schema.rb` appears in Privacy
  Policy Section 1, or is deliberately excluded with a reason.
- Production logs contain no verification codes, no chat bodies, no
  bearer tokens.
- Account closure works, is spec'd, and leaves counterparty records
  intact.
- The two copies of each document cannot silently drift.
- `CURRENT_TERMS_VERSION`, both "Last updated" lines, and the actual
  content all agree, and a user on an older version is prompted to
  re-accept before continuing.
- Admin reads of chat, addresses, carts and tokens are logged, and no
  environment falls back to `admin`/`admin`.
- A vendor cannot create a shop without identity details on file.
- No `armfrancisco@gmail.com` remains in either document or this brief.
- Full API suite green, both frontend suites green, both clients build.

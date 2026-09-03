# Daily lesson + quiz log

Progress tracker for the curriculum in `docs/curriculum/`.

**Schedule:** weekdays, 9:00 AM Philippine time (01:00 UTC, Mon-Fri).
**Cadence:** learn first, then get quizzed on it.

- **Day 1** — Lesson 1 is delivered. No quiz (nothing learned yet).
- **Day N** — 6-question quiz on **lesson N-1**, then lesson N is delivered.
- **After lesson 11** — mixed review, 6 questions per day drawn across all
  lessons, weighted toward whatever is `shaky` below.

Questions come mostly from the lesson text, with the occasional "open this
file and tell me what it does" question against the live code, so the
material stays honest as the codebase changes.

Nothing here needs hand-editing, but feel free.

## Mastery

`-` = not yet quizzed. Confidence: `solid` (5-6 correct), `ok` (3-4),
`shaky` (0-2).

| # | Lesson | Taught | Quizzed | Score | Confidence |
|---|---|---|---|---|---|
| 1 | Product and its three refusals | 2026-08-06 | 2026-08-07 | 6/6 | solid |
| 2 | Shape and shipping | 2026-08-07 | 2026-08-10 | 4/6 | ok |
| 3 | Identity and authentication | 2026-08-10 | 2026-08-13 | 4/6 | ok |
| 4 | Authorization | 2026-08-13 | pending | pending | pending |
| 5 | Data model and the snapshot rule | 2026-08-14 | pending | pending | pending |
| 6 | Discovery | 2026-08-17 | pending | pending | pending |
| 7 | Cart and checkout | 2026-08-18 | - | - | - |
| 8 | Order lifecycle | 2026-08-19 | - | - | - |
| 9 | Chat, payment, ratings | 2026-08-20 | - | - | - |
| 10 | Operations surface | 2026-08-21 | - | - | - |
| 11 | Pre-beta review | 2026-08-24 | - | - | - |

## Session log

Newest first.

### 2026-09-03 — No quiz (blocked, unchanged) · Deep dive: making the last two Railway-only checklist items self-checkable

Fifteenth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match, and a
broader "ask user interactive question choice blocking" keyword search again
turned up only unrelated task/Notion/GitHub tools). Per this log's own
standing instruction, did not write a sixteenth unanswerable question set and
did not repost the 2026-08-18 six — nothing about the blocker has changed
since it was last surfaced, so another notification would be noise. That
combined review is still the one to grade whenever Alain is live in this
routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24). The last three
checklist items had been filed (through 09-02) as needing Alain present or
live Railway access, with no code angle — but two prior sessions (09-01,
09-02) each found that framing didn't survive actually reading the code for
similar items. Checked whether the same was true here, for **"confirm which
env vars are actually set on Railway"** and **"confirm the deployed commit
matches `main`."**

- Read `Api::V1::HealthController` (`app/controllers/api/v1/health_controller.rb`):
  the only existing health/status endpoint, public (`config/routes.rb:15`,
  no admin gating), and it only proves the DB is reachable — it says nothing
  about which env vars are set or what commit is running. Confirmed via
  `ls app/controllers/api/v1/admin/` that no admin controller does either;
  this echoes 08-27's finding that the app has no way to confirm its own
  Resend config short of a Railway-side check, just generalized to the full
  flag list from lesson 11 Part B.
- **Env vars**: nothing stops a small admin-only endpoint from reporting
  *presence* (booleans, never values) of `RACK_ATTACK_ENABLED`,
  `SIDEKIQ_WEB_USERNAME`/`PASSWORD`, and the Resend trio
  (`RESEND_API_KEY`/`EMAIL_FROM_ADDRESS`/`FEEDBACK_NOTIFICATION_EMAIL`) —
  confirmed the exact `ENV[...]` call sites via grep across
  `error_alert_job.rb`, `feedback_notification_job.rb`,
  `verification_delivery_job.rb`, `vendors/eligibility_check.rb`, and
  `routes.rb`. `SKIP_VERIFICATION` is readable the same way
  (`vendors/eligibility_check.rb`). `ADMIN_ENABLED` is the one flag this
  approach can't usefully report on itself — if it's false the whole
  `/admin` namespace 404s (`routes.rb`:130), so reaching this endpoint at
  all already proves it's true; worth noting as a small irony rather than a
  gap. `VITE_SKIP_VERIFICATION` is frontend-build-time only and genuinely
  invisible to any API endpoint — that one stays a real Railway-side/build
  check, no way around it.
- **Deployed commit**: checked whether the git SHA could be baked into the
  image at all, since the API currently has zero mechanism for this. Read
  the root of the repo — there is no root-level `.dockerignore`, only
  `apps/api/.dockerignore` (which excludes `/.git/` but only applies if the
  build context root were `apps/api`). The `Dockerfile`'s own header comment
  confirms the real build context is the **repo root** (`--path-as-root .`),
  and Docker resolves `.dockerignore` against the context root, not the
  Dockerfile's directory — so `apps/api/.dockerignore`'s git exclusion
  doesn't apply to this build at all, and `.git/` is actually present in the
  build context today. That means a one-line `RUN git rev-parse HEAD >
  REVISION` in the `build` stage of `apps/api/Dockerfile` (copied forward
  into the final stage) is enough to stamp every deployed image with the
  exact commit it was built from — no new plumbing, no build-arg wiring
  through `railway up`.
- Net finding, same shape as 09-01/09-02: **two of the three remaining
  "needs Alain" items are actually a small, code-only fix away from being
  self-checkable through the app itself**, closing the gap that made a
  Railway CLI/dashboard visit necessary in the first place. Only the third
  (legal-drafts lawyer review) has no code angle at all — that one is
  correctly filed as pure people-and-time, not investigation debt.
- Drafted (not implemented — Part 3 of this routine only pushes this log,
  and this is root-level/API-level code that belongs on `main`, not this
  curriculum branch, same restriction 08-31 noted for the docs fixes) one
  combined design: a new `Api::V1::Admin::SystemStatusController#show`
  (admin-gated like every other `Admin::BaseController` subclass, a plain
  `GET` so it's outside `MUTATING_METHODS` and won't spam the audit log on
  every check) returning `{ commit: ENV["RAILWAY_GIT_COMMIT_SHA"] ||
  File.read("REVISION").strip, env: { rack_attack_enabled: ...,
  resend_configured: ENV["RESEND_API_KEY"].present?, ... } }` — booleans and
  the SHA only, never a raw secret value, on the same reasoning
  `error_alert_job.rb`'s guards already apply. Pairs with the one-line
  Dockerfile `REVISION` stamp above. Small enough for a single
  `ship-a-quick-fix` pass (one controller, one route, one Dockerfile line,
  a couple of request specs) once Alain wants it — his call, not applied
  here.

### 2026-09-02 — No quiz (blocked, unchanged) · Deep dive: the disputed-payment process (checklist item)

Fourteenth consecutive automated session with no live user and no
interactive question tool (`select:AskUserQuestion` came back with no
match, and a broader "ask user interactive question choice blocking"
keyword search turned up only unrelated task/Notion/GitHub tools). Per this
log's own standing instruction, did not write a fifteenth unanswerable
question set and did not repost the 2026-08-18 six — nothing about the
blocker has changed since it was last surfaced, so another notification
would be noise. That combined review is still the one to grade whenever
Alain is live in this routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal
lesson delivery and went deeper on the next unaddressed pre-beta checklist
item: **"write down the human process for a disputed payment."** This one
had been filed since lesson 11 (and reconfirmed 08-31/09-01) as a pure
business-process call with no code angle — but like open decision #7
turned out to be on 09-01, that framing didn't survive actually reading the
admin surface end to end.

- Read `Order::PAYMENT_STATUSES` (`app/models/order.rb`): exactly two
  values, `unpaid` and `marked_paid`. No `disputed`, no `refunded`, nothing
  else.
- Read `Orders::MarkPaid` (`app/services/orders/mark_paid.rb`): one-way and
  idempotent by design (`update! if payment_status == "unpaid"` — its own
  comment says so). There is no service, method, or route anywhere that
  moves an order back from `marked_paid` to `unpaid`. Confirmed via
  `grep` across `app/controllers` and `config/routes.rb` — the only route
  touching it is the vendor's own `POST /orders/:id/mark_paid`
  (`Api::V1::OrdersController#mark_paid`). A vendor who mis-taps the button,
  or a customer who disputes having paid, has no path back — not even an
  admin one.
- Read `Api::V1::Admin::OrdersController#transition`: admin *can* override
  order **status** (attributed to the shop's vendor user, `"[admin
  override]"` reason prefix, still gated by the real state machine) — but
  this endpoint only calls `Orders::TransitionStatus`, which never touches
  `payment_status`. The existing admin override mechanism simply doesn't
  reach the field a payment dispute is actually about.
- Read `Api::V1::Admin::ConversationsController` and
  `Api::V1::Admin::VendorCustomerNotesController` — both explicitly
  comment-labeled for dispute use (`"a full transcript for dispute
  resolution/support"`, `"exactly the evidence an operator needs when
  investigating a dispute"`). So the **evidence-gathering** half of dispute
  handling is real and was deliberately built: admin can pull the full chat
  transcript for an order and cross-vendor customer notes. The
  **resolution** half — actually correcting the disputed field once the
  evidence is read — does not exist anywhere in the codebase.
- Confirmed `Admin::BaseController`'s `around_action :record_audit_log`
  (lesson 10) would cover any new admin action here automatically, the same
  way it already covers the order-status override — so closing this gap is
  not a new-mechanism problem, it's reusing a pattern that already exists
  twice (order status override, audit logging) and hasn't been extended to
  payment status.
- Net finding, sharper than the checklist line: this isn't only "decide the
  human process," it's **"the admin tool an operator would reach for
  mid-dispute (read the chat, read cross-vendor notes, then fix the
  record) is two-thirds built and stops one field short."** Writing down a
  process that ends in "and then the admin corrects payment_status" is
  currently writing down a process the app cannot perform.
- Drafted (not implemented — Part 3 of this routine only pushes this log,
  and this is Alain's call same as every prior deep dive) two options, not
  mutually exclusive:
  - **(a) Let admin reset `payment_status` back to `unpaid`.** One new
    route (`POST /admin/orders/:id/payment_status`, or fold it into the
    existing `orders#transition` action as a sibling), one new tiny service
    mirroring `Orders::MarkPaid`'s shape but admin-attributed, covered for
    free by the existing audit `around_action`. Minimal and reversible —
    doesn't add a new status, just un-does the vendor's assertion when an
    operator determines it was wrong.
  - **(b) Add a third status, `disputed`.** Bigger decision: needs to say
    whether `disputed` blocks anything (a new order action? a hold on
    `completed`?) or is purely a marker for ops to track pattern/frequency
    across vendors. This is the one worth deciding deliberately rather than
    defaulting into, since unlike (a) it changes the state machine's shape,
    not just who can call an existing move.
  - Recommend (a) as the minimum viable fix regardless of (b) — it closes
    the "admin literally cannot act on what they just read" gap with the
    smallest possible change, reusing the exact override-attribution and
    audit pattern the order-status endpoint already established. (b) is
    the actual policy question worth Alain's time, sized like the
    cancellation-policy (08-26) and notification-channel (09-01) decisions
    before it.

### 2026-09-01 — No quiz (blocked, unchanged) · Deep dive: notification channels (checklist item, open decision #7)

Thirteenth consecutive automated session with no live user and no
interactive question tool (`select:AskUserQuestion` came back with no
match, and a broader "ask user interactive question choice" keyword search
turned up other tools but nothing that blocks a turn for an answer). Per
this log's own standing instruction, did not write a fourteenth
unanswerable question set and did not repost the 2026-08-18 six — nothing
about the blocker has changed since it was last surfaced, so another
notification would be noise. That combined review is still the one to
grade whenever Alain is live in this routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal
lesson delivery and went deeper on the next unaddressed pre-beta checklist
item: **"decide how vendors learn a new order arrived" (open decision
#7)**. The 2026-08-31 session had filed this under "needs Alain present,"
alongside the disputed-payment process and the Railway/legal items — but
unlike those, this one turned out to have a concrete code angle, the same
shape as the 08-26 cancellation-policy deep dive: investigate what the
system actually does today, then draft options rather than just restate
lesson 11's summary of the gap.

- Read `Carts::Checkout#call` (`app/services/carts/checkout.rb`) in full:
  checkout's transaction creates the order, the order items, the status
  event, and an **empty** `Conversation` — no message of any kind is
  posted. No job is enqueued afterward either.
- Read `Messaging::UnreadOrders` (`app/services/messaging/unread_orders.rb`):
  "unread" is defined entirely in terms of `Message` rows — it takes the
  max message id from the *other* party per conversation and compares it to
  the viewer's `ConversationRead` cursor. A conversation with zero messages
  contributes nothing to either query, so it can never appear unread.
- Read `Vendor::OrdersController#index`: it computes `unread` via that same
  service and has no other new-order signal — no separate "new" flag, no
  count of orders in `placed` status, nothing.
- Put those three together and the finding is sharper than lesson 11's own
  framing ("the only channel is in-app chat plus the unread badge"): **the
  badge does not fire for a brand-new order at all.** Checkout posts zero
  messages, so a freshly placed order shows no unread indicator until
  *someone* sends a chat message — usually the vendor, when they notice the
  order some other way, which defeats the point. Today a vendor's only way
  to learn of a new order is to open the app and look at the order list,
  unprompted, with nothing telling them to look. This is worse than "no
  push, only in-app" — it's "no push, and even the in-app signal is silent
  for the specific event that matters most."
- Checked how the existing email pipeline works, since email is the
  cheapest lever already in the system: `FeedbackNotificationJob` and
  `ErrorAlertJob` are near-identical ~40-line jobs, both gated on
  `Rails.env.production?` and on the same three blank-config early-returns
  (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, plus their own destination var),
  both best-effort (`rescue StandardError`, log and move on, never raise
  into the caller). Confirmed via `db/schema.rb` that `vendor_profiles`
  belongs to `users`, and `users.email` is always present (`null: false`) —
  a vendor's notification address already exists, no new field needed.
- Drafted (not implemented — Part 3 of this routine only pushes this log,
  and this is Alain's call to make, same restriction as every prior deep
  dive) two options, not mutually exclusive:
  - **(a) Fix the mechanism, not just the message.** Have `Carts::Checkout`
    post one `system` message into the new conversation right after
    creating it (e.g. "New order placed") — the exact same mechanism
    `Orders::TransitionStatus` already uses for status-change messages
    (lesson 8/9). This is the cheapest fix and arguably a bug fix rather
    than a policy call: it makes the in-app badge actually work for the
    event lesson 11 already assumes it covers. No new infrastructure, no
    new env vars, reuses code that exists.
  - **(b) Add an out-of-app nudge via email.** A new
    `OrderPlacedNotificationJob`, copy-shaped from `FeedbackNotificationJob`:
    enqueued at the end of `Carts::Checkout#call` (outside the
    transaction, same reasoning lesson 9 gives for why the chat broadcast
    happens after commit — a provider outage must not roll back a real
    order), emails the vendor's `user.email` with the shop name, item
    summary, and a link into vendor-web's order view. This is the actual
    policy decision: (a) alone still requires the vendor to have the app
    open or check it regularly; (b) reaches them even when it's closed,
    at the cost of one more Resend send per order (negligible at pilot
    volume, unlike the rate-limited SMS codes lesson 10 covered, which
    cost money per send — this doesn't need Semaphore at all).
  - Recommend (a) unconditionally regardless of what Alain decides on
    (b) — it costs nothing and closes a real gap in a mechanism the docs
    already claim exists. (b) is the one worth a deliberate yes/no, sized
    at roughly the same scope as `ship-a-quick-fix` once he's live to say
    go (one new job file, one job-header comment explaining the
    post-transaction placement, one call site, no schema change).

### 2026-08-31 — No quiz (blocked, unchanged) · Deep dive: fix the stale docs (checklist item, last one)

Twelfth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match again, and a
broader "ask user question interactive" keyword search returned nothing
usable either). Per this log's own standing instruction, did not write a
thirteenth unanswerable question set and did not repost the 2026-08-18 six —
nothing about the blocker has changed since it was last surfaced, so another
notification would be noise. That combined review is still the one to grade
whenever Alain is live in this routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal lesson
delivery and went deeper on the last unaddressed pre-beta checklist item:
**"fix or stamp the stale docs (Part A), at minimum `README.md` and the two
ADR mechanics notes."** Re-verified every drift claim in lesson 11 against
the actual files rather than trusting the lesson's own summary, then drafted
exact fixes:

- `README.md`:53-59 confirmed word-for-word stale — "Deliberately not built
  yet" still lists shopping cart, order edits, inventory counts, and admin
  interface, all four of which ship (ADR 0008's cart, vendor-only
  `EditItems`, `stock_count`, admin-web+admin-mcp), and line 50 still says
  orders are "placed directly against a single item rather than assembled in
  a cart." Draft fix: replace the M0-M4 table and the "not built yet" line
  with a pointer to CLAUDE.md's own milestone table (already current, per
  the scoreboard), rather than maintaining two competing scope tables.
- Found one drift the lesson itself doesn't list: README.md:27-35 ("One Ruby
  on Rails API backend serves two React web clients") and the directory tree
  right below it name only `apps/api`, `apps/customer-web`,
  `apps/vendor-web` — `apps/admin-web` exists (confirmed via `ls apps/`) and
  is absent from both the prose and the tree. Same drift pattern as the rest
  of the file, just not one the lesson happened to catch.
- `docs/adr/0003-order-lifecycle-and-direct-placement.md`:9 confirmed still
  reads `POST /orders` takes `shop_id`, `item_id`, `quantity` with no
  superseded-mechanics note anywhere in the file. Draft fix: a one-line
  callout under Decision — "Superseded: `POST /orders` does not exist;
  orders are created by `POST /cart/checkout` (ADR 0008). The state machine
  and per-transition rules below are still current."
- `docs/adr/0009-vendor-managed-payment-via-chat.md`:26-28 confirmed still
  says the payment message and QR "auto-post as the **first message** in
  that order's conversation" at checkout. Cross-checked
  `app/services/carts/checkout.rb` and `app/serializers/order_serializer.rb`
  — checkout creates an empty conversation, no system message; the payment
  panel is a live read gated on `ShopSerializer`, with a comment there
  literally reading "ADR 0009, revised." Draft fix: a one-line callout —
  "Superseded: no auto-posted first message. The payment panel is read live
  from the shop's payment fields (see `OrderSerializer`), tagged in code as
  'ADR 0009, revised.' This is the better design; only this ADR's text
  wasn't updated to match."
- `apps/api/config/routes.rb`:45 confirmed the comment still reads
  "Authenticated; lists only open shops" over the customer discovery route,
  while `ShopsController` calls `skip_before_action :authenticate!` — the
  route is public. Draft fix: one-word change, "Authenticated" →
  "Public/unauthenticated on purpose (guest browsing and the guest cart
  depend on this)."
- `apps/api/app/controllers/static_controller.rb`:5 confirmed the comment
  still says admin-web's login is "HTTP Basic against the Api::V1::Admin
  API." Read `docs/adr/0010-per-admin-accounts.md` — bearer sessions via
  `AdminApiToken` replaced Basic Auth entirely, per-admin, 30-day TTL,
  revocable per account. Draft fix: swap the clause to "admin-web's login is
  a bearer-token POST against the Api::V1::Admin API (ADR 0010), not this
  shell."
- `docs/erd.md` confirmed all four drifts from the lesson still present
  verbatim: line 156 still lists `carts`/`cart_items` under "not created
  yet"; line 84 still says item photos max 6 against
  `has_images :photos, max_count: 3` in `item.rb`; the shop-photos section
  still describes one generic multi-photo bucket instead of the actual
  `profile_photo`/`cover_photo`/`opening_message_photos` split; line 93
  still headers the orders section "cart-free direct placement." Per the
  lesson's own framing, did not draft a half-fix — the two real options
  remain (a) regenerate from `db/schema.rb`, or (b) stamp it historical like
  `docs/milestones.md`, and picking between them is a judgment call worth
  leaving to Alain rather than guessing.
- Did not apply any of the above — this routine's Part 3 only pushes
  `docs/quiz-log.md`, and these are root-level/API-level files that belong
  on `main`, not this curriculum branch. All six fixes above are small
  enough (four are one-line comment/callout edits, README is a short
  rewrite, `erd.md` is the one real decision) to be a single
  `ship-a-quick-fix` pass once Alain picks (a) or (b) for the ERD file.

This closes out the last item on lesson 11's pre-beta checklist that a
code-reading deep dive can actually do something with. What's left on the
checklist all needs Alain present or live infrastructure access this
session doesn't have: confirming which env vars are actually set on
Railway, confirming the deployed commit matches `main`, writing down the
human process for a disputed payment (a business decision, not a code
question), deciding how vendors learn a new order arrived (open decision
#7), and the legal-drafts lawyer review. None of those are one more session
of reading code away from being "designed" the way the last five checklist
items were (CI, cancellation policy, error alerting, AdminUser bootstrap,
now docs) — they're waiting on Alain or on people/services outside this
repo.

### 2026-08-28 — No quiz (blocked, unchanged) · Deep dive: bootstrap the first AdminUser (checklist item)

Eleventh consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match again, and a
broader "ask user question interactive" keyword search returned nothing
usable either). Per this log's own standing instruction, did not write a
twelfth unanswerable question set and did not repost the 2026-08-18 six —
nothing about the blocker has changed since it was last surfaced, so another
notification would be noise. That combined review is still the one to grade
whenever Alain is live in this routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal
lesson delivery and went deeper on the next unaddressed pre-beta checklist
item: **"bootstrap the first `AdminUser` (`admin_users:create`) and verify
admin-web login works in production."** Read the actual mechanics rather
than restating lesson 10/11's summary:

- Read `lib/tasks/admin_users.rake`: `admin_users:create` aborts if
  `AdminUser.exists?` — it only ever works once, and the task's own header
  comment says every subsequent admin account goes through the self-service
  Admin Users page (`Api::V1::Admin::AdminUsersController`) instead. So this
  is genuinely a one-shot bootstrap, not a repeatable ops command.
- Found a real ordering trap by reading `config/routes.rb`:130-151 next to
  the task. The entire `/api/v1/admin/*` namespace, **including
  `auth/login` itself**, is only drawn when
  `Rails.env.local? || ENV["ADMIN_ENABLED"] == "true"` — and that check
  runs once at Rails boot / route-drawing time, not per-request. So setting
  `ADMIN_ENABLED=true` on the Railway service does nothing for an
  already-running process; the API has to actually restart/redeploy before
  `/admin/auth/login` exists at all. Hit that endpoint before the restart
  and you get a 404, which reads exactly like "wrong URL" rather than
  "route was never drawn" — an easy misdiagnosis mid-launch.
- Checked `db/migrate/20260804010000_create_admin_users.rb`: `status`
  defaults to `"active"` at the DB level, so the bootstrapped account needs
  no separate activation step — confirmed against `AdminUser#active?` and
  `Auth::AuthenticateAdminUser#call`'s `status == "suspended"` check, which
  is the only thing that would block it.
- Read `Auth::AuthenticateAdminUser` and `AdminApiToken`: login mints a
  30-day bearer token (`AdminApiToken::TTL = 30.days`, distinct from the
  180-day default the separate `mint_token` rake task uses for admin-mcp),
  shown once as plaintext and stored server-side only as a SHA-256 digest —
  the same shape as the customer/vendor `ApiToken` from lesson 3.
- The sharpest find: read `Admin::BaseController#record_audit_log` and its
  comment. **The bootstrap login itself never appears in
  `admin_audit_logs`** — `SessionsController#create` skips
  `authenticate_admin!`, so `current_admin_user` is nil at the point the
  audit hook fires, and `write_audit_log` silently no-ops on a nil admin.
  So "check the audit log to confirm the login worked" is not a valid
  verification step for the login itself — the 201 response with the token
  is the only signal for that. The *next* authenticated action (e.g.
  loading the Admin Users list) does show up as the audit log's first row,
  since `current_admin_user` is set by then.
- Drafted (not run — no Railway credentials in this session, and this is a
  live-production action better done with Alain present) the concrete
  order: (1) confirm `ADMIN_ENABLED=true` on the Railway API service and
  redeploy if it was just set, since the route only gets drawn on boot; (2)
  `railway run --service api` the bootstrap task with `ADMIN_EMAIL`/
  `ADMIN_PASSWORD` passed only to that one command, not saved into
  Railway's persistent env vars, since the task's own guard means it can
  only ever run once and there's no reason for the bootstrap password to
  live in the service's stored config afterward; (3) log in through
  admin-web at `/admin` and confirm the 201 + token, not the audit log; (4)
  load the Admin Users page and confirm it lists exactly the one bootstrapped
  account and that this action is the audit log's first entry; (5) create a
  second, personally-named admin account through the self-service page as
  the actual day-to-day login, since the bootstrap credential's password
  passed through a shell/CI command and is worth retiring rather than
  reusing long-term.

### 2026-08-27 — No quiz (blocked, unchanged) · Deep dive: verify error alerting end-to-end (checklist item)

Tenth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match again). Per
this log's own standing instruction, did not write an eleventh unanswerable
question set and did not repost the 2026-08-18 six — nothing about the
blocker has changed since it was last surfaced, so another notification
would be noise, not new information. That combined review is still the one
to grade whenever Alain is live in this routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal
lesson delivery and went deeper on the next unaddressed pre-beta checklist
item: **"verify error alerting end to end — trigger a new fingerprint in
production and confirm the email lands."** Did concrete investigation
rather than restating lesson 10's summary of the mechanism:

- Re-read `ErrorAlertJob#perform` and `ErrorLog.record!`/`.fingerprint_for`
  to confirm the exact mechanics that make this checklist item non-trivial:
  the fingerprint is content-addressed (exception class + message + top
  backtrace line), so **the same test trigger only alerts once** — a second
  identical run just bumps `occurrences_count` on the existing row rather
  than re-sending the email. Any verification attempt has to either use a
  distinctly-named synthetic exception per attempt, or accept it's a
  one-shot test.
- Checked `spec/requests/api/v1/internal_errors_spec.rb`: the only existing
  coverage asserts `ErrorAlertJob` gets *enqueued* on a first occurrence and
  *not* re-enqueued on a repeat. **Nothing in the suite ever executes
  `ErrorAlertJob#perform` itself** — the `Rails.env.production?` guard, the
  three blank-config early-returns, and the actual Resend HTTP call are all
  untested. That's exactly why this checklist item has to be a manual
  production check: there is no automated safety net for this specific path.
- Checked `config/routes.rb`'s admin namespace: `error_logs#index/show/
  resolve/reopen` exist, but there is no route or action anywhere that lets
  the app itself confirm `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS`/
  `FEEDBACK_NOTIFICATION_EMAIL` are actually set, and no built-in "trigger a
  test error" endpoint. Config has to be confirmed against Railway directly
  (dashboard or CLI), not through the app; this session has neither Railway
  CLI nor credentials available, so no production request was made.
- Also confirmed the "which requests actually reach `ErrorLog.record!`"
  subtlety from `error_handling.rb`'s `rescue_from` ordering (lesson 10): a
  plain 404 or a validation failure never gets recorded at all, since those
  have their own specific handlers above the `StandardError` catch-all. A
  verification attempt has to genuinely raise an unrescued `StandardError`
  to exercise this path — hitting a wrong URL or a bad param proves nothing.
- Drafted (not executed — no Railway access in this session, and this is a
  live-production action better done with Alain present or run by him) the
  concrete five-step check: (1) confirm the three env vars via the Railway
  dashboard/CLI directly, not the app; (2) `rails runner` a one-off (via
  `railway run --service api`) calling `ErrorLog.record!` with a distinctly
  named synthetic exception class so the fingerprint is guaranteed new, then
  `ErrorAlertJob.perform_later(log.id)` — this exercises the identical code
  path a real 500 would without needing to actually break a real endpoint;
  (3) check the `FEEDBACK_NOTIFICATION_EMAIL` inbox for the email; (4)
  confirm the new row in `admin/error_logs` (or admin-mcp) and `resolve!` it
  afterward so it doesn't sit in the unresolved queue looking like a live
  bug; (5) if the email doesn't land, work down lesson 11's own answer-key
  order (fingerprint not new → not-production → blank config → Sidekiq not
  processing → never reached `ErrorLog.record!` at all).

### 2026-08-26 — No quiz (blocked, unchanged) · Deep dive: cancellation policy (checklist item, open decision #3)

Ninth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match again, a
broader "ask user question interactive" keyword search also found nothing
usable in this session's toolset). Per this log's own standing instruction,
did not write a tenth unanswerable question set and did not repost the
2026-08-18 six — nothing about the blocker has changed since it was last
surfaced, so a third notification would be noise, not new information. That
combined review is still the one to grade whenever Alain is live in this
routine.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session again skipped Part 2's normal
lesson delivery and went deeper on a pre-beta checklist item — this time
**"decide the cancellation policy" (open decision #3)**, the item lesson 11
itself calls "the sharpest one." Did the concrete design work rather than
restating the lesson's summary:

- Read all three files that cooperate to produce the current behavior:
  `Order::TRANSITIONS` (`app/models/order.rb`) — no `"cancelled"` edge out
  of `preparing` or either fulfillment state; `Orders::TransitionStatus#call`
  (`app/services/orders/transition_status.rb`) — the actual 422 comes from
  `can_transition_to?` here, purely state-based; and
  `OrdersController#transition` (`app/controllers/api/v1/orders_controller.rb`)
  — the actor-level gate that lets a customer request `cancelled` from *any*
  state, meaning it's the TRANSITIONS table, not the controller, that
  actually blocks a `preparing` cancel today. Confirmed the lesson's framing
  exactly: this is a side effect of the state machine, not a ratified policy.
- Cross-checked against `docs/open-decisions.md`'s own framing of decision
  #3 ("which order states allow customer self-cancel vs. require vendor
  agreement?") — the vendor-approved-cancel option the lesson named answers
  that question directly.
- Drafted (not implemented — Part 3 of this routine only pushes this log)
  a concrete, minimal design: add `"cancelled"` to
  `TRANSITIONS["preparing"]`; tighten the controller so customer-initiated
  cancel only works from `placed`/`accepted`, and once `preparing` the same
  transition becomes vendor-only (same shape as every other vendor-only
  move); add one new code to `Order::VENDOR_CANCELLATION_REASONS` (e.g.
  `customer_requested_after_prep_started`) so the existing
  `validate_cancellation_reason!` and `order_status_events.reason_code`
  audit trail cover it for free — no new mechanism needed. Explicitly
  scoped out a new pending/approval state or a time-window field as
  unnecessary complexity for a first beta; the human-approval step is
  meant to happen in chat, consistent with ADR 0009's existing
  humans-resolve-it-not-automation philosophy for money/disputes. Flagged
  it as small enough for `ship-a-quick-fix` (model change + controller
  guard + one string + two specs) once Alain ratifies the policy — left
  as his call to make, not implemented unilaterally.

### 2026-08-25 — No quiz (blocked, unchanged) · Deep dive: CI-for-frontends (checklist item 2)

Eighth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match again this
session). Per this log's own standing instruction, did not write a ninth
unanswerable question set and did not re-post the 2026-08-18 six either —
nothing about the blocker has changed since it was last surfaced, so
another repost would be noise, not new information. It stays the one to
grade whenever Alain is live in this routine. Not re-flagged via
notification, same reasoning as every session since 08-19.

Curriculum is fully taught (all 11 lessons, since 2026-08-24), so per the
routine's own instructions this session skipped Part 2's normal lesson
delivery and went deeper on one item from lesson 11's pre-beta checklist
instead of repeating the full-checklist walkthrough already done on 08-24.
Picked **"add frontend tests and e2e to CI"** — the item the lesson itself
flags as "probably the highest value-per-minute item on this list" — and
did the concrete design work rather than restating the lesson's summary of
it:

- Read the actual (and only) workflow file, `.github/workflows/api-ci.yml`.
  Confirmed the lesson's claim exactly: `pull_request.paths` is filtered to
  `apps/api/**` and the workflow file itself, so a PR touching only
  `apps/customer-web`, `apps/vendor-web`, or `apps/admin-web` triggers zero
  jobs — not a skipped job, no job at all.
- Read all three frontend `package.json` files. All three already have a
  `"test": "vitest run"` script and matching `@testing-library/*`
  devDependencies — the tooling is already in place, this is purely a CI
  wiring gap, not a missing-test-infra problem.
- Drafted (not committed — Part 3 of this routine only pushes this log)
  the shape of the fix: either (a) one new `frontend-ci.yml` workflow with
  a matrix over the three apps running `npm ci && npm run test`, triggered
  on `pull_request.paths: ["apps/customer-web/**", "apps/vendor-web/**",
  "apps/admin-web/**", ".github/workflows/frontend-ci.yml"]`, mirroring
  `api-ci.yml`'s structure, or (b) folding a frontend job into the existing
  workflow and widening its path filter to `apps/**`. (a) is cleaner given
  the three apps have independent dependency trees and independent
  failure domains — a customer-web test failure shouldn't block a
  vendor-web-only PR's CI from being legible pass/fail. Did not scope in
  the Playwright e2e suite for the same workflow — it needs the full local
  dev stack (Postgres, Redis, Rails API, both web servers) running
  simultaneously per `local-dev-setup`'s own description, which is a
  meaningfully bigger CI job (service containers plus multi-app boot
  sequencing) than three independent `vitest run` jobs. Recommend landing
  the Vitest matrix first as the fast win, and treating Playwright-in-CI
  as its own follow-up decision given the infra cost.
- Left as an open call for Alain: whether to implement (a) as an actual
  PR next session, since this is a small, well-scoped, low-risk workflow
  change that fits `ship-a-quick-fix` territory once he's live to say go.

### 2026-08-24 — No quiz (blocked, unchanged) · Taught: lesson 11 (curriculum complete)

Seventh consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` and a broader keyword search both
came back empty again this session). Per this log's own standing
instruction, did not write an eighth unanswerable question set — the
combined lessons 4+5+6 review posted 2026-08-18 is still the one to grade
whenever Alain is live in this routine. Not re-flagging the blocker itself
via notification, same reasoning as 2026-08-20/-21: nothing about it has
changed since it was last surfaced.

Delivered lesson 11 in full — the pre-beta review, and the last lesson in
the sequence, so **the curriculum's teaching side is now complete** (all 11
lessons taught; the log's mastery table only has lessons 1-3 actually
graded, four sit ungraded pending the same blocker as above). Covered all
four parts: documentation drift (the "reasoning aged well, mechanics did
not" pattern — `README.md` and `docs/erd.md` frozen at the pre-cart build,
ADRs 0003/0009 with superseded mechanics, the `routes.rb` "Authenticated"
comment on a public route and the `static_controller.rb` stale HTTP-Basic
admin-auth comment); the four non-default flags (`SKIP_VERIFICATION` and
`VITE_SKIP_VERIFICATION` — the first gate `Carts::Checkout` checks is
`email_verified?`, so an unverified/nonexistent email can place a real
order while this is on, and the frontend flag needs a rebuild to reverse
since it's baked in at Docker build time; `ADMIN_ENABLED`,
`RACK_ATTACK_ENABLED`, the Sidekiq Basic Auth pair, and the Resend trio as
the other invisible-behavior-change vars); the three open product decisions
with teeth (cancellation policy #3 as the sharpest — nobody can cancel once
`preparing` starts, an artifact of the transition table rather than a
ratified choice; vendor verification #5 — nothing gates shop creation on
`verification_status`; notification channels #7 — in-app chat plus the
unread badge is the only channel with SMS off and no push); and the five
operational risks (manual `railway up` deploys with no pipeline and a
known days-stale-production failure mode already experienced, CI filtered
to `apps/api/**` so frontend PRs get zero automated checks, no payment
reconciliation beyond the chat log by design, one-shop-per-vendor as a
racy soft constraint, `ILIKE` search not scaling past dozens of shops).
Walked the full pre-beta checklist at the end. Spot-checked three of the
lesson's sharper claims against live code before teaching — `item.rb`'s
`has_images :photos, max_count: 3` matches the "docs say 6, code says 3"
drift claim, the `routes.rb` shops route still carries the stale
"Authenticated" comment on `ShopsController#index` (which is actually
public), and `static_controller.rb` still says admin-web logs in via HTTP
Basic — all three matched the lesson text exactly, no further drift since
it was written.

### 2026-08-21 — No quiz (blocked, unchanged) · Taught: lesson 10

Sixth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` came back with no match, a broader
"ask user question interactive" keyword search also came back with no match
among this session's toolset). Per this log's own "Next up" instruction
carried from 2026-08-19/2026-08-20, did not write a seventh unanswerable
question set — the combined lessons 4+5+6 review posted 2026-08-18 is still
the one to grade whenever Alain is live in this routine. Not re-flagging via
notification this time either, for the same reason 2026-08-20 gave: the
structural blocker is unchanged from what was already pushed to him after
the 08-18 and 08-19 sessions, and a fourth identical ping would be noise.
The two options ((a) quiz-only-when-live, (b) drop Part 1 from the scheduled
run) are still open and still his call.

Delivered lesson 10 in full: the one error envelope
(`{ error: { code, message, details } }`) and controllers/services never
rendering errors by hand, the `rescue_from` bottom-to-top matching rule and
why `StandardError` is declared *first* (later declarations win, so the
catch-all has to be the earliest one or it swallows `RecordNotFound` /
`Pundit::NotAuthorizedError` into 500s), the generic internal-error message
plus `error_id` correlation token versus the real detail living in
`error_logs`, `record_error_log` rescuing its own failure so a broken DB
doesn't turn one exception into two, the in-house (no Sentry/Rollbar)
monitoring design — one row per fingerprint (exception class + message + top
backtrace line, SHA-256, unique-indexed), `occurrences_count` bumped
silently on repeats, `newly_created` as the sole alerting gate — the
explicit `is_a?(ClientError)` type check instead of `respond_to?(:name)` and
why (`NoMethodError#name` is the *missing method's* name, not the exception's),
frontend `ErrorBoundary`/`unhandledrejection` reporting to the same
`POST /client_errors` pipeline with the one hardcoded exclusion so the
reporter can't report on itself, `ApplicationJob`'s capture-then-re-raise and
why a non-re-raising `rescue_from` would silently disable Sidekiq retries,
`ErrorAlertJob`'s `Rails.env.production?` guard against a stray local
`RESEND_API_KEY` paging a real inbox, the Rack::Attack rule table (auth
10/min, verifications/password-resets 5/min because codes cost money,
early_access 5/min, shop discovery 120/min) and the 429 sharing the standard
error envelope with `Retry-After`, the four admin-surface guards
(conditional routes on `ADMIN_ENABLED` → 404 not 403 when off, per-admin
tokens re-checked every request, a blanket audit `around_action`, and
Sidekiq's own separate Basic Auth pair unmounted unless set), admin-mcp as
an ordinary audited HTTP client of the admin API with `confirm: true`
enforced as a code branch rather than description text, the CI-covers-API-
specs-only gap (Vitest and Playwright both run locally, neither in CI), and
the neighbor-reports-a-broken-app walkthrough (error id → admin Error logs
or admin-mcp → check `occurrences_count` → check `source` → reproduce → fix
→ `railway up` → resolve the row, `reopen!` if the fingerprint recurs).
Spot-checked `error_handling.rb`, `application_job.rb`, and `error_log.rb`
against the lesson text before teaching — all three matched exactly, no
drift; noted one detail the lesson doesn't mention as a bonus in the
session — `ErrorLog.record!`'s `rescue ActiveRecord::RecordNotUnique`
handles two processes racing to record the same brand-new fingerprint
simultaneously, re-reading the winner and counting the loser as a repeat so
no duplicate alert fires.

### 2026-08-20 — No quiz (blocked, unchanged) · Taught: lesson 9

Fifth consecutive automated session with no live user and no interactive
question tool (`select:AskUserQuestion` and a broader keyword search both
came back empty again). Per this log's own "Next up" instruction from the
2026-08-19 session, did not write a sixth unanswerable question set. The
combined lessons 4+5+6 review posted 2026-08-18 remains the one to grade
the next time Alain is live in this routine. Not re-flagging via
notification this time — the structural blocker is unchanged from what was
already pushed to him after the 08-18 and 08-19 sessions, and a third
identical ping would be noise, not new information. See those two entries
for the full diagnosis and the still-open (a)/(b) decision.

Delivered lesson 9 in full: one conversation per order (created empty by
`Carts::Checkout`, looked up by `order_id` not conversation id, separate
`show?`/`post_message?` permissions), `PostMessage`'s save-then-broadcast
order and its three message types (`text`/`image`/`system`, both `body`
and `sender_user` nullable), `OrderChatChannel` re-implementing the
ownership check instead of calling `ConversationPolicy` because Pundit is
controller-shaped, the two-query `UnreadOrders` cursor design (ids not
timestamps, the NULL-sender `IS NULL OR` defense against SQL three-valued
logic, and attribution alone producing the badge asymmetry on status-change
system messages), the payment panel as ADR 0009's revised live-read design
(gated on `ShopSerializer`, safe on `OrderSerializer` because orders are
already participant-scoped) versus the ADR text's stale
auto-posted-first-message description, the sharpest rule (chat narrates,
never drives — state changes produce messages, messages never produce
state changes) with the argument against message-parsed auto-payment
detection, and `Ratings::Create`'s two service-layer gates
(`completed` status, customer-only) plus the DB uniqueness constraint as
the actual guarantee against double-rating. Spot-checked
`post_message.rb`, `unread_orders.rb`, and `ratings/create.rb` against the
lesson text before teaching — all three matched exactly, no drift.

### 2026-08-19 — No quiz (blocked, unchanged) · Taught: lesson 8

Fourth consecutive automated session with no live user present and no
interactive question tool in the toolset — checked again this session via
both a direct `select:AskUserQuestion` lookup and a broader keyword search,
neither found one. Per the instruction this log itself left in "Next up"
after the 2026-08-18 session, did not write a fifth unanswerable question
set. The combined lessons 4+5+6 review posted 2026-08-18 is still the one
to grade, the next time this runs live with Alain present. Nothing new to
add to that diagnosis beyond confirming it again; see the 2026-08-18 entry
below for the full explanation and the two proposed fixes, still both on
the table and still unactioned.

Delivered lesson 8 in full: the eight-state machine and its picture,
the four structural properties (cancellation closes early and is a default
nobody has ratified — open decision #3; `rejected` vs. `cancelled` are
different terminal states with different reason lists; `preparing` is the
one fork, rejoining at `completed`; three terminal states), the
timestamp-column table and why the columns are a denormalized convenience
over the real record (`order_status_events`), `Orders::TransitionStatus`
as the only door and the two claims in its header comment (never inferred
from chat; enforces legality not eligibility — lesson 4's three-layer
split again), the transaction boundary (status change + audit event atomic,
system chat message posted after, so a broadcast failure can't roll back
real state), the two separate cancellation-reason lists and why `other`
requires free text, why `"cancelled"` is absent from the static
`SYSTEM_MESSAGE_TEXT` table in favor of a composed message, the
controller-level customers-may-only-cancel rule and the resulting
permission table (vendor does every move except cancel, including
`completed`), what actually shipped in place of ADR 0005's deferred formal
edits (`EditItems`: vendor-only, `placed/accepted/preparing` only,
whole-batch validation with a cross-shop guard, quantity-0-removes/
unknown-id-adds, and the one deliberate snapshot-rule exception —
edited/added lines reprice at the current `item.price_cents`), and
`payment_status` as a fully independent, vendor-set, idempotent axis with
nothing in the state machine consulting it. Walked the full cradle-to-grave
example including the `preparing`-stage cancel attempt (422, the open
decision made concrete) and the mid-prep item swap.

### 2026-08-18 — Quiz: lessons 4+5+6 combined review (posted, awaiting answers) · Taught: lesson 7

Third consecutive automated session with no live user present and no
interactive question tool in the toolset (confirmed again via a tool
search this session — not just unused). The lesson-4 quiz posted 2026-08-14
and reposted 2026-08-17 is still ungraded; separately, lesson 5 (taught
2026-08-14) and lesson 6 (taught 2026-08-17) have never been quizzed at
all. Rather than posting a fourth isolated, still-unanswerable set, this
session wrote one combined 6-question review spanning all three backlogged
lessons — recall (three authorization layers), reasoning (why
`ShopRotation`'s modulo uses the current result set's count, not the
platform-wide open-shop count), and scenario (a vendor requesting another
vendor's private note → 404 not 403; a vendor completing an order they
don't own → caught by `OrderPolicy#transition?`, not the controller's
customer-only-cancel rule) questions, plus one requiring the live code:
opened `apps/api/app/models/item.rb` to confirm `Item.enabled` the *scope*
excludes `archived_at` rows even when the `enabled` column is `true`,
which the `enabled?` *attribute* reader does not. All six were written
straight from `04-authorization.md`, `05-data-model.md`, and
`06-discovery.md`, not from memory of this prompt. Posted as text in the
session for whenever Alain next answers live — nothing here can grade
itself.

**Worth surfacing plainly:** three sessions running, Part 1 of this daily
routine has been unable to complete, because AskUserQuestion (or any
turn-blocking interactive tool) is absent from scheduled/automated runs,
and because separate scheduled sessions don't share transcripts, so even
posting questions as text and hoping for a reply next time doesn't work —
there is no "next time" continuity. Flagged to Alain via notification.
Recommend one of: (a) only run the quiz portion when he triggers this
skill live and can answer in real time, letting the automated schedule
handle lesson delivery only, or (b) accept that quizzing just won't happen
automatically and drop Part 1 from the scheduled version of this routine.

Delivered lesson 7 in full: ADR 0004's deferral and ADR 0008's reversal of
it (`POST /orders` from ADR 0003 is dead, its state machine is not), one
cart per shop on the backend vs. customer-web's stricter
one-shop-at-a-time policy, the guest cart's per-shop localStorage shape
and its line-by-line replay into the real cart on login (so a
now-unavailable item fails on its own terms instead of a bulk path needing
its own validation), the `CartController` thin-controller shape, the four
checkout gates in order (email verified → 403; cart non-empty → 422;
fulfillment method valid globally *and* for this shop → 422; every item
still enabled/in-stock/unarchived → 422 with `unavailable_items`, and why
that's all-or-nothing rather than dropping lines), the five-step
transaction and why cart-to-`converted` must be inside it, and the two
deliberate omissions (no address collected, no payment message
auto-posted) with the ADR 0009 revision that moved the payment panel to a
live-read pinned view instead of a chat message.

### 2026-08-17 — Quiz: lesson 4 (reposted, still awaiting answers) · Taught: lesson 6

Automated/scheduled session again, no live user present at run time, and
this environment has no interactive question tool available at all — not
just unused, genuinely absent from the toolset. So the lesson-4 quiz from
2026-08-14 was still never graded (that session's exact questions aren't
visible from here either, since sessions don't share transcripts). Wrote a
fresh set of 6 questions straight from `04-authorization.md` — not from
memory of the prompt — mixing recall, reasoning, and scenario, including one
that required opening `apps/api/app/models/order.rb` live (the
`Order::TRANSITIONS` hash) rather than the lesson text alone: a customer
trying to cancel an order in `preparing` clears both the policy and the
controller's "customers may only request cancelled" check, but the service
layer still 422s the request, because `preparing` only transitions to
`ready_for_pickup`/`out_for_delivery` — cancellation is not a legal move
once a vendor has started preparing. Posted all 6 as text and asked Alain to
reply with his answers; grade whenever that reply lands, and backfill the
lesson 4 mastery row then.

Delivered lesson 6 in full: discovery is public and rate-limited at
120/min/IP, the `Shop.listed` both-conditions scope and the deliberate
`open!`/`close!` asymmetry (opening sets both status and accepting_orders,
closing only clears the switch), the `(shop_id + day_of_year) % open_count`
rotation with a worked example and why "never alphabetical" (ADR 0007)
actually matters at neighbor scale, tokenized search (AND across words, OR
within a word, across shop/item/tag fields), the three independent item
availability signals (`enabled`, `archived_at`, `stock_count`) and the trap
that the `enabled` *scope* excludes archived items while the `enabled?`
*attribute* does not, and the serializer's public/gated/withheld field
split (ratings public, payment info gated, exact address withheld in favor
of building only).

### 2026-08-14 — Quiz: lesson 4 (posted, awaiting answers) · Taught: lesson 5

This session ran automated/scheduled with no live user present, so the
6 lesson-4 questions were posted in the session as text (not via the
one-at-a-time interactive flow) instead of graded live. Score/confidence
for lesson 4 are pending until Alain answers in that session; grade and
fill in the Mastery row + this entry then, citing files for anything
missed.

Delivered lesson 5 in full: the four-cluster shape (identity / catalog /
commerce / conversation), `db/schema.rb` over the stale `docs/erd.md`,
the slug-generated-once-and-stable behavior, one-shop-per-vendor as a
soft model validation (open decision #9), the cart-has-no-price /
order-snapshots-everything distinction via `Carts::Checkout`, the two
deliberate live-read exceptions (opening message/QR, customer
name/address) and the terms-vs-context principle behind them, the three
audit trails and which question each answers, and the ratings
DB-uniqueness-is-the-real-guarantee point.

### 2026-08-13 — Quiz: lesson 3 · Taught: lesson 4

Score 4/6 on lesson 3. Confidence: ok.
- Missed: the WebSocket-rejected-but-REST-works scenario — picked "CORS is
  blocking the socket origin" over "the client needs the token as a
  `?token=` query param, since the handshake can't carry an `Authorization`
  header." CORS was the plausible-sounding general-purpose answer; the real
  cause is `ApplicationCable::Connection` reading `request.params[:token]`.
- Missed: the production admin-404 scenario — picked "the admin doesn't
  have permission for that action" over "the admin namespace was never
  drawn because `ADMIN_ENABLED` isn't set." Both misses share a pattern:
  reaching for a plausible general mechanism (CORS, granular permissions)
  instead of the specific one this codebase actually uses — worth watching
  for on the mixed-review round, since it's a "guessing the generic
  explanation" habit rather than a lesson-specific gap.
- Correctly answered: capability-based identity (vendor_profile presence,
  not a role column), the SHA-256-vs-BCrypt reasoning, the stale
  "Authenticated" route-comment question on shop discovery, and the
  live-code check on `ApiToken.authenticate` — confirmed expired and
  never-existed tokens both just return nil from the same `active.find_by`
  scope, no separate expiry signal.
- Delivered lesson 4 in full: default-deny `ApplicationPolicy`, the
  walk-to-user-id ownership pattern repeated per policy (no `Ownable`
  mixin), `ConversationPolicy`'s nil-guard tying back to lesson 3's
  capability model, `OrderPolicy`'s two-owner shape and why orders/chat
  aren't namespaced under `vendor/` the way shops/items are, the
  three-layer split for a transition request (policy / controller / service,
  403/403/422), query-scoping as the strongest boundary (vendor notes, cart
  items, unlisted shops — 404 not 403, since 403 would itself leak
  existence), and the admin side's audit-log-instead-of-Pundit design.

### 2026-08-10 — Quiz: lesson 2 · Taught: lesson 3

Score 4/6 on lesson 2. Confidence: ok.
- Missed: the photo-404 triage scenario — picked "check R2 credentials"
  instead of "check `RESERVED_PATH_PREFIXES` in `routes.rb`." Didn't connect
  the "200 with wrong payload" signature to a routing cause rather than a
  storage/credentials cause.
- Missed: "merge to main deploys" scenario — picked "auto-deploys in a few
  minutes" over "nothing deploys, `railway up` is the only path." Both
  misses share a theme: assuming automation exists (auto-deploy, storage
  validation catching routing bugs) where this repo deliberately has none.
  Worth a re-read of the "Shipping: the part with no safety net" section
  before beta launch, since a real deploy mistake here has real consequences.
- Correctly answered: build-context/COPY-path failure, the two-mechanism
  routing trap (ordering + late-appended engine routes), the VITE_* bake-in
  question, and the live-code CI path-filter check (opened
  `api-ci.yml` and got it right).
- Delivered lesson 3 in full: capability-based identity (no role column,
  shared localStorage token between customer-web/vendor-web), the
  `ApiToken` SHA-256-not-BCrypt reasoning, the discovery-is-public /
  stale-route-comment gotcha, the ActionCable query-param auth workaround,
  and the two separate auth worlds (marketplace vs. admin) with instant
  revocation and the 404-not-403 admin-namespace-gating point.

<!-- Each session appends an entry in this shape:

### 2026-08-07 — Quiz: lesson 1 · Taught: lesson 2
Score 5/6 on lesson 1. Confidence: solid.
- Missed: why image limits live in the model layer (said "security" rather
  than "a future Android client hits the same API").
- Carry forward to the next mixed-review round.

-->

### 2026-08-07 — Quiz: lesson 1 · Taught: lesson 2

Score 6/6 on lesson 1. Confidence: solid.
- No misses. Correctly answered the addresses-schema recall, the ADR 0009
  reframe, the unpaid-order scenario, the live-code FULFILLMENT_METHODS
  question (both models, both `pickup`/`delivery`), the ImageAttachable
  "cannot be trusted" reasoning, and the preparing-fork state machine
  question.
- Delivered lesson 2 in full: the four-apps-one-image-one-service shape,
  the Dockerfile build-context and VITE_* bake-in traps, the routing trap
  (ordering + RESERVED_PATH_PREFIXES, and the actual production incident it
  caused), the social-preview crawler special case, the manual `railway up`
  deploy with no CI/CD, and the CI path-filter gap (frontend PRs get no
  automated checks).

### 2026-08-06 — Taught: lesson 1

No quiz (Day 1, nothing taught yet to quiz on). Delivered lesson 1 in full:
the three refusals (no geo, no payment gateway, no courier) and the
"rules live in the API" corollary, with the ADR 0002 four-layer trace and
the three misconceptions.

## Next up

**Structural blocker, not just a scheduling gap:** fifteen scheduled
sessions in a row now (2026-08-14, -17, -18, -19, -20, -21, -24, -25, -26,
-27, -28, -31, 2026-09-01, -09-02, -09-03) have been unable to grade a quiz, because
there is no interactive tool in automated runs and separate scheduled
sessions don't share transcripts with each other. **Grade the combined
lessons 4+5+6
review** posted in the 2026-08-18 session (6 questions, still open) the next
time this runs as a *live* session with Alain actually present to answer —
and backfill all three mastery rows then. Do not keep appending new
unanswerable question sets; re-post the same 2026-08-18 six or ask live
instead.

The two options from the 2026-08-18 entry — (a) only run Part 1 when this
skill is triggered live, letting the schedule handle lesson delivery only,
or (b) drop Part 1 from the scheduled version entirely — are still both on
the table. This was flagged via notification after the 08-18 and 08-19
sessions; not re-flagged since, including this session, since nothing about
the blocker has changed and a repeat identical ping would just be noise.
Still worth Alain actually deciding between (a)/(b) next time he's here
live, so this stops needing a fresh diagnosis every session.

**The curriculum is fully taught** (lesson 11 delivered 2026-08-24, the
last in the sequence). Part 2 now runs as either mixed review across all 11
lessons (weighted toward `shaky`/`ok` in the Mastery table above) or a
deeper dive on one pre-beta checklist item. 2026-08-25 designed the
CI-for-frontends fix concretely; 2026-08-26 designed the cancellation-policy
fix concretely (add `preparing → cancelled` to `Order::TRANSITIONS`,
make it vendor-only past `accepted`, reuse the existing vendor
cancellation-reason mechanism); 2026-08-27 worked out the concrete
error-alerting verification steps (a synthetic-fingerprint `rails runner`
trigger, since a repeat test never re-alerts, plus the Railway-side config
check this session had no credentials to run itself); 2026-08-28 worked out
the concrete AdminUser bootstrap order, including the `ADMIN_ENABLED`
boot-time route-drawing trap (setting the env var doesn't take effect until
the API restarts, so a login attempt before that reads as a 404, not an
auth failure) and the fact that the bootstrap login itself never appears in
`admin_audit_logs` (the audit hook needs `current_admin_user`, which isn't
set until *after* login succeeds) — see each session's entry for the full
design and file-level citations; 2026-08-31 drafted the exact fixes for
every drift item in lesson 11 Part A (README's stale "not built yet" list
and its missing `admin-web` mention, one-line superseded-mechanics callouts
for ADR 0003 and 0009, the two stale code comments in `routes.rb` and
`static_controller.rb`, and the `docs/erd.md` regenerate-vs-stamp-historical
choice left as Alain's call); 2026-09-01 found that the 08-31 session had
over-filed open decision #7 as "needs Alain present" — it actually had a
concrete code angle like the cancellation-policy item — and drafted two
options: (a) a free bug-fix-shaped change (`Carts::Checkout` posts a
`system` chat message on order creation, the same mechanism
`Orders::TransitionStatus` already uses, so the existing unread badge
actually fires for a new order instead of staying silent until someone
sends a message) and (b) an optional `OrderPlacedNotificationJob` emailing
the vendor via the same Resend pattern `FeedbackNotificationJob` already
uses. 2026-09-02 found the same pattern a second time on the
disputed-payment item, previously (through 09-01) filed as pure
business-process with no code angle: `Order::PAYMENT_STATUSES` has only
`unpaid`/`marked_paid`, `Orders::MarkPaid` is one-directional and vendor-only
(no route or service anywhere moves an order back to `unpaid`), the admin
order-status override (`Admin::OrdersController#transition`) never touches
`payment_status`, and the admin conversation/customer-notes read endpoints
are explicitly built for dispute evidence-gathering but nothing lets an
admin act on that evidence afterward. Drafted (a) a minimal admin
payment-status-reset endpoint mirroring `Orders::MarkPaid`'s shape,
audit-logged for free by the existing `around_action`, and (b) a bigger
`disputed` third status as the actual policy call. Nothing was committed or
run against production in any of these seven sessions, per this routine's
push restriction and its lack of Railway access.

**That closes out every pre-beta checklist item a code-reading deep dive can
actually do something with.** 2026-09-03 found that two of the three
remaining "needs Alain/Railway" items were the same over-filed pattern as
09-01 and 09-02: the app currently has no way to report its own env-var
config or deployed commit, but nothing structural stops it from gaining one
— an admin-gated `SystemStatusController` (booleans only, never raw secret
values, reusing the existing `Admin::BaseController` gating) plus a one-line
`RUN git rev-parse HEAD > REVISION` in `apps/api/Dockerfile`'s build stage
(confirmed feasible: the repo has no root `.dockerignore`, so `.git/` is
already present in the real build context, which is the repo root per the
Dockerfile's own header comment, not `apps/api/`). Only `VITE_SKIP_VERIFICATION`
(frontend-build-time-only) and the legal-drafts lawyer review remain
genuinely code-blind — the legal review because a lawyer has to read prose,
not code. Future automated sessions should say so plainly rather than
re-diagnosing already-drafted items — the eight designs above (CI,
cancellation policy, error alerting, AdminUser bootstrap, docs drift,
notification channels, payment-dispute admin tooling, self-checkable
config/commit status) are ready for Alain to greenlight, most of them small
enough for a single `ship-a-quick-fix` pass each.

Note the Mastery table itself is only trustworthy through lesson 3
(solid/ok/ok); lessons 4-11 are taught but sit ungraded behind the same
blocker, so "weighted toward shaky" currently has nothing concrete to
weight toward beyond lessons 2 and 3 until the backlog clears.

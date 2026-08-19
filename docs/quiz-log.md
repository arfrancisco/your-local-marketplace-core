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
| 9 | Chat, payment, ratings | - | - | - | - |
| 10 | Operations surface | - | - | - | - |
| 11 | Pre-beta review | - | - | - | - |

## Session log

Newest first.

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

**Structural blocker, not just a scheduling gap:** four scheduled sessions
in a row now (2026-08-14, -17, -18, -19) have been unable to grade a quiz,
because there is no interactive tool in automated runs and separate
scheduled sessions don't share transcripts with each other. **Grade the
combined lessons 4+5+6 review** posted in the 2026-08-18 session (6
questions, still open) the next time this runs as a *live* session with
Alain actually present to answer — and backfill all three mastery rows
then. Do not keep appending new unanswerable question sets; re-post the
same 2026-08-18 six or ask live instead.

This has now recurred enough times that the two options from the
2026-08-18 entry are worth actually deciding between rather than
re-flagging indefinitely: (a) only run Part 1 (the quiz) when this skill
is triggered live and Alain can answer in real time, letting the
schedule handle lesson delivery only; or (b) drop Part 1 from the
scheduled version of this routine entirely and quiz only on request.
Flagged again via notification.

Lesson 8 was taught 2026-08-19. **Lesson 9 — chat, payment, and ratings**
is next in the teaching sequence regardless of quiz status, per this log's
own cadence rule (teach happens every session; quiz grading is what's
stuck).

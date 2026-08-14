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
| 5 | Data model and the snapshot rule | 2026-08-14 | - | - | - |
| 6 | Discovery | - | - | - | - |
| 7 | Cart and checkout | - | - | - | - |
| 8 | Order lifecycle | - | - | - | - |
| 9 | Chat, payment, ratings | - | - | - | - |
| 10 | Operations surface | - | - | - | - |
| 11 | Pre-beta review | - | - | - | - |

## Session log

Newest first.

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

**Answer the lesson 4 quiz** posted in the 2026-08-14 session (6 questions,
still open — grade it there when Alain replies, and backfill this file).
Then **lesson 6 — discovery: how a customer finds a shop.**

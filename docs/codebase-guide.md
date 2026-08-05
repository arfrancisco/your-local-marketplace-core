# Codebase learning guide (condensed reference)

The **condensed** version of the material in `docs/curriculum/`. Same 11
topics, same order, roughly a fifth of the length.

> **Learning this for the first time? Start with
> [`docs/curriculum/`](curriculum/README.md), not here.** Those are actual
> lessons — teaching, worked examples, exercises. This page is the revision
> sheet you come back to afterward, and what the daily quiz draws from.

This guide is **descriptive of the code as it exists**, not aspirational.
Where the code and the older docs disagree, it follows the code and says so.
Module 11 is a list of exactly those drifts plus the real pre-beta risks.

How to use it:

1. Read the module's "Read these files" list with the code open.
2. Read the "What to actually know" notes.
3. Answer the self-check questions out loud before looking at the key.
4. The daily quiz (see `docs/quiz-log.md`) pulls from these modules and
   tracks which ones you are shaky on.

Order matters. Modules 1-5 are the spine; 6-10 are the feature areas;
11 is the go-live review. Each module below maps 1:1 to the lesson of the
same number in `docs/curriculum/`.

| Day | Module | Theme |
|---|---|---|
| 1 | [Product shape and non-goals](#module-1--product-shape-and-non-goals) | Why the system looks like this |
| 2 | [Repo layout and deployment](#module-2--repo-layout-and-deployment) | One image, four deployables |
| 3 | [Identity and authentication](#module-3--identity-and-authentication) | Two auth models, one token scheme |
| 4 | [Authorization](#module-4--authorization) | Pundit, default-deny, query scoping |
| 5 | [Data model](#module-5--data-model) | Tables, snapshots, what is immutable |
| 6 | [Discovery and catalog](#module-6--discovery-and-catalog) | Rotation, search, item states |
| 7 | [Cart and checkout](#module-7--cart-and-checkout) | Guest cart, one-shop rule, revalidation |
| 8 | [Order lifecycle](#module-8--order-lifecycle) | The state machine and who drives it |
| 9 | [Chat, payment, ratings](#module-9--chat-payment-and-ratings) | The conversation as the audit trail |
| 10 | [Ops surface](#module-10--ops-surface) | Errors, admin, MCP, limits, jobs, CI |
| 11 | [Pre-beta review](#module-11--pre-beta-review) | Doc drift, flags, real risks |

---

## Module 1 — Product shape and non-goals

### Read these files

- `README.md`
- `CLAUDE.md`
- `docs/adr/0002-no-geo-discovery.md`
- `docs/adr/0009-vendor-managed-payment-via-chat.md`

### What to actually know

This is a **micro-hyperlocal** marketplace: neighbors selling to neighbors
across a small cluster of adjacent buildings. That single premise is
load-bearing for most of the architecture.

Three non-goals are permanent design decisions, not backlog items:

1. **No geography.** No lat/lng, no radius, no distance sort, no map.
   Addresses are descriptive text (unit, building, delivery instructions).
   Within a few adjacent buildings there is no meaningful distance to sort
   by. Expanding beyond that footprint is a real product change requiring a
   geo model, not a config tweak (ADR 0002).
2. **No payment gateway.** Ever, as currently designed. The app never
   touches money. A vendor publishes payment instructions plus a QR code,
   the customer pays out-of-band (GCash, bank transfer, cash), and the
   vendor manually flips `payment_status` to `marked_paid` based on their
   own judgment of what they see in chat (ADR 0009).
3. **No courier network.** Fulfillment is customer pickup or vendor
   delivery. Both are a short walk.

The gap the product actually closes is not "how do we move money" — it is
"how does the customer get the vendor's payment details without asking
every time."

Also worth internalizing: **business rules live in the Rails API, never in
the clients.** An Android client is planned for a separate repo and the API
is built to serve it with no changes, which is why every limit (image size,
counts, state transitions, ownership) is enforced server-side even when the
web client also enforces it.

### Self-check

1. A user asks for "shops near me, sorted by distance." What is the correct
   answer and why is it not a small feature?
2. Where does a customer actually pay, and what does the app record about it?
3. Why are image size and count limits enforced in the Rails model layer
   rather than in the upload UI?

<details><summary>Key</summary>

1. It is out of scope by ADR 0002. There is no lat/lng anywhere in the
   schema, so distance sorting requires a geo model plus address geocoding
   plus a rethink of the footprint premise. It is a product change.
2. Out-of-band, entirely off-platform. The app stores `payment_status`
   (`unpaid` / `marked_paid`), set manually by the vendor, plus whatever the
   two parties said in chat. No amounts move through the system.
3. Because a future Android client will hit the same API, and clients cannot
   be trusted to enforce rules. See the comment at the top of
   `app/models/concerns/image_attachable.rb`.
</details>

---

## Module 2 — Repo layout and deployment

### Read these files

- `docs/architecture.md` (the "One image, four deployables" section)
- `apps/api/config/routes.rb` (the bottom half, from line ~220)
- `apps/api/app/controllers/static_controller.rb`
- `.github/workflows/api-ci.yml`
- `railway.json`, `docker-compose.yml`

### What to actually know

**Four deployables, one artifact.** One Rails API (`apps/api`) and three
Vite/React SPAs (`apps/customer-web`, `apps/vendor-web`, `apps/admin-web`)
build into a **single Docker image** running as **one Railway service**. No
API gateway, no reverse proxy, no separate static host. Rails serves
everything.

The Dockerfile has three Node build stages, one per SPA, and copies each
`dist/` into the Rails image's `public/` tree:

| SPA | Served at | Lands in |
|---|---|---|
| customer-web | `/` | `public/` |
| vendor-web | `/vendor/*` | `public/vendor/` |
| admin-web | `/admin/*` | `public/admin/` |

Because the build needs all three frontend directories plus `apps/api`, the
**build context is the repo root**, not `apps/api`.

**Routing order is a real trap.** `StaticController` serves each SPA's
`index.html` for client-side routes so React Router can take over. The
customer-web catch-all (`get "*path"`) matches everything, so it must be the
**last route drawn**, and it carries a `RESERVED_PATH_PREFIXES` guard:

```ruby
RESERVED_PATH_PREFIXES = %w[/api /rails /cable /up /sidekiq].freeze
```

Engine-mounted routes (ActiveStorage's `/rails/active_storage/*`,
ActionCable's `/cable`, the health check, Sidekiq) are appended by Rails
*after* this file's routes, so without those exclusions the catch-all would
shadow all of them. It did, once: it broke image loading in production.

Real static assets (JS/CSS bundles) never reach `StaticController` at all —
`Rack::Static` serves them first. `StaticController` only ever returns the
`index.html` shell.

**Deploys are manual.** Railway's `api` service has **no connected source**.
Pushing to GitHub deploys nothing. The only path to production is:

```
railway up --service api --path-as-root . --detach
```

run from the repo root. This has already caused real confusion, with the
live site running days-old code while commits kept landing locally.

CI (`api-ci.yml`) runs RSpec against Postgres 16 + Redis 7 on pushes to
`main` and on PRs touching `apps/api/**`. Note the scope: **frontend changes
do not trigger CI**, and CI does not deploy.

### Self-check

1. You push a fix to `main`. Is it live? What makes it live?
2. Why must the `get "*path"` route be last, and what breaks if the
   `RESERVED_PATH_PREFIXES` guard is removed?
3. A request comes in for `/vendor/assets/index-abc123.js`. Which piece of
   the stack answers it, and does `StaticController` see it?
4. Why is the Docker build context the repo root instead of `apps/api`?

<details><summary>Key</summary>

1. No. Only `railway up --service api --path-as-root . --detach` from the
   repo root deploys. There is no CI/CD pipeline.
2. It is a catch-all that matches every path, so anything drawn after it is
   unreachable. Without the guard it also shadows Rails' engine-mounted
   routes appended after this file — ActiveStorage, ActionCable, `/up`,
   Sidekiq — which is exactly what broke production image loading once.
3. `Rack::Static` serves it directly from `public/vendor/assets/`.
   `StaticController` never sees it; it only handles client-side route paths
   that need the `index.html` shell.
4. The image builds all three SPAs plus the API, so the build needs to see
   every `apps/*` directory, not just `apps/api`.
</details>

---

## Module 3 — Identity and authentication

### Read these files

- `apps/api/app/controllers/concerns/authentication.rb`
- `apps/api/app/controllers/concerns/admin/authentication.rb`
- `apps/api/app/models/api_token.rb`, `admin_api_token.rb`, `user.rb`, `admin_user.rb`
- `apps/api/app/channels/application_cable/connection.rb`
- `apps/api/app/services/auth/`, `apps/api/app/services/verifications/`
- `apps/customer-web/src/api/client.ts` (the top ~40 lines)
- `docs/adr/0010-per-admin-accounts.md`

### What to actually know

**Two auth models, deliberately not unified.**

*Marketplace users* (`Authentication` concern): bearer token in
`Authorization: Bearer <token>`, looked up **by digest** via `ApiToken` —
the raw token is never stored. `authenticate!` requires a valid token;
`authenticate_optionally!` attributes a request to a user when a token
happens to be present without requiring one. Only two endpoints use the
optional variant: `feedback` and `client_errors`, both of which must work
for anonymous or crashed clients.

*Admins* (`Api::V1::Admin::BaseController`): a completely separate model
set — `AdminUser` (`has_secure_password`) and `AdminApiToken` (SHA-256
digest, 30-day TTL). Not the same rows as `User`/`ApiToken`, not a
polymorphic extension, not a role flag. It mirrors the *pattern* rather than
reusing the code, matching this repo's preference for duplication over
cross-cutting shared abstractions (ADR 0001, extended by ADR 0010). It
inherits `ApplicationController` directly, **not** `Api::V1::BaseController`.

The admin token is checked on **every request**, so deactivating an admin
revokes access immediately, not at their next login.

**Capability-based, not role-based.** One `User` can hold a
`customer_profile`, a `vendor_profile`, or both. There is no role column.
Authorization asks "does this user own the thing" rather than "what role is
this user." Practically: signing in on customer-web signs you in on
vendor-web too, because both are same-origin and share the
`kapitmarket_token` localStorage key. admin-web uses a separate key
(`kapitmarket_admin_token`) so the sessions never mix.

**WebSockets can't send headers.** `ApplicationCable::Connection` therefore
reads the same bearer token from a `?token=` query param, reusing the
`ApiToken` scheme.

**Verification** issues a challenge per channel (email / sms) storing only
`code_digest`, with `expires_at`, `consumed_at`, and `attempts_count`. The
routes bake `channel` in as a default so the controller stays
channel-agnostic. Email goes via Resend / Cloudflare Email Service, SMS via
Semaphore. **Both are currently switched off for beta** — see Module 11.

**Admin bootstrapping:** the first `AdminUser` comes from the
`admin_users:create` rake task (which aborts if any admin exists); every one
after that is created self-service from admin-web. An admin cannot
deactivate their own account (self-lockout guard), and deactivating one
immediately expires their active tokens.

### Self-check

1. A user registers as a customer and later becomes a vendor. How many
   `User` rows, how many logins, how many tokens?
2. Why is the admin auth stack a separate model set instead of a
   `User#admin?` boolean?
3. How does an ActionCable connection authenticate, and why not with a header?
4. If you deactivate an admin at 2pm, when do they lose access?
5. Which two endpoints use `authenticate_optionally!` and why do they need it?

<details><summary>Key</summary>

1. One `User` row holding both a `customer_profile` and a `vendor_profile`,
   one login, one token — signing in on either app signs you in on both.
2. Admin identity is architecturally separate from marketplace-user
   identity, not a flag on it (ADR 0010). It also keeps the admin surface
   from inheriting `Api::V1::BaseController` behavior it does not want, and
   lets the admin namespace be disabled entirely via `ADMIN_ENABLED`.
3. Bearer token as a `?token=` query param, resolved through the same
   `ApiToken.authenticate`. WebSocket handshakes cannot carry an
   `Authorization` header.
4. Immediately. `Admin::Authentication` re-resolves and re-checks the admin
   on every single request, and deactivation also expires live tokens.
5. `feedback` and `client_errors`. A crashed client or an anonymous visitor
   must still be able to report, but the request should be attributed to a
   user when a token happens to be present.
</details>

---

## Module 4 — Authorization

### Read these files

- `apps/api/app/policies/` (all five files — they are short)
- `apps/api/app/controllers/api/v1/vendor/customer_notes_controller.rb`
- `apps/api/app/controllers/api/v1/orders_controller.rb`
- `apps/api/app/controllers/api/v1/admin/base_controller.rb`

### What to actually know

Pundit, with a **default-deny** base: `ApplicationPolicy` returns `false`
for every permission until a subclass opts in. `Scope#resolve` raises unless
implemented.

**Ownership is always traversed to the `User`.** Every policy resolves the
same way — walk from the record to the owning user id and compare:

- `ShopPolicy`: `record.vendor_profile.user_id == user.id`
- `ItemPolicy`: `record.shop.vendor_profile.user_id == user.id`
- `OrderPolicy`: customer side *or* vendor side of the same order
- `ConversationPolicy`: participant = either side of the order

**One controller pair serves both roles.** Because `OrderPolicy` and
`ConversationPolicy` already unify the ownership check for both sides,
`OrdersController` and `ConversationsController` serve customers and vendors
alike. Only the *list* endpoints differ, because "my orders" means different
things: `GET /orders` (customer's own) vs `GET /vendor/orders` (a vendor's
shop orders).

Two asymmetries in `OrderPolicy` worth remembering:

- `mark_paid?` is **vendor-only**. Payment confirmation is the vendor's
  judgment call from what they see in chat, not something a customer asserts.
- `update_items?` is **vendor-only**. The vendor edits an in-progress
  order's lines after telling the customer in chat. There is no formal
  approval gate.

**One rule lives in the controller, not the policy.**
`OrderPolicy#transition?` is true for both sides, because both legitimately
transition orders. *Which* transitions a customer may request is narrowed
one layer up, in `OrdersController#transition`:

```ruby
if customer_actor? && to_status != "cancelled"
  raise ApiError::Forbidden, "Customers may only cancel an order"
end
```

So a transition request passes through three checks: **do you own this
order** (policy, 403) → **may you make this specific move** (controller,
403) → **is the move legal from the current state** (service, 422).

**Some authorization is at the query layer, not the policy layer.** Private
vendor notes about customers are enforced by scoping every vendor-facing
read through `current_vendor_profile.vendor_customer_notes`. There is no
endpoint that *could* return another vendor's notes about the same customer,
so there is nothing for a policy to get wrong. The admin namespace is the
one deliberate exception, with cross-vendor read access for dispute
investigation.

**Admin audit trail.** Every mutating admin request (POST/PATCH/PUT/DELETE)
writes an `AdminAuditLog` row via a single `around_action :record_audit_log`
on `Api::V1::Admin::BaseController` — admin, method, path,
controller/action, resource type/id, status, filtered params, IP. It is one
hook in one file, not something added per-controller, precisely because all
16+ admin controllers already share that base. **Reads are deliberately not
logged**: the question being answered is "who did this," not "who looked."

### Self-check

1. A vendor tries to `GET /orders/42/conversation` for an order belonging to
   a different shop. Which check stops them, and what does the client see?
2. Why is there no `VendorCustomerNotePolicy`?
3. Which party can mark an order paid, and why not the other one?
4. What does the admin audit log capture, and what does it deliberately not?
5. What does `ApplicationPolicy#show?` return by default, and why does that
   matter?

<details><summary>Key</summary>

1. `ConversationPolicy#show?` → `participant?` is false for both branches,
   Pundit raises `NotAuthorizedError`, and `ErrorHandling` renders
   `{ error: { code: "forbidden", ... } }` with HTTP 403.
2. Visibility is enforced at the query layer: every vendor read is scoped
   through `current_vendor_profile.vendor_customer_notes`, so another
   vendor's notes are not reachable by any endpoint.
3. The vendor only. It is their judgment based on proof they see in chat
   (ADR 0009); letting a customer assert payment would be self-attestation.
4. Captures every mutating admin request with the acting admin, resource,
   status, filtered params, and IP. Does not capture reads.
5. `false`. Default-deny means a new policy grants nothing until it
   explicitly opts in, so forgetting a method fails closed.
</details>

---

## Module 5 — Data model

### Read these files

- `docs/erd.md` (but see the drift warning below)
- `apps/api/app/models/` — start with `user.rb`, `shop.rb`, `item.rb`,
  `order.rb`, `cart.rb`, `conversation.rb`, `rating.rb`
- `apps/api/db/schema.rb` for the authoritative column list

> **Drift warning:** `docs/erd.md` is frozen at the original M0-M4 plan. It
> still lists `carts`/`cart_items` as deferred (they exist), says item photos
> max 6 (the code says 3), and describes orders as cart-free single-item
> placement (checkout is cart-based). Treat `db/schema.rb` and the models as
> truth. This is Module 11 material.

### What to actually know

**Identity:** `users` (email + mobile, both normalized and unique;
`password_digest`; `email_verified_at` / `mobile_verified_at`) with optional
`customer_profiles` and `vendor_profiles` hanging off it. `addresses` are
descriptive — `label`, `recipient_name`, `unit`, `building`, notes — and
carry **no coordinates**.

**Catalog:** `shops` (unique `slug`, `status` draft/active/suspended,
`accepting_orders` boolean, `fulfillment_methods`) → `items` (`price_cents`,
`enabled`, `archived_at`, `stock_count`) → `tags` via `item_tags`.

**Orders are historical records.** This is the single most important data
rule in the codebase:

> Prices and names are **snapshotted into `order_items` at placement** and
> never re-read live.

`order_items` holds `item_name`, `item_description`, `unit_price_cents`,
`quantity`, `line_total_cents`, `customer_note`, with `item_id` nullable
because the item may later be deleted. If a vendor raises a price tomorrow,
yesterday's order still reads yesterday's price.

The deliberate exceptions are documented in `OrderSerializer`: the shop's
opening message / payment QR, and the customer's name and address, are read
**live**, not snapshotted. The reasoning is that those are contextual info
about a person or a pinned panel, not *terms of the sale*. `order_items` is
where snapshotting matters.

**Audit trails are first-class:** `order_status_events` writes one row per
transition (`from_status`, `to_status`, `actor_user_id`, `reason`,
`reason_code`), and `admin_audit_logs` does the same for admin mutations.

**Chat:** exactly one `conversations` row per order (unique `order_id`),
`messages` (nullable `body` for image-only, `message_type`), and
`conversation_reads` as a per-user read cursor
(`last_read_message_id`).

**Ratings** are polymorphic (`reviewee_type` / `reviewee_id`) to support
mutual ratings later, though today it is only customer-rates-shop. The real
backstop against duplicates is a DB uniqueness constraint on
`(order_id, reviewer_user_id, reviewee_type, reviewee_id)`.

**One shop per vendor** is enforced by `validates :vendor_profile_id,
uniqueness: true` — a model validation, **not** a DB constraint, explicitly
so it is easy to lift later.

### Self-check

1. A vendor raises an item's price from ₱120 to ₱150. What does an order
   placed yesterday show, and what mechanism guarantees it?
2. `order_items.item_id` is nullable. Why?
3. Name two things on an order that are deliberately *not* snapshotted, and
   the stated reason.
4. What actually prevents a customer from rating the same order twice —
   the service, or the database?
5. Is "one shop per vendor" a DB constraint? What would it take to allow two?

<details><summary>Key</summary>

1. ₱120. `Carts::Checkout` copies `item.price_cents` into
   `order_items.unit_price_cents` at placement, and nothing ever re-reads
   the live item afterward.
2. The item may be deleted later; the order must survive it. The snapshot
   columns carry everything needed to render the historical line.
3. The shop's opening message / payment QR (a pinned panel that should
   reflect current vendor settings) and the customer's name/address
   (contextual info about a person, not a term of the sale; the customer has
   one address record edited in place).
4. Both, but the database is the real backstop: a uniqueness constraint on
   `(order_id, reviewer_user_id, reviewee_type, reviewee_id)`.
   `Ratings::Create` enforces the completed-status and correct-reviewer
   gates on top.
5. No, it is a model validation on `vendor_profile_id`. Lifting it means
   removing that validation and auditing the code paths that assume
   `vendor_profile.shops.first`.
</details>

---

## Module 6 — Discovery and catalog

### Read these files

- `apps/api/app/services/shop_rotation.rb`
- `apps/api/app/models/shop.rb` (the `listed`, `search`, `matching_word` scopes)
- `apps/api/app/models/item.rb`
- `apps/api/app/controllers/api/v1/shops_controller.rb`
- `apps/api/app/serializers/shop_serializer.rb`
- `docs/adr/0007-daily-rotating-shop-order.md`

### What to actually know

**Discovery is public.** `ShopsController` calls
`skip_before_action :authenticate!` — `GET /shops`, `/shops/:slug`,
`/shops/:slug/items`, and `/shops/:slug/ratings` all work with no token, so
people can browse the community before signing up. (`routes.rb` comments
these as "Authenticated"; the comment is stale.) This is why the guest cart
has to exist.

**Daily rotation, never alphabetical.** `GET /shops` orders shops by:

```ruby
sort_key = (shop_id + day_of_year) % open_shop_count
```

with `shop.id` as a stable tiebreaker. Computed per request from the current
date — no DB column, no scheduled job, deterministic for a given date (the
specs freeze time and assert an exact order). The point is fairness: no shop
is permanently first (ADR 0007).

**`listed` is the discovery scope:** `status: "active"` **and**
`accepting_orders: true`. Both must be true. `open!` sets both, so a vendor
goes from draft to discoverable in one action; `close!` only flips
`accepting_orders`, leaving the shop active.

**Search is text, not geo.** The `search` scope tokenizes per word (AND
across words, OR within each word) across shop name, shop description, item
names, and tag names. So "iced coffee" finds a shop whose "Iced Spanish
Latte" item and "Coffee" tag are two different records — it is not a literal
phrase match.

**Three orthogonal item states.** This trips people up:

| Field | Meaning | Customer sees it? |
|---|---|---|
| `enabled: false` | Vendor's publish/unpublish switch, "might come back" | Hidden entirely |
| `archived_at` set | Vendor is done with it, out of the active list | Hidden entirely |
| `stock_count == 0` | Sold out but still listed | Shown, grayed out |
| `stock_count: nil` | Not tracked (the default) | Shown normally |

The archived exclusion is **baked into the `enabled` scope itself**
(`where(enabled: true, archived_at: nil)`) so every existing call site got
it for free. There is a separate `active` scope for "not archived."

**Public vs gated fields.** `average_rating` and `ratings_count` are always
public on `ShopSerializer`. Payment info is gated behind
`include_payment_info`, and the shop's exact `address` is withheld from
public payloads — only `building` is public — for the vendor's safety, since
many vendors sell out of their own unit.

### Self-check

1. Two shops, ids 3 and 7, and 4 open shops total on day-of-year 100.
   Which sorts first?
2. A vendor taps "close shop." What changes, and is the shop still `active`?
3. Difference between disabling an item, archiving it, and it being sold out?
4. Why is a shop's `address` not in the public serializer when `building` is?
5. Does searching "iced coffee" require those two words to appear together?

<details><summary>Key</summary>

1. Shop 3: `(3 + 100) % 4 = 3`; shop 7: `(7 + 100) % 4 = 3`. They tie, so
   the `shop.id` tiebreaker puts 3 first. (Working the modulo is the point —
   the tie is the interesting case.)
2. `close!` sets `accepting_orders: false` only. `status` stays `"active"`,
   but the shop drops out of the `listed` scope, so it is no longer
   discoverable.
3. Disabled = vendor's temporary unpublish, hidden from customers, may come
   back. Archived = vendor is done with it, also hidden, and folded into the
   `enabled` scope so every call site excludes it. Sold out
   (`stock_count == 0`) = still listed and visible, just grayed out and
   unorderable. `stock_count: nil` means stock is not tracked at all.
4. Vendor safety. Many vendors sell out of their own unit, so the exact
   address is only exposed to the order's participants, while the building
   is safe to show publicly.
5. No. It tokenizes per word and ANDs across words, so the two words can
   match different records (an item name and a tag) on the same shop.
</details>

---

## Module 7 — Cart and checkout

### Read these files

- `apps/api/app/services/carts/checkout.rb` (read this one closely)
- `apps/api/app/services/carts/add_item.rb`, `clear.rb`
- `apps/api/app/controllers/api/v1/cart_controller.rb`
- `apps/api/app/models/cart.rb`, `cart_item.rb`
- `apps/customer-web/src/guestCart.ts`, `CartContext.tsx`
- `docs/adr/0008-cart-reintroduced.md`

### What to actually know

**The cart was deferred (ADR 0004) and then reintroduced (ADR 0008).** The
reason is worth knowing: a single-item "Order now" button is awkward the
moment a real menu is browsable — someone wants adobo *and* pandesal in one
order. That is the common case for food, not an edge case.

**A cart is scoped to exactly one shop.** A customer may have a separate
active cart per shop, but never one cart spanning vendors. This preserves
the "no multi-vendor checkout" non-goal without banning carts: the
constraint moved from "no cart" to "cart per shop." The frontend goes
further with a one-shop-at-a-time policy, which is why `DELETE /cart` clears
a whole shop's cart in one call rather than line by line.

Cart `status` is `active` / `converted` / `abandoned`. Checkout flips the
cart to `converted`.

**Guest carts are client-side.** Anonymous visitors get a localStorage cart
keyed `kapitmarket_guest_cart:<shopId>` (`guestCart.ts`). Browsing and
adding are public; **an account is only required at checkout**, because the
backend `Cart` needs a `customer_profile`. On login, the guest cart's lines
are replayed against the real backend cart one `addCartItem` call at a time,
then cleared.

**`Carts::Checkout` is the most important service in the repo.** Its gates,
in order:

1. **Email verified?** Otherwise a 403 with code `email_not_verified`. (Note
   `SKIP_VERIFICATION` — Module 11.)
2. **Cart non-empty?**
3. **Fulfillment method valid** for both the system and *this shop's*
   `fulfillment_methods`.
4. **Every item still available** — re-checks `enabled?`, `!sold_out?`, and
   `!archived?`. A cart can sit for a long time; what was valid at
   add-to-cart may not be at checkout. Failures come back as
   `details: { unavailable_items: [...] }`.

Then, inside one transaction: build the order, snapshot every line into
`order_items`, write the initial `order_status_events` row
(`from_status: nil, to_status: "placed"`), mark the cart `converted`, and
create the (empty) `Conversation`.

Note what is *not* collected at checkout: a delivery address. The customer
has exactly one address record, read live off the profile.

### Self-check

1. Add a bibingka to shop A's cart, then a taho from shop B. What happens?
2. An anonymous visitor fills a cart and then signs in. Trace what happens
   to their items.
3. Name all four checkout gates in order.
4. An item goes out of stock while sitting in a cart. Where is that caught,
   and what does the customer see?
5. What five things happen inside the checkout transaction?

<details><summary>Key</summary>

1. Carts are per-shop, so you get two separate active carts. The customer-web
   UI additionally enforces one-shop-at-a-time and prompts to switch
   (`ShopSwitchModal`), clearing the other with `DELETE /cart`.
2. The localStorage guest cart (`kapitmarket_guest_cart:<shopId>`) is drained
   into the real backend cart with one `addCartItem` call per line, then
   cleared. An account is only needed at checkout, not to add items.
3. Email verified → cart non-empty → fulfillment method valid for this shop
   → every item still enabled, not sold out, not archived.
4. In `Carts::Checkout`'s revalidation pass, not at add-to-cart time. The
   customer gets a 422 "Some items are no longer available" with
   `details.unavailable_items` listing the names.
5. Build and save the order; create the snapshotted `order_items`; write the
   `nil → placed` status event; set the cart to `converted`; create the
   `Conversation`.
</details>

---

## Module 8 — Order lifecycle

### Read these files

- `apps/api/app/models/order.rb` (the `TRANSITIONS` table and reason lists)
- `apps/api/app/services/orders/transition_status.rb`
- `apps/api/app/services/orders/edit_items.rb`, `mark_paid.rb`
- `apps/api/app/controllers/api/v1/orders_controller.rb`
- `docs/adr/0003-order-lifecycle.md`, `docs/adr/0005-order-edits-deferred.md`

### What to actually know

**The state machine** (`Order::TRANSITIONS`) — memorize this:

```
placed           → accepted | rejected | cancelled
accepted         → preparing | cancelled
preparing        → ready_for_pickup | out_for_delivery
ready_for_pickup → completed
out_for_delivery → completed
completed        → (terminal)
rejected         → (terminal)
cancelled        → (terminal)
```

Two things to notice: **cancellation is only possible from `placed` or
`accepted`** — once a vendor is `preparing`, there is no cancel path. And
`preparing` is where pickup and delivery fork.

**`Orders::TransitionStatus` is the only way status ever changes.** It
enforces the state machine itself; *who* may call which transition is the
controller's Pundit check (`OrderPolicy`), deliberately not this service's
job.

**Customers may only ever request `cancelled`** — enforced in
`OrdersController#transition`, not the policy. Every other move, including
`completed`, is vendor-only.

Each call, inside a transaction: validate the transition is legal, update
`status`, stamp the matching timestamp column (`accepted_at`, `completed_at`,
`cancelled_at` — note `preparing` and the two fork states have none), and
write an `order_status_events` row. **Then**, outside the transaction, post a
`system` message to the order's chat.

**Cancellations require a reason.** A reason *code* must come from the
acting party's own list, because customers and vendors cancel for different
kinds of reasons:

- Customer: `changed_mind`, `found_elsewhere`, `taking_too_long`,
  `ordered_by_mistake`, `other`
- Vendor: `item_unavailable`, `unable_to_fulfill`, `customer_unreachable`,
  `emergency_closure`, `other`

`other` additionally requires free text in `reason`. The labels are plain
Ruby constants, not a migration, so they are safe to reword any time. The
cancellation system message is built dynamically ("Order cancelled by the
vendor: ...") rather than looked up in `SYSTEM_MESSAGE_TEXT`, which is why
`"cancelled"` is deliberately absent from that hash.

**Order edits.** ADR 0005 deferred formal change requests, and that still
holds — there is no `order_change_requests` table and no customer approval
flow. What exists instead is `PATCH /orders/:id/items` (`Orders::EditItems`),
**vendor-only**, for swapping a sold-out item or adjusting a quantity on an
in-progress order after telling the customer in chat.

**`mark_paid` is vendor-only** and independent of `status`.
`payment_status` (`unpaid` / `marked_paid`) is a separate axis from the
order state machine entirely.

### Self-check

1. Write out every legal transition from every state.
2. A customer wants to cancel an order the vendor is already `preparing`.
   What does the API do?
3. What is required to cancel, and what changes if the reason is `other`?
4. Which states stamp a timestamp column, and which do not?
5. Where is "only the vendor may reject an order" enforced — the service or
   the controller? Why there?
6. Is `payment_status` part of the order state machine?

<details><summary>Key</summary>

1. See the table above. The two easy misses: `cancelled` is reachable only
   from `placed` and `accepted`, and `preparing` forks to
   `ready_for_pickup` *or* `out_for_delivery`.
2. Rejects it: `can_transition_to?` is false, so
   `ApiError::UnprocessableEntity` → 422 "Cannot move an order from
   preparing to cancelled." There is no self-cancel path at that point — and
   note this is exactly open decision #3, still unanswered.
3. A `reason_code` drawn from the acting party's own list (customer and
   vendor lists differ). If it is `other`, free-text `reason` is required
   too, or it is a 422.
4. `accepted` → `accepted_at`, `completed` → `completed_at`, `cancelled` →
   `cancelled_at`. `preparing`, `ready_for_pickup`, `out_for_delivery`, and
   `rejected` have no timestamp column; their record lives in
   `order_status_events`.
5. The controller, via `OrderPolicy`. `TransitionStatus` deliberately only
   enforces the state machine, keeping "is this move legal" separate from
   "may this actor make it."
6. No. It is an independent axis, vendor-set via `mark_paid`, orthogonal to
   `status`.
</details>

---

## Module 9 — Chat, payment, and ratings

### Read these files

- `apps/api/app/services/messaging/post_message.rb`, `unread_orders.rb`
- `apps/api/app/channels/order_chat_channel.rb`
- `apps/api/app/controllers/api/v1/conversations_controller.rb`
- `apps/api/app/services/ratings/create.rb`
- `apps/api/app/serializers/order_serializer.rb`
- `apps/customer-web/src/useOrderChat.ts`, `OrderChat.tsx`
- `docs/adr/0009-vendor-managed-payment-via-chat.md`

### What to actually know

**The conversation is the audit trail the users see.** Every status
transition posts a `system` message into the order's chat, so the thread
reads as a full log of the order rather than a side conversation.

**But chat never drives state.** This is the sharpest rule in ADR 0009:

> Order status and chat are two separate systems. Status only ever changes
> through explicit button-driven API calls. The app does not parse messages
> to decide anything.

So "I've paid" in chat changes nothing; the vendor still has to press the
button that calls `mark_paid`.

**Payment info is a pinned panel, not a message.** ADR 0009 originally said
the shop's payment message + QR auto-post as the first chat message at
checkout. **The code does something different**, and the code is newer:
`Carts::Checkout` creates an *empty* conversation, and `OrderSerializer`
reads `opening_message` / `opening_message_photos` **live off the shop** on
every order fetch, so the panel always reflects current vendor settings. The
comments mark this "ADR 0009, revised." Trust the code; the ADR text was
never updated.

**Real-time delivery.** `Messaging::PostMessage` saves the message and
broadcasts it over `OrderChatChannel`. Subscription authorization repeats
the same ownership rule as `ConversationPolicy` — only the order's customer
or the shop's vendor may subscribe, and anyone else is rejected.
`PostMessage` accepts a `nil` sender for system messages.

**Unread is computed in two queries flat**, regardless of how many orders
you pass in, which is what makes it safe on list endpoints
(`Messaging::UnreadOrders`). "Unread" means: a message exists in the
conversation, not sent by this user, with an id newer than this user's
`ConversationRead` cursor (or any message at all if they have never read
it). Because status system messages are attributed to the acting party, the
*other* side sees them as unread and the actor never does. Note the
defensive SQL: `sender_user_id IS NULL OR sender_user_id != ?`, because a
bare `!=` would silently drop NULL senders under SQL's three-valued logic.

**Ratings** are gated by `Ratings::Create`: the order must be `completed`,
and the reviewer must be that order's own customer. Once per order. The DB
uniqueness constraint is the actual backstop. Ratings are public — they show
on the shop page (`average_rating` / `ratings_count` on `ShopSerializer`)
and read-only in vendor-web.

Chat images: max 1 per message, same content-type and size rules as
everywhere else (ADR 0006).

### Self-check

1. A customer sends "paid na po" with a screenshot. What changes in the
   database besides the message row?
2. Where does the payment QR panel actually come from at render time, and
   how does that differ from what ADR 0009 says?
3. A vendor marks an order `preparing`. Who sees an unread indicator?
4. Why does `UnreadOrders` spell out `sender_user_id IS NULL OR ...`?
5. What are the exact preconditions for a rating to be accepted?
6. Who is allowed to subscribe to an `OrderChatChannel` stream?

<details><summary>Key</summary>

1. Nothing else. Chat never drives state. The vendor must explicitly call
   `mark_paid`, and status transitions are separately button-driven.
2. Read live off the shop by `OrderSerializer` on every order fetch, as a
   pinned panel. ADR 0009 describes it auto-posting as the first chat
   message at checkout; the code was revised and the ADR text was not.
3. Only the customer. The system message is attributed to the acting party
   (the vendor), and `UnreadOrders` excludes messages sent by the user
   you are computing for.
4. Under SQL's three-valued logic, `sender_user_id != <id>` evaluates to
   NULL (not true) for a NULL sender, silently excluding system messages
   with no sender. The explicit NULL branch keeps them counted.
5. Order status is `completed`, the reviewer is that order's own customer,
   and no rating exists yet for that
   `(order, reviewer, reviewee_type, reviewee_id)` tuple — the last one
   enforced by a DB uniqueness constraint.
6. Only the order's customer or the shop's vendor. The channel re-checks
   ownership itself rather than relying on the REST policy.
</details>

---

## Module 10 — Ops surface

### Read these files

- `apps/api/app/controllers/concerns/error_handling.rb`
- `apps/api/app/models/error_log.rb`
- `apps/api/app/jobs/` (all four)
- `apps/api/config/initializers/rack_attack.rb`
- `apps/api/app/models/concerns/image_attachable.rb`, `config/storage.yml`
- `admin-mcp/src/tools/mutate.ts`
- `e2e/tests/`
- `docs/adr/0006-image-storage-r2.md`

### What to actually know

**The error envelope.** Every failure leaves as
`{ "error": { "code", "message", "details" } }`. Controllers and services
never render errors by hand — they raise, and `ErrorHandling` maps the
exception.

The subtlety worth remembering: `rescue_from StandardError` is declared
**first, on purpose**. `ActiveSupport::Rescuable` matches handlers
bottom-to-top (`reverse_each`), so the *last* matching declaration wins.
Putting the catch-all at the bottom would swallow `RecordNotFound`,
`Pundit::NotAuthorizedError` and friends and turn all of them into 500s.

**Error monitoring is internal.** No Sentry, no Rollbar, no third-party SDK
— a deliberate call to avoid another paid service. `ErrorLog.record!`
dedupes by a SHA256 fingerprint of exception class + message + top backtrace
line; repeats bump `occurrences_count` / `last_seen_at` instead of growing
the table. `ErrorAlertJob` emails **only on a new fingerprint**, not every
repeat. Recording is itself wrapped in a rescue: if the database is what is
broken, the caller still gets a well-formed envelope. The response carries
`details.error_id` as a support correlation token, and the internal message
stays generic so exception text cannot leak schema or config detail.

Each SPA has an `ErrorBoundary` plus an `unhandledrejection` listener
reporting to the public `POST /api/v1/client_errors`. In the frontend
client, that one path is excluded from failure reporting — reporting a
failure of the failure reporter would recurse.

**Rate limiting** (Rack::Attack, Rails cache backend, disabled in test for
determinism, toggled by `RACK_ATTACK_ENABLED`):

| Endpoint | Limit |
|---|---|
| `/api/v1/auth*` POST | 10/min per IP |
| `*/verifications*` POST | 5/min per IP (codes cost money) |
| `*/password_resets*` POST | 5/min per IP |
| `/early_access` POST | 5/min per IP |
| `GET /api/v1/shops*` | 120/min per IP |

Throttled requests get a JSON 429 matching the standard envelope, with
`Retry-After`.

**Images** live on Cloudflare R2 via S3-compatible Active Storage (ADR
0006). `ImageAttachable` enforces JPEG/PNG/WebP, 5 MB, and per-field counts
in the model layer: items 3 photos, shop profile 1, shop cover 1, opening
message photos 5, chat message 1.

**Background jobs** run on Sidekiq/Redis: `VerificationDeliveryJob`,
`FeedbackNotificationJob`, `ErrorAlertJob`, plus job-failure capture in
`ApplicationJob`. The Sidekiq dashboard at `/sidekiq` has its **own**
Basic Auth pair (`SIDEKIQ_WEB_USERNAME`/`PASSWORD`), separate from admin
accounts — different tool, different audience.

**The admin surface** is only drawn into `routes.rb` when
`ADMIN_ENABLED=true` (or in dev/test). In production without that env var,
the routes **do not exist**.

**`admin-mcp` is a client, not a backdoor.** It is a TypeScript MCP server
wrapping the same admin HTTP API admin-web uses, authenticating with a
bearer `AdminApiToken`. No service-role token, no direct database
connection. Because it is a long-running process with no login flow, its
token is pre-minted via `admin_users:mint_token` (180-day default) rather
than the HTTP login endpoint (30-day). Every mutate tool requires
`confirm: true` or it dry-runs — a **code-enforced branch**, not just a
description hint, so an agent cannot accidentally suspend a user. Every call
lands in the audit log attributed to the token's `AdminUser`.

**Tests:** RSpec for the API (models, requests, services), Vitest +
Testing Library per SPA, Playwright e2e for three flows
(order-and-chat, registration-and-verification, become-a-vendor). CI runs
the API suite only.

### Self-check

1. Why is `rescue_from StandardError` declared first rather than last?
2. Your inbox has one alert for an error that has occurred 400 times. Bug or
   by design?
3. A customer reports a broken page. What do you ask them for, and where do
   you look it up?
4. Is `/api/v1/admin/users` reachable in production right now? What decides?
5. Can `admin-mcp` do anything admin-web cannot?
6. How many photos may a shop have, and where is that enforced?

<details><summary>Key</summary>

1. `ActiveSupport::Rescuable` matches handlers bottom-to-top, so the last
   matching declaration wins. Declared first, the catch-all is the lowest
   priority and every specific handler below it still takes precedence.
2. By design. `ErrorLog.record!` dedupes by fingerprint and `ErrorAlertJob`
   emails only on a genuinely new fingerprint; the repeats bumped
   `occurrences_count` and `last_seen_at`.
3. The `error_id` from the error response's `details`. Look it up in
   admin-web's Error logs page (or via admin-mcp's `error_logs` tools).
4. Only if `ADMIN_ENABLED=true` is set on the service. Without it the admin
   namespace is never drawn, so the routes do not exist at all.
5. No. It is a second HTTP client of the same admin API with an
   `AdminApiToken`, no special access and no DB connection. It is *more*
   restricted in one way: every mutate tool dry-runs unless
   `confirm: true`. Its token just has a longer TTL (180 days vs 30).
6. One profile photo, one cover photo, and up to five opening-message
   photos — enforced by `has_images` in `ImageAttachable` at the model
   layer, along with JPEG/PNG/WebP and 5 MB.
</details>

---

## Module 11 — Pre-beta review

This is the module to actually act on, not just learn. Three categories.

### A. Documentation drift (docs that will mislead you)

| Doc | Says | Reality |
|---|---|---|
| `README.md` | Cart, admin interface, inventory counts "deliberately not built yet"; orders are direct single-item | All built. Cart (ADR 0008), admin-web + admin-mcp, `stock_count` on items |
| `docs/erd.md` | `carts`/`cart_items` deferred | They exist |
| `docs/erd.md` | Item photos max 6 | Code says 3 (`has_images :photos, max_count: 3`) |
| `docs/erd.md` | Shop photos via a generic bucket | Replaced by `profile_photo` / `cover_photo` / `opening_message_photos` |
| `docs/erd.md` | Orders are cart-free direct placement | Checkout is cart-based |
| `docs/adr/0009` | Payment message auto-posts as the first chat message | Read live by `OrderSerializer` as a pinned panel, "ADR 0009, revised" |
| `docs/adr/0003` | `POST /orders` takes `shop_id`, `item_id`, `quantity` | That route does not exist; orders come from `POST /cart/checkout` |
| `routes.rb` | Customer discovery is "Authenticated" | Public — `ShopsController` skips authentication |
| `static_controller.rb` | admin-web logs in with HTTP Basic | Bearer tokens since ADR 0010 |
| `docs/milestones.md` | Frozen at the original M0-M4 plan | Explicitly historical |

`CLAUDE.md` and `docs/architecture.md` are the two docs that *are* current.
The ADRs are authoritative on **why**, but 0003 and 0009 have stale
mechanics.

### B. Flags and switches that are currently non-default

- **`SKIP_VERIFICATION=true`** (API, Railway env var) removes the
  email-verified requirement to become a vendor — and note
  `Carts::Checkout`'s first gate is an email-verified check, so this
  directly affects who can place orders.
- **`VITE_SKIP_VERIFICATION=true`** (customer-web) skips the
  mobile-verification screen during registration. **Baked in at build time**
  via the Dockerfile, so turning it off requires a frontend rebuild and
  redeploy, not just an env var change.
- Both are temporary, pending Semaphore's custom Sender Name approval (up
  to 5 business days, no expedited option, not confirmed cleared).
- **`ADMIN_ENABLED`** decides whether the admin API exists in production.
- **`RACK_ATTACK_ENABLED`** can disable all rate limiting.
- **`SIDEKIQ_WEB_USERNAME`/`PASSWORD`** must be set or `/sidekiq` is not
  mounted at all.

Know which of these are currently set on the Railway service. Going live
with verification disabled is a deliberate, reversible choice — but it means
an unverified email can place an order.

### C. Operational risks worth a decision before beta

1. **Manual deploys.** No CI/CD. Production only moves on
   `railway up --service api --path-as-root . --detach`. The failure mode
   (live site running days-old code) has already happened once.
2. **CI does not cover the frontends.** `api-ci.yml` triggers on
   `apps/api/**` only, and the three SPAs' Vitest suites and the Playwright
   e2e suite never run in CI.
3. **Open product decisions.** `docs/open-decisions.md` lists nine product
   calls with no engineering work left — pilot location, fulfillment mode,
   cancellation policy, vendor verification gating, notification channels,
   receipts/tax, multi-shop. The cancellation one has teeth: today a
   customer simply cannot cancel once the vendor hits `preparing`, and
   nobody has decided whether that is right.
4. **One shop per vendor** is a model validation with no DB constraint.
5. **No payment reconciliation.** `marked_paid` is a vendor's word. There is
   no dispute flow beyond chat plus admin read access.

### Self-check

1. Name three things `README.md` claims are unbuilt that are built.
2. `SKIP_VERIFICATION` is on. Which user-facing gate does that open, and
   which of the two flags needs a rebuild to reverse?
3. What is the single command that puts code in production?
4. A customer wants to cancel an order in `preparing`. Is that a bug, a
   feature, or an open decision?
5. Which two docs in this repo are actually current?

<details><summary>Key</summary>

1. Any three of: the cart, the admin interface (admin-web + admin-mcp),
   inventory counts (`stock_count`), and order edits by vendors.
2. It removes the email-verified requirement — which is `Carts::Checkout`'s
   first gate, so unverified emails can place orders, and it also drops the
   verified requirement to become a vendor. `VITE_SKIP_VERIFICATION` is the
   one baked in at build time, so reversing it needs a frontend rebuild and
   redeploy.
3. `railway up --service api --path-as-root . --detach`, from the repo root.
4. An open decision (`docs/open-decisions.md` #3). The code currently makes
   it impossible, which is a default nobody has ratified.
5. `CLAUDE.md` and `docs/architecture.md`.
</details>

---

## Where to go when the guide runs out

- **Why is it like this?** → `docs/adr/` (11 records, each short)
- **How do the pieces connect?** → `docs/architecture.md`
- **What columns exist?** → `apps/api/db/schema.rb` (not `docs/erd.md`)
- **What is the API contract?** → `apps/api/config/routes.rb`, which is
  heavily commented and reads as a spec
- **What is the expected behavior?** → the specs. `spec/requests/` is the
  best documentation of the API's actual contract in the repo.
- **What is still undecided?** → `docs/open-decisions.md`

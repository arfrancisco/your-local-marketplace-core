# Lesson 5 — The data model and the snapshot rule

> Part 5 of 11. Previous: [Authorization](04-authorization.md) · Next: [Discovery](06-discovery.md)

## Why this matters

One rule in this system matters more than any other for correctness, and it
is a data rule: **orders are historical records**. Get it wrong and a vendor
raising a price silently rewrites what a customer agreed to pay last week.

The rest of the lesson is the map — which tables exist, what hangs off what,
and which of the several audit trails answers which question.

> **Before you start:** `docs/erd.md` is stale. It still lists carts as
> deferred, says item photos max 6 (the code says 3), and describes orders
> as cart-free single-item placement. Read it for the *shape* of the domain,
> not for facts. `apps/api/db/schema.rb` is authoritative.

## The lesson

### The shape, in four clusters

```
IDENTITY          users ─┬─ customer_profiles ─── addresses
                         ├─ vendor_profiles
                         └─ verification_challenges

CATALOG           vendor_profiles ─── shops ─── items ─┬─ item_tags ─── tags
                                                        └─ (photos via Active Storage)

COMMERCE          customer_profiles ─── carts ─── cart_items
                  carts ─── orders ─┬─ order_items          (snapshot)
                                    └─ order_status_events  (audit)

CONVERSATION      orders ─── conversations ─┬─ messages
                                            └─ conversation_reads
                  orders ─── ratings
```

Plus a standalone ops cluster with no domain relationships:
`admin_users`, `admin_api_tokens`, `admin_audit_logs`, `error_logs`,
`feedback_submissions`, `early_access_signups`.

### Identity

**`users`** — `email` and `mobile_number` (both normalized and unique),
`password_digest`, `email_verified_at`, `mobile_verified_at`, `status`,
`last_signed_in_at`. The two `*_verified_at` columns are nullable
timestamps, not booleans, so you know *when*.

**`customer_profiles`** — `display_name`, `default_address_id`.
**`vendor_profiles`** — `display_name`, `verification_status`.

Note `verification_status` exists on `vendor_profiles` but **nothing gates
shop creation on it today**. That is open decision #5, not an oversight to
fix silently.

**`addresses`** — `label`, `recipient_name`, `mobile_number`, `unit`,
`building`, notes, delivery instructions. **No coordinates** (lesson 1).
A customer has exactly one address record in practice, edited in place if
they move.

**`verification_challenges`** — `channel`, `purpose`, `code_digest` (never
the plaintext code), `sent_to`, `expires_at`, `consumed_at`,
`attempts_count`.

### Catalog

**`shops`** — `vendor_profile_id`, `name`, unique `slug`, `description`,
`contact_number`, descriptive `address` plus `building`,
`fulfillment_methods`, `status` (draft/active/suspended), `accepting_orders`,
and the ADR 0009 payment fields (`payment_instructions` / QR, surfaced as
`opening_message` and `opening_message_photos`).

Two model behaviors worth knowing:

*Slug is generated once at creation and then stable*, because it is part of
the public URL `/shops/:slug`. Collisions get a numeric suffix:

```ruby
def generate_slug
  return if slug.present?
  base = name.to_s.parameterize.presence || "shop"
  candidate = base
  suffix = 1
  while Shop.exists?(slug: candidate)
    suffix += 1
    candidate = "#{base}-#{suffix}"
  end
  self.slug = candidate
end
```

Renaming a shop does **not** change its slug. That is deliberate — links
keep working.

*One shop per vendor* is enforced as a model validation, and the code tells
you it is provisional:

```ruby
# One shop per vendor for now. Not a DB constraint (no concurrent-write
# pressure yet at this scale) — lift this if multi-shop vendors are ever
# supported.
validates :vendor_profile_id, uniqueness: true
```

A model-level uniqueness validation is racy under concurrency; the comment
acknowledges this and accepts it at current scale. It is also open decision
#9.

**`items`** — `shop_id`, `name`, `description`, `price_cents`, `currency`,
`enabled`, `archived_at`, `stock_count`, `position`. Three orthogonal
availability signals, covered properly in lesson 6.

**`tags` / `item_tags`** — a plain many-to-many. Tags feed the search scope.

### Commerce, and the rule that matters

**`carts`** — `customer_profile_id`, `shop_id`, `status`
(active/converted/abandoned). One cart per shop; never multi-vendor.

**`cart_items`** — `cart_id`, `item_id`, `quantity`, `customer_note`. Note
what is **absent**: no price column. A cart holds a *reference* to a live
item, so its subtotal is computed fresh every time:

```ruby
def subtotal_cents
  cart_items.sum { |ci| ci.quantity * ci.item.price_cents }
end
```

A cart shows today's price. That is correct: nothing has been agreed yet.

**`orders`** — `public_reference` (unique, human-shareable, generated as
`ORD-XXXXXXXX`), `customer_profile_id`, `shop_id`, `cart_id`,
`fulfillment_method`, `status`, `subtotal_cents`, `total_cents`, `currency`,
`payment_status`, `customer_note`, `vendor_note`, and four lifecycle
timestamps (`placed_at`, `accepted_at`, `completed_at`, `cancelled_at`).

**`order_items`** — and here is the rule:

> Prices and names are **snapshotted into `order_items` at placement** and
> never re-read live.

The columns exist to make the row self-sufficient: `item_name`,
`item_description`, `unit_price_cents`, `quantity`, `line_total_cents`,
`customer_note` — plus a **nullable** `item_id`.

`Carts::Checkout` does the copying:

```ruby
order.order_items.create!(
  item: item,
  item_name: item.name,
  item_description: item.description,
  unit_price_cents: item.price_cents,
  quantity: cart_item.quantity,
  line_total_cents: cart_item.line_total_cents,
  customer_note: cart_item.customer_note
)
```

Why each part matters:

- **Price** — a vendor raising a price tomorrow must not change what a
  customer agreed to yesterday. This is the whole point.
- **Name and description** — a renamed item must not rewrite the receipt.
- **`item_id` nullable** — the item may be deleted later; the order must
  survive it. The snapshot columns carry everything needed to render the
  line without the item existing at all.

Contrast this with `cart_items`, which stores no price. The distinction is
crisp: **a cart is an intention (live), an order is an agreement
(frozen).**

### The deliberate exceptions to snapshotting

Not everything on an order is frozen, and `OrderSerializer` documents each
exception where it happens. Two things are read **live**:

**The shop's opening message and payment QR:**

```ruby
# Read live off the shop, not snapshotted at checkout — a pinned panel
# that always reflects current vendor settings (ADR 0009, revised).
opening_message: order.shop.opening_message,
opening_message_photos: PhotoSerializer.list(order.shop.opening_message_photos),
```

If a vendor changes their GCash number, every open order should show the new
one. Freezing it would be actively wrong.

**The customer's name and address:**

```ruby
# Customer identity/logistics info — deliberately NOT snapshotted, same
# reasoning as opening_message above: this is contextual info about a
# person, not a term of the sale (order_items is where snapshotting
# matters). A customer has exactly one address record (editing it in
# place if they move), so there's nothing to snapshot in the first place
```

The principle that separates the two categories: **terms of the sale are
snapshotted; context about people and settings is read live.** Price and
item name are terms. A phone number and a QR code are context.

`OrderSerializer` also applies a privacy split you saw in lesson 4:

```ruby
# Building only, never the vendor's exact unit (shop.address) — same
# public/private split as ShopSerializer's own building/address gate,
# for the vendor's safety (many vendors sell out of their own unit).
shop_building: order.shop.building,
```

### Three audit trails, three questions

Easy to conflate. They answer different things:

| Table | Question | Written by |
|---|---|---|
| `order_status_events` | How did this order get to its current state? | `Orders::TransitionStatus` (+ checkout's initial `nil → placed`) |
| `messages` (`system` type) | What did the two parties see happen? | `Messaging::PostMessage` |
| `admin_audit_logs` | Which admin did this? | `Admin::BaseController` `around_action` |

`order_status_events` carries `from_status`, `to_status`, `actor_user_id`,
`reason`, `reason_code`, `metadata`. **Every transition writes one**,
including the initial placement, which is written with `from_status: nil`.

The system messages are a *mirror* of the status events, not the source of
truth. If they ever disagree, the events table is right.

### Conversation and ratings

**`conversations`** — just `order_id`, with a unique index. Exactly one
conversation per order, created by `Carts::Checkout` inside the placement
transaction.

**`messages`** — `conversation_id`, **nullable** `sender_user_id` (system
messages may have no sender), nullable `body` (image-only messages),
`message_type`, `metadata`, optional single image attachment.

Both nullable columns have downstream consequences you will meet in lesson
9 — particularly the NULL-sender handling in the unread query.

**`conversation_reads`** — `conversation_id`, `user_id`,
`last_read_message_id`, `last_read_at`. A per-user read cursor, which is why
unread state can be computed rather than stored per message.

**`ratings`** — `order_id`, `reviewer_user_id`, and a **polymorphic**
`reviewee_type`/`reviewee_id`. Today only the customer rates, and the
reviewee is always the shop. The polymorphism is deliberate headroom for
mutual ratings later (open decision #6) without a migration.

The real guarantee against duplicates is a **database uniqueness
constraint** on `(order_id, reviewer_user_id, reviewee_type, reviewee_id)`.
`Ratings::Create` enforces the business gates on top of it, but the DB is
the backstop — the pattern this codebase uses whenever "exactly once"
actually matters.

## Walkthrough: a price change, before and after

Lola's Kitchen sells adobo at ₱120.

**Monday.** Maria adds it to her cart. A `cart_items` row exists with
`quantity: 1` and **no price**. Her cart displays ₱120, computed live.

**Monday, later.** She checks out. `Carts::Checkout` creates an
`order_items` row with `unit_price_cents: 12000`, `item_name: "Adobo"`,
`line_total_cents: 12000`, and `item_id` pointing at the live item. The
order's `subtotal_cents` and `total_cents` are both 12000. The cart flips to
`converted`.

**Tuesday.** Lola raises adobo to ₱150 and renames it "Chicken Adobo."

**Tuesday.** Maria opens her Monday order. `OrderSerializer` reads
`order_items`, not `items`. She sees **"Adobo, ₱120."** Correct.

Meanwhile, the shop's payment QR panel on that same order page reflects
whatever Lola has configured *today* — because that is context, not a term.

**Wednesday.** Lola deletes the item entirely. Maria's order still renders
"Adobo, ₱120" — `item_id` is now null, and every column needed to display
the line is already on the row.

## Common misconceptions

**"`docs/erd.md` is the data model."** It is frozen at the pre-cart plan.
Use `db/schema.rb`.

**"`cart_items` stores a price."** It does not, on purpose. Carts are live;
orders are frozen.

**"Everything on an order is snapshotted."** The payment panel and the
customer's name/address are read live, by design.

**"`Ratings::Create` prevents double ratings."** It helps, but the DB
uniqueness constraint is the actual guarantee.

**"One shop per vendor is a hard constraint."** It is a model validation
with no DB backing, explicitly marked as easy to lift.

**"Renaming a shop changes its URL."** No — the slug is generated once at
creation and never regenerated.

## Exercises

**1.** A vendor renames "Pandesal" to "Pandesal (6 pcs)" and raises the price.
What does an order from last week show, and what mechanism guarantees it?

<details><summary>Answer</summary>

The old name and old price. `Carts::Checkout` copied `item_name` and
`unit_price_cents` into `order_items` at placement, and `OrderSerializer`
reads the `order_items` rows — nothing re-reads the live `items` row.
</details>

**2.** Why does `order_items.item_id` allow NULL when `item_name` does not?

<details><summary>Answer</summary>

The item may be deleted later; the order must survive it. `item_id` is a
convenience link back to the live record when it exists. `item_name` is part
of the frozen record of what was actually sold, so it must always be
present.
</details>

**3.** A vendor updates their GCash QR. Should orders placed yesterday show
the old or new QR? What does the code do, and what is the principle?

<details><summary>Answer</summary>

The new one, and that is what the code does — `OrderSerializer` reads
`opening_message` and `opening_message_photos` live off the shop. The
principle: terms of the sale are snapshotted, context about people and
settings is read live. A payment destination is context, and a stale one
would send money to the wrong place.
</details>

**4.** Name the three audit trails and the question each answers.

<details><summary>Answer</summary>

`order_status_events` — how did this order reach its current state (every
transition, including `nil → placed`). System `messages` — what did the two
parties see happen (a mirror, not the source of truth). `admin_audit_logs`
— which admin performed which mutation.
</details>

**5.** `ratings.reviewee` is polymorphic but only ever a shop. Waste?

<details><summary>Answer</summary>

No — deliberate headroom. Mutual ratings (vendor rates customer) is open
decision #6, and the polymorphic columns mean adopting it needs no
migration. The uniqueness constraint already includes `reviewee_type` and
`reviewee_id`, so it stays correct if a second reviewee type appears.
</details>

## Recap

- **Orders are historical records.** `order_items` snapshots `item_name`,
  `unit_price_cents`, and `line_total_cents` at placement; nothing re-reads
  the live item afterward. `item_id` is nullable so a deleted item cannot
  damage an order.
- **`cart_items` stores no price.** A cart is an intention (live); an order
  is an agreement (frozen).
- The **exceptions are principled**: payment panel and customer
  name/address are read live, because they are context, not terms of sale.
- **Three audit trails**: `order_status_events` (state history), system
  `messages` (what users saw), `admin_audit_logs` (who did what as admin).
- **"Exactly once" is enforced by the database** — the ratings uniqueness
  constraint is the backstop, with service-level gates on top.
- Slugs are generated once and stable; one-shop-per-vendor is a soft model
  validation; `docs/erd.md` is stale and `db/schema.rb` is truth.

---

Next: [Lesson 6 — Discovery: how a customer finds a shop](06-discovery.md)

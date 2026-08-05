# Lesson 6 — Discovery: how a customer finds a shop

> Part 6 of 11. Previous: [The data model](05-data-model.md) · Next: [Cart and checkout](07-cart-and-checkout.md)

## Why this matters

Discovery is where the "no geography" decision has to actually pay for
itself. Every marketplace needs an answer to "which shop do I show first,"
and the usual answers — distance, relevance, paid placement, rating — are
either unavailable here or actively unfair at neighbor scale. What this
codebase does instead is small, clever, and easy to get wrong if you touch
it without understanding it.

You also need the three item availability states cold, because they look
redundant and are not.

## The lesson

### Discovery is public

`ShopsController` opens by opting out of the default authentication:

```ruby
class ShopsController < BaseController
  skip_before_action :authenticate!
```

with the reasoning stated on the class:

```ruby
# Public (no login) so people can browse the community as a hook before
# signing up. It is still not a public search index — there is no
# geo/distance discovery (ADR 0002).
```

Four endpoints, all public: `GET /shops`, `/shops/:slug`,
`/shops/:slug/items`, `/shops/:slug/ratings`. (`routes.rb` comments these as
"Authenticated" — the comment is stale, the code is right.)

This is load-bearing for the product: anonymous browsing is exactly why the
**guest cart** has to exist (lesson 7). An account is only needed at
checkout.

Rate limiting compensates for the openness: `GET /api/v1/shops*` is capped
at 120 requests/minute per IP.

### What "discoverable" means

One scope defines it:

```ruby
scope :listed, -> { where(status: "active", accepting_orders: true) }
```

**Both conditions.** `status` is the lifecycle (draft → active → suspended);
`accepting_orders` is the vendor's manual open/closed switch. A shop must be
active *and* open.

The two model methods that move a shop between those states are asymmetric,
and that asymmetry is the interesting part:

```ruby
# The manual open switch. Opening also activates a draft shop so a vendor can
# go from "created" to "discoverable" in one action (M1 acceptance).
def open!
  update!(status: "active", accepting_orders: true)
end

def close!
  update!(accepting_orders: false)
end

def open?
  status == "active" && accepting_orders?
end
```

`open!` sets **both** — a vendor goes from draft to discoverable in one tap,
never having to understand two separate concepts. `close!` clears **only**
`accepting_orders`, leaving the shop `active`. Closing for the evening is
not the same as unpublishing, and the data preserves that difference.

And an unlisted shop **404s** rather than 403s:

```ruby
# A shop that is not open simply does not exist as far as discovery is
# concerned (404), the same as an unknown slug.
def find_listed_shop!
  Shop.listed.find_by!(slug: params[:slug])
end
```

### The daily rotation

Here is the whole ordering algorithm:

```ruby
# Fair ordering for the community shop listing (ADR 0007). No shop is
# permanently favored: each open shop leads on a predictable, evenly spread
# set of days across the year.
#
#   sort_key = (shop_id + day_of_year) % open_shop_count
class ShopRotation
  def self.order(shops, on: Date.current)
    list = shops.to_a
    count = list.size
    return list if count.zero?

    day = on.yday
    list.sort_by { |shop| [(shop.id + day) % count, shop.id] }
  end
end
```

Read the properties off it:

- **Deterministic** for a given date, which is why specs can freeze time and
  assert an exact order.
- **No storage** — no DB column, no scheduled job, no cache. Computed per
  request from `Date.current`.
- **Rotating** — the `+ day` term shifts every shop's key by one each day,
  so the leader changes daily.
- **Evenly spread** — modulo the number of open shops, so over `count` days
  every shop leads once.
- **Stably tie-broken** — `[key, shop.id]` sorts by id when keys collide.

Why fairness needs an explicit mechanism here: with no distance and no
relevance signal, any *stable* order (alphabetical, newest, by id)
permanently advantages whoever sits at the top. In a community of neighbors,
"Aling Nena's" always beating "Zeny's Ukay" is a real unfairness, not a
rounding error. ADR 0007's rule is blunt: **never alphabetical.**

The one subtlety worth noticing: `count` is the number of shops in *this
result set*. A search that filters to 3 shops rotates modulo 3, not modulo
the total open shops. Fine for fairness, but it means the ordering of a
filtered list is not a subsequence of the unfiltered one.

Worked example — day 100, shops with ids 3, 7, 12, 20 (count 4):

| Shop id | `(id + 100) % 4` | Position |
|---|---|---|
| 20 | 0 | 1st |
| 3 | 3 | tied, id breaks → 3rd |
| 7 | 3 | tied, id breaks → 4th |
| 12 | 0 | tied with 20, id breaks → 2nd |

Final: **20, 12, 3, 7.** Tomorrow (day 101) every key shifts by 1 and the
order changes.

### Search: text, tokenized

```ruby
scope :search, lambda { |term|
  words = term.to_s.strip.split(/\s+/).reject(&:blank?)
  words.reduce(all) { |scope, word| scope.matching_word(word) }
}

scope :matching_word, lambda { |word|
  like = "%#{sanitize_sql_like(word)}%"
  where(
    "shops.name ILIKE :like OR shops.description ILIKE :like OR EXISTS (
       SELECT 1 FROM items
       LEFT JOIN item_tags ON item_tags.item_id = items.id
       LEFT JOIN tags ON tags.id = item_tags.tag_id
       WHERE items.shop_id = shops.id
         AND items.enabled = TRUE
         AND (items.name ILIKE :like OR tags.name ILIKE :like)
     )", like: like
  )
}
```

The structure is **AND across words, OR within each word**. Each word must
match *somewhere* — shop name, shop description, an item name, or a tag —
but different words may match different places. The comment gives the
motivating case:

> a natural query like "iced coffee" should find a shop whose "Iced Spanish
> Latte" and "Coffee" tag are two different items, not require that exact
> phrase to appear verbatim anywhere.

Three details worth noticing:

- `sanitize_sql_like` escapes `%` and `_` so a user searching "50%" does not
  get a wildcard.
- The subquery filters `items.enabled = TRUE`, so a disabled item cannot
  drag its shop into results.
- `ILIKE '%word%'` is case-insensitive and unanchored — no index will help
  it. Perfectly fine for a few dozen neighborhood shops; the first thing to
  revisit if the footprint ever grows.

The controller composes the pieces, and note the ordering — filter, then
rotate:

```ruby
def index
  scope = Shop.listed.search(params[:q]).includes(:vendor_profile, :ratings).distinct
  shops = ShopRotation.order(scope)
  render json: { shops: shops.map { |shop| ShopSerializer.call(shop) } }
end
```

`.distinct` is needed because the tag join can otherwise duplicate a shop.

### The three item states

This is the part people get wrong. `items` carries **three independent
availability signals**:

| Signal | Meaning | Customer sees |
|---|---|---|
| `enabled: false` | Vendor's publish/unpublish switch — "might come back" | Hidden entirely |
| `archived_at` set | Vendor is done with it, out of their active list | Hidden entirely |
| `stock_count == 0` | Sold out, but still on the menu | **Shown, grayed out** |
| `stock_count: nil` | Not tracked (the default) | Shown normally |

`enabled` and `archived_at` both hide the item, but they are different
vendor intentions — a temporary pause versus a permanent retirement — and
vendor-web shows them differently.

The implementation detail worth remembering is how the archive exclusion was
rolled out:

```ruby
# `enabled` (customer-visibility toggle, "might come back soon") vs.
# `archived_at` (vendor's own "done with this...") are orthogonal, but every
# customer-facing scope needs both checked — bake the archived exclusion into
# `enabled` itself so every existing call site gets it for free with no
# change on their end.
scope :enabled, -> { where(enabled: true, archived_at: nil) }
scope :active, -> { where(archived_at: nil) }
```

The `enabled` **scope** checks the `enabled` column *and* `archived_at`.
That is a deliberate naming compromise: adding archiving without auditing
every call site. The cost is that `Item.enabled` and `item.enabled?` mean
different things — the scope excludes archived items, the attribute reader
does not. Worth knowing before you write a query.

`sold_out?` is the odd one out because it does not hide anything:

```ruby
# Additive to `enabled`, not a replacement: `enabled` is the vendor's manual
# publish/unpublish switch (hides the item entirely); stock_count is a
# separate, optional signal — nil means "not tracked" (today's behavior,
# unchanged), present-and-zero means sold out but still listed, shown grayed
# out rather than hidden.
def sold_out?
  stock_count.present? && stock_count <= 0
end
```

Showing a sold-out item is a product decision: "they have this, just not
right now" is useful information for a neighbor deciding whether to come
back tomorrow. Note `nil` is not zero — an untracked item is never sold out.

Item listing is ordered by the vendor's manual `position`, then
`created_at`:

```ruby
items = find_listed_shop!.items.enabled.order(:position, :created_at)
```

No rotation inside a shop. Fairness is a between-vendors problem; within a
shop the vendor decides.

### What discovery exposes, and what it withholds

`ShopSerializer` splits fields into public and gated:

- **Always public**: `average_rating` and `ratings_count`. Not behind any
  auth check — social proof only works if anonymous browsers see it.
- **Gated behind `include_payment_info`**: payment instructions and QR. A
  public shop page must never show these.
- **Withheld from public payloads**: the shop's exact `address`. Only
  `building` is public, for vendor safety, since many vendors sell out of
  their own unit.

Ratings have their own public endpoint with clamped paging:

```ruby
RATINGS_DEFAULT_LIMIT = 20
RATINGS_MAX_LIMIT = 100
...
.limit(params.fetch(:limit, RATINGS_DEFAULT_LIMIT).to_i.clamp(1, RATINGS_MAX_LIMIT))
```

`clamp(1, 100)` means `?limit=999999` cannot be used to pull the whole
table. The comment notes fixed-window paging is enough because "a
neighbourhood shop's review list is short by construction" — scale
assumptions stated out loud, which is how you know they were considered.

## Walkthrough: an anonymous visitor searches "bread"

1. `GET /api/v1/shops?q=bread`, no `Authorization` header.
2. Rack::Attack counts this IP against the 120/min discovery throttle.
3. `authenticate!` is skipped. `current_user` is nil.
4. `Shop.listed` → active and accepting orders only.
5. `.search("bread")` → one word, so one `matching_word` clause: shop name,
   description, or an EXISTS over enabled items and their tags.
6. `.includes(:vendor_profile, :ratings).distinct` — preload for
   serialization, dedupe the tag join.
7. `ShopRotation.order(scope)` sorts by `(id + yday) % count` with id as
   tiebreaker.
8. `ShopSerializer` emits public fields only: rating and count included,
   payment info and exact address excluded.
9. The visitor taps a shop → `GET /shops/pan-de-manila/items` →
   `items.enabled.order(:position, :created_at)` — no disabled or archived
   items, sold-out ones present and flagged.
10. They add a sold-out item to the cart... and the frontend stops them.
    Even if it did not, `Carts::Checkout` re-checks (lesson 7).

## Common misconceptions

**"Discovery requires login."** It does not. The route comment is stale.

**"Closing a shop deactivates it."** `close!` only clears
`accepting_orders`; `status` stays `active`.

**"Sold out means hidden."** It means shown and grayed out. Only `enabled:
false` and `archived_at` hide.

**"`Item.enabled` just checks the `enabled` column."** The scope also
excludes archived items. The attribute reader does not.

**"The rotation needs a cron job."** It is pure computation from
`Date.current` — no column, no job, no cache.

**"Searching two words needs both in the same field."** No: AND across
words, but each word may match a different field or record.

## Exercises

**1.** Day 200, five open shops with ids 1, 4, 9, 15, 22. Which is first?

<details><summary>Answer</summary>

Keys mod 5: `(1+200)%5 = 1`, `(4+200)%5 = 4`, `(9+200)%5 = 4`,
`(15+200)%5 = 0`, `(22+200)%5 = 2`. Lowest key is 0 → **shop 15**. Full
order: 15, 1, 22, 4, 9 (4 before 9 on the id tiebreaker).
</details>

**2.** A vendor says their shop vanished from the list but they never closed
it. What do you check, in order?

<details><summary>Answer</summary>

`Shop.listed` needs both conditions, so check `accepting_orders` (did they
tap close, or did something call `close!`?) and `status` (was it suspended
by an admin, or never activated out of `draft`?). Both are visible in
admin-web's shop detail. Note `open!` sets both while `close!` clears only
one, so a shop can be `active` but not accepting.
</details>

**3.** A vendor is out of pandesal today but will bake more tomorrow. Which
mechanism, and what does the customer see?

<details><summary>Answer</summary>

Set `stock_count` to 0. The item stays listed and appears grayed out, so
customers know it exists and can come back. Disabling would hide it
entirely (wrong signal), and archiving would retire it permanently (very
wrong).
</details>

**4.** Why `.distinct` in `ShopsController#index`?

<details><summary>Answer</summary>

`matching_word` uses an EXISTS subquery rather than a join, so the scope
itself does not duplicate. `.distinct` is defensive against duplication
from the composed scope — with `includes(:ratings)` and multi-word
reduction, one shop should appear once regardless. Removing it risks a shop
appearing twice, which would also corrupt the rotation's `count`.
</details>

**5.** Why is `average_rating` public while payment info is gated?

<details><summary>Answer</summary>

Ratings are social proof — they only do their job if anonymous browsers
see them, and they are public information about a public shop. Payment
instructions and QR codes are the vendor's financial details; exposing
them on a public page invites abuse and has no browsing value. Same logic
withholds the exact unit address while exposing the building.
</details>

## Recap

- Discovery is **public** — anonymous browsing is the hook, rate-limited at
  120/min per IP.
- `Shop.listed` = `status: "active"` **and** `accepting_orders: true`.
  `open!` sets both; `close!` clears only the switch. Unlisted shops 404.
- Ordering is `(shop_id + day_of_year) % open_shop_count` with id as
  tiebreaker — **deterministic, storage-free, rotating daily, never
  alphabetical** (ADR 0007), because with no distance signal any stable
  order permanently favors someone.
- Search is **tokenized text**: AND across words, OR within each word,
  across shop name/description/item names/tags, with `sanitize_sql_like`
  and an `enabled` filter inside the subquery.
- **Three item states**: `enabled` (hides), `archived_at` (hides), and
  `stock_count == 0` (shows grayed out). The `enabled` *scope* also excludes
  archived — unlike the `enabled?` attribute.
- Serialization is split: ratings public, payment info gated, exact address
  withheld in favor of the building.

---

Next: [Lesson 7 — Cart and checkout](07-cart-and-checkout.md)

# Lesson 7 — Cart and checkout

> Part 7 of 11. Previous: [Discovery](06-discovery.md) · Next: [The order lifecycle](08-order-lifecycle.md)

## Why this matters

`Carts::Checkout` is the single most consequential service in the codebase.
It is the moment an intention becomes an agreement: money is implied,
inventory is committed, a conversation opens, and a snapshot freezes. Every
gate in it exists because something can go wrong between "added to cart" and
"placed the order."

It is also the place where the beta's verification flag has its sharpest
effect, so you need to know the gate order exactly.

## The lesson

### A short history worth knowing

ADR 0004 **deferred** the cart so the first build could reach a working
order → chat → rating loop faster, using direct single-item placement
(ADR 0003). ADR 0008 **reversed** that, and its reasoning is a good example
of a decision earning its reversal:

> While building the public discovery demo, it became clear that a
> single-item "Order now" button is awkward the moment a real menu is
> browsable: a customer looking at Lola's Kitchen naturally wants adobo
> *and* pandesal in one order, not two separate ones. That is the common
> case for food, not an edge case, so the deferral no longer holds.

Practical consequence for reading the docs: ADR 0003's `POST /orders` with
`shop_id`, `item_id`, `quantity` **no longer exists**. Orders come from
`POST /cart/checkout`. ADR 0003's *state machine* is still current; its
*placement mechanic* is not.

### One cart per shop, never across shops

The constraint that preserves the "no multi-vendor checkout" non-goal
without banning carts:

> A cart is scoped to exactly one shop. A customer may have a separate
> active cart per shop, but never one cart spanning multiple vendors.

As ADR 0008 puts it, the constraint moved from "no cart" to "cart per shop."

Backend and frontend enforce *different* things here, and it is worth being
precise:

- **The backend** allows multiple active carts, one per shop. `Cart` belongs
  to both a `customer_profile` and a `shop`, and every cart lookup is
  `customer_profile.carts.active.find_by(shop: @shop)`.
- **customer-web** goes further with a **one-shop-at-a-time policy**: adding
  from a second shop prompts you to switch (`ShopSwitchModal`) and clears
  the other cart.

That frontend policy is why `DELETE /cart` clears a whole shop's cart in one
call rather than line by line:

```ruby
# DELETE /api/v1/cart?shop_id=:shop_id — clears the customer's active
# cart for this shop. Used by the frontend's one-shop-at-a-time cart
# policy when the customer confirms replacing it with a different shop.
```

A cart's `status` is `active` / `converted` / `abandoned`. Checkout flips it
to `converted`, which is also what keeps `carts.active` from ever finding a
cart that already became an order.

### The guest cart

Browsing is public (lesson 6), but the backend `Cart` requires a
`customer_profile`. So anonymous visitors get a client-side cart:

```ts
// Shop-scoped, client-only cart for anonymous visitors. Browsing and adding
// items is public; only checkout requires a real account (the backend
// Cart/CartItem, ADR 0008, requires a customer_profile). Once the visitor
// signs in, this is drained into the real backend cart and cleared — see
// CartContext's loadShopCart.
const PREFIX = 'kapitmarket_guest_cart:'
```

Keyed per shop (`kapitmarket_guest_cart:<shopId>`), storing a plain
`{ itemId: quantity }` map, with `try/catch` around the JSON parse so
corrupted localStorage degrades to an empty cart rather than a crash.

The handoff on login: the guest cart's lines are **replayed against the real
backend cart one `addCartItem` call at a time**, then cleared. Not a bulk
import — each line goes through the same `Carts::AddItem` path a signed-in
customer uses, so the same validation applies. If an item went out of stock
while the visitor was anonymous, that line fails on its own terms.

The product point: **an account is required only at checkout, not to add
items.** Signup friction is deferred to the last possible moment.

### The controller layer

`CartController` is a good model of "thin controller." Six actions, each a
few lines, delegating the real work:

```ruby
class CartController < BaseController
  before_action :require_customer_profile
  before_action :set_shop, only: %i[show add_item clear]
  before_action :set_cart_item, only: %i[update_item remove_item]
  before_action :set_checkout_cart, only: %i[checkout]
```

Three things it does that are worth copying:

**Profile check first**, with a clear message: "a vendor-only user gets a
clear 403 rather than a confusing empty cart."

**Shop lookups go through `Shop.listed`**, so you cannot add items from a
closed or draft shop — discovery's visibility rule is reused as a write-side
guard for free.

**Cart-item lookups are ownership-scoped** (lesson 4), so another customer's
cart item 404s rather than confirming it exists.

### Checkout: the four gates

Read this service closely; it is short and every line is a decision.

```ruby
def call
  unless @cart.customer_profile.user.email_verified?
    raise ApiError.new(
      "Please verify your email before placing an order...",
      code: "email_not_verified", status: :forbidden
    )
  end

  raise ApiError::UnprocessableEntity, "Cart is empty" if @cart.cart_items.empty?

  unless Shop::FULFILLMENT_METHODS.include?(@fulfillment_method) &&
         @cart.shop.fulfillment_methods.include?(@fulfillment_method)
    raise ApiError::UnprocessableEntity, "Invalid fulfillment method for this shop"
  end

  unavailable = @cart.cart_items.includes(:item).reject { |ci|
    ci.item.enabled? && !ci.item.sold_out? && !ci.item.archived?
  }
  if unavailable.any?
    raise ApiError::UnprocessableEntity.new(
      "Some items are no longer available",
      details: { unavailable_items: unavailable.map { |ci| ci.item.name } }
    )
  end
  ...
```

**Gate 1 — email verified.** A 403 with the machine-readable code
`email_not_verified`, so the client can route the user to the right screen
rather than parse a message. Remember this gate: `SKIP_VERIFICATION` (lesson
11) is what currently makes it moot in production.

**Gate 2 — cart not empty.**

**Gate 3 — fulfillment method valid twice over.** It must be in the global
`Shop::FULFILLMENT_METHODS` **and** in *this shop's* own
`fulfillment_methods` array. A pickup-only shop cannot receive a delivery
order.

**Gate 4 — availability, re-checked at checkout time.** This is the
important one:

```ruby
# Stock can drop to zero between adding to cart and checking out, same
# as an item being disabled or archived — re-check all three right
# before placing the order, not just at add-to-cart time.
```

All three states from lesson 6 are re-checked: `enabled?`, `!sold_out?`,
`!archived?`. A cart can sit for hours or days; what was valid when added
may not be at checkout. The error returns
`details: { unavailable_items: [names] }` so the UI can name exactly which
lines to remove.

Notice the failure mode is **all-or-nothing**: one unavailable item fails
the whole checkout. No partial orders, no silent line drops. The customer
decides what to do about it.

### Checkout: the transaction

```ruby
order = nil
ActiveRecord::Base.transaction do
  order = build_order
  order.save!
  build_order_items(order)
  order.order_status_events.create!(from_status: nil, to_status: "placed", actor_user: @cart.customer_profile.user)
  @cart.update!(status: "converted")
  Conversation.create!(order: order)
end
order
```

Five things, atomically:

1. **Build and save the order** — status `placed`, `placed_at` stamped,
   `subtotal_cents` and `total_cents` both from the cart's computed
   subtotal, currency taken from the first item.
2. **Snapshot the line items** (lesson 5) — name, description, unit price,
   quantity, line total, note copied off the live item.
3. **Write the initial status event** with `from_status: nil`. Placement is
   part of the audit trail, not a special case outside it.
4. **Mark the cart `converted`** so it can never be checked out twice.
5. **Create the conversation** — empty, one per order.

If any step fails, none of them happened. That matters most for step 4: a
half-converted cart would let the same items be ordered twice.

Two things deliberately absent:

**No delivery address is collected.** The customer has exactly one address
record, read live off the profile at serialization time (lesson 5). Nothing
to collect, nothing to snapshot.

**No payment message is posted.** The conversation is created *empty*. ADR
0009 originally said the shop's payment message and QR auto-post as the
first chat message; the code was revised to read them live as a pinned
panel instead. The service comment records the change:

```ruby
# Also stands up the order's (empty) conversation. The shop's opening
# message/QR gallery is read live off the shop whenever the order is
# fetched (see OrderSerializer) rather than snapshotted here — it's a
# pinned panel that always reflects current vendor settings, not a chat
# message (ADR 0009, revised).
```

`subtotal_cents == total_cents` always, today. There are no fees, no taxes,
no delivery charges, and no promotions (all explicit non-goals). Two columns
exist so adding one later does not need a migration on live orders.

## Walkthrough: an anonymous visitor becomes a customer with an order

1. **Browse.** No token. `GET /shops`, `GET /shops/lolas-kitchen/items`.
2. **Add adobo.** No account, so `guestCart.ts` writes
   `kapitmarket_guest_cart:7 = {"12": 1}` to localStorage.
3. **Add pandesal.** `{"12": 1, "15": 2}`. Still no server involvement.
4. **Tap checkout.** The client requires an account here and only here.
   `AuthModal` opens; they register. `Auth::RegisterUser` creates the
   `User` + `customer_profile`, `ApiToken.issue!` mints a token.
5. **Drain.** `CartContext.loadShopCart` replays each guest line as its own
   `POST /cart/items` call. A real `Cart` (status `active`, shop 7) and two
   `cart_items` now exist server-side. The guest cart key is deleted.
6. **Checkout.** `POST /cart/checkout` with `shop_id`, `fulfillment_method:
   "pickup"`, an optional note.
   - `set_checkout_cart` finds the shop via `Shop.listed` and the cart via
     `customer_profile.carts.active.find_by!(shop:)`.
   - Gate 1: is the email verified? (In the beta, `SKIP_VERIFICATION`
     changes the answer.)
   - Gate 2: two items, fine.
   - Gate 3: is `"pickup"` in Lola's `fulfillment_methods`?
   - Gate 4: are both items still enabled, in stock, unarchived?
7. **Transaction.** Order `ORD-K3M9XQ2P` created with status `placed`; two
   `order_items` frozen at today's prices; a `nil → placed` status event;
   cart flipped to `converted`; empty conversation created.
8. **Response.** `201` with the serialized order — which, on the way out,
   reads the shop's payment QR panel *live* and the customer's address
   *live*, while the line items come from the frozen snapshot.

## Common misconceptions

**"`POST /orders` places an order."** That route does not exist. ADR 0003
describes it; it was superseded. Orders come from `POST /cart/checkout`.

**"The backend enforces one cart total."** It enforces one cart *per shop*.
The single-active-cart behavior is a customer-web policy.

**"Availability is checked when you add to cart."** It is checked at add
time *and again* at checkout. Only the checkout check is authoritative.

**"An unavailable item is dropped from the order."** The whole checkout
fails with the offending names listed.

**"The payment message is the first chat message."** Not anymore — it is a
live-read pinned panel. The ADR text was not updated.

**"Checkout collects a delivery address."** It does not; there is one
address per customer, read live.

## Exercises

**1.** List the four checkout gates in order, with the status code each
returns.

<details><summary>Answer</summary>

1. Email verified — **403**, code `email_not_verified`.
2. Cart not empty — **422**.
3. Fulfillment method valid for the system *and* this shop — **422**.
4. Every item still enabled, not sold out, not archived — **422** with
   `details.unavailable_items`.
</details>

**2.** A customer's cart has three items; one sells out overnight. What
happens at checkout, and why not just drop the line?

<details><summary>Answer</summary>

The entire checkout fails with 422 "Some items are no longer available" and
`details.unavailable_items: ["<name>"]`. Dropping the line silently would
place an order the customer never agreed to — they might have wanted all
three or none. Failing loudly hands the decision back to them.
</details>

**3.** Trace what happens to a guest cart on login. Why one call per line
rather than a bulk endpoint?

<details><summary>Answer</summary>

`CartContext.loadShopCart` reads `kapitmarket_guest_cart:<shopId>` and
replays each line as its own `POST /cart/items`, then clears the key. One
call per line means each goes through the same `Carts::AddItem` validation
a normal add does — so an item that became unavailable while the visitor
was anonymous fails on its own, instead of a bulk path needing its own
parallel validation logic.
</details>

**4.** Why must the cart flip to `converted` inside the same transaction as
order creation?

<details><summary>Answer</summary>

Otherwise a failure between the two leaves an order placed and the cart
still `active`, so `carts.active.find_by!` finds it again and the customer
can check out the same items twice. Atomicity is what makes double-placement
impossible.
</details>

**5.** A pickup-only shop receives a delivery checkout. Which gate catches
it and what exactly is compared?

<details><summary>Answer</summary>

Gate 3. `"delivery"` is in the global `Shop::FULFILLMENT_METHODS`, so the
first half of the check passes — the second half,
`@cart.shop.fulfillment_methods.include?("delivery")`, fails. Both halves
are needed: one validates the value, the other validates it against this
specific shop.
</details>

## Recap

- The cart was deferred (0004) and **reintroduced** (0008); ADR 0003's
  `POST /orders` mechanic is dead, its state machine is not.
- **One cart per shop** on the backend; customer-web adds a stricter
  one-shop-at-a-time policy, which is why `DELETE /cart` clears a whole
  shop's cart.
- **Guest carts** live in localStorage per shop and are replayed line by
  line into the real cart on login. An account is required only at checkout.
- **Four checkout gates, in order**: email verified (403) → cart non-empty →
  fulfillment method valid for this shop → every item still available. The
  last one re-checks all three item states because carts go stale.
- **One transaction** does five things: create order, snapshot line items,
  write the `nil → placed` event, mark the cart converted, create the empty
  conversation.
- No address is collected and no payment message is posted — both are read
  live later.

---

Next: [Lesson 8 — The order lifecycle](08-order-lifecycle.md)

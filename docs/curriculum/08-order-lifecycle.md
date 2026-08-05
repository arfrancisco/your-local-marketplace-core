# Lesson 8 — The order lifecycle

> Part 8 of 11. Previous: [Cart and checkout](07-cart-and-checkout.md) · Next: [Chat, payment, and ratings](09-chat-payment-ratings.md)

## Why this matters

The state machine is the backbone of the product. Every screen in vendor-web
is a view onto it, every system chat message is generated from it, and one
of its gaps — the missing cancel path after `preparing` — is an unanswered
product question you will hit in the beta's first week.

Memorize the table. It is eight states and you will reason about it
constantly.

## The lesson

### The state machine

```ruby
# Legal status transitions (ADR 0003). Enforced by Orders::TransitionStatus,
# never inferred from anything else (e.g. chat content — see ADR 0009).
TRANSITIONS = {
  "placed" => %w[accepted rejected cancelled],
  "accepted" => %w[preparing cancelled],
  "preparing" => %w[ready_for_pickup out_for_delivery],
  "ready_for_pickup" => %w[completed],
  "out_for_delivery" => %w[completed],
  "completed" => [],
  "rejected" => [],
  "cancelled" => []
}.freeze
```

As a picture:

```
                 ┌──────────► rejected  (terminal)
                 │
   placed ───────┼──────────► cancelled (terminal)
     │           │                ▲
     ▼           │                │
   accepted ─────┘────────────────┘
     │
     ▼
   preparing ──┬──► ready_for_pickup ──┐
               │                       ├──► completed (terminal)
               └──► out_for_delivery ──┘
```

Four properties to take from it:

**Cancellation closes early.** `cancelled` is reachable only from `placed`
and `accepted`. Once the vendor is `preparing`, there is no cancel path at
all — not for the customer, not for the vendor. The reasoning is that once
food is being cooked, someone has borne a cost, and the app should not
pretend that is reversible with a button.

That is a *default nobody has ratified*. `docs/open-decisions.md` #3 —
"which order states allow customer self-cancel vs. require vendor
agreement?" — is still open. Today's answer is "neither, after `preparing`,"
by omission. Expect this to come up in beta.

**`rejected` and `cancelled` are different.** Rejection is the vendor
declining at `placed`. Cancellation is either party pulling out of an order
that was already on. Both terminal, different meanings, different reason
lists.

**`preparing` is the fork.** Pickup and delivery diverge exactly once, and
both rejoin at `completed`. This is the state machine expressing "no courier
network" (lesson 1) — two ways for a thing to travel one building over.

**Three terminal states.** `completed`, `rejected`, `cancelled` all map to
`[]`. Once there, an order never moves again.

The three timestamp columns on `orders` cover only some of these:

| Transition | Timestamp stamped |
|---|---|
| `accepted` | `accepted_at` |
| `completed` | `completed_at` |
| `cancelled` | `cancelled_at` |
| `preparing`, `ready_for_pickup`, `out_for_delivery`, `rejected` | *none* |

(`placed_at` is set by checkout, not by a transition.) The states without a
column are not untracked — every transition writes an
`order_status_events` row. The columns are a denormalized convenience for
the three moments the UI needs most.

### The only door: Orders::TransitionStatus

```ruby
# The only way an order's status ever changes (ADR 0003/0009) — always an
# explicit call triggered by a button click, never inferred from chat.
# Which actor may call which transition is enforced by the controller's
# Pundit check (OrderPolicy), not here; this only enforces the state
# machine itself (Order::TRANSITIONS).
```

Two claims in that comment, both worth holding onto:

1. **Never inferred from chat.** A customer typing "cancel my order" changes
   nothing. Only `POST /orders/:id/transitions` does.
2. **This service does not do authorization.** It enforces legality of the
   move, not eligibility of the actor. Lesson 4's three-layer split.

The body:

```ruby
def call
  unless @order.can_transition_to?(@to_status)
    raise ApiError::UnprocessableEntity,
          "Cannot move an order from #{@order.status} to #{@to_status}"
  end

  validate_cancellation_reason! if @to_status == "cancelled"

  ActiveRecord::Base.transaction do
    from_status = @order.status
    attrs = { status: @to_status }
    timestamp_column = TIMESTAMP_COLUMNS[@to_status]
    attrs[timestamp_column] = Time.current if timestamp_column
    @order.update!(attrs)
    @order.order_status_events.create!(
      from_status: from_status, to_status: @to_status,
      actor_user: @actor_user, reason: @reason, reason_code: @reason_code
    )
  end

  post_system_message
  @order
end
```

Note the boundary of the transaction: the **status change and its audit
event are atomic**; the **chat message is posted after**. That ordering is
deliberate. A failed broadcast must not roll back a real state change — the
order genuinely did get accepted even if the notification hiccupped. The
status events table is the source of truth; the chat is a mirror (lesson 5).

### Cancellation reasons

A cancellation cannot go through without a reason, and the reason must come
from the acting party's own list:

```ruby
CUSTOMER_CANCELLATION_REASONS = {
  "changed_mind" => "I changed my mind",
  "found_elsewhere" => "Found a better price or option elsewhere",
  "taking_too_long" => "It's taking too long",
  "ordered_by_mistake" => "I ordered by mistake",
  "other" => "Other"
}.freeze

VENDOR_CANCELLATION_REASONS = {
  "item_unavailable" => "Item(s) no longer available",
  "unable_to_fulfill" => "Unable to fulfill in time",
  "customer_unreachable" => "Customer unreachable",
  "emergency_closure" => "Shop closing early / emergency",
  "other" => "Other"
}.freeze
```

Two lists because the two parties cancel for genuinely different kinds of
reasons — "customer unreachable" is not something a customer says.

The validation:

```ruby
def validate_cancellation_reason!
  unless @reason_code.present? && reason_options.key?(@reason_code)
    raise ApiError::UnprocessableEntity, "A cancellation reason is required"
  end
  if @reason_code == "other" && @reason.blank?
    raise ApiError::UnprocessableEntity, "Please describe the reason for cancelling"
  end
end

def customer_actor?
  @order.customer_profile.user_id == @actor_user.id
end

def reason_options
  customer_actor? ? Order::CUSTOMER_CANCELLATION_REASONS : Order::VENDOR_CANCELLATION_REASONS
end
```

`other` is the escape hatch, and it requires free text — otherwise "other"
carries no information. The purpose is stated in the model comment: "real
data on why cancellations happen, instead of none at all."

Note the labels are **plain Ruby constants, not a database table**, which
the comment flags as intentional: "safe to reword any time." The stored
value is the code; the label is presentation.

### System messages, and the one that is built dynamically

```ruby
SYSTEM_MESSAGE_TEXT = {
  "accepted" => "Order accepted by the vendor.",
  "preparing" => "Vendor is preparing the order.",
  "ready_for_pickup" => "Order is ready for pickup.",
  "out_for_delivery" => "Order is out for delivery.",
  "completed" => "Order completed.",
  "rejected" => "Order rejected by the vendor."
}.freeze
```

`"cancelled"` is **deliberately absent** — it always carries a reason, so
its message is composed at post time:

```ruby
def cancellation_message
  by = customer_actor? ? "the customer" : "the vendor"
  detail = @reason_code == "other" ? @reason : reason_options.fetch(@reason_code, @reason_code)
  "Order cancelled by #{by}: #{detail}."
end
```

Producing, for example: *"Order cancelled by the vendor: Item(s) no longer
available."* The reason lands in the chat where both parties can see it, not
just in a table only admins read.

### Who may make which move

Three layers again (lesson 4), and the middle one lives in the controller:

```ruby
def transition
  to_status = params.require(:to_status)
  if customer_actor? && to_status != "cancelled"
    raise ApiError::Forbidden, "Customers may only cancel an order"
  end
  ...
end
```

So the real permission map is:

| Transition | Who |
|---|---|
| `accepted`, `rejected`, `preparing`, `ready_for_pickup`, `out_for_delivery`, `completed` | Vendor only |
| `cancelled` | Either party (from `placed` or `accepted`) |

Note that **the vendor marks `completed`**, not the customer. At neighbor
scale the vendor is present at handover, so they are the one who knows.

### Order edits: what actually shipped

ADR 0005 deferred formal order edits — change requests with
accept/reject/withdraw. There is still no `order_change_requests` table and
no customer approval flow. What shipped instead is lighter:

```ruby
# Vendor-initiated edit to an already-placed order's line items — swap a
# sold-out item, adjust a quantity — after telling the customer first via
# the existing per-order chat. Deliberately lighter-weight than ADR 0005's
# original accept/reject/withdraw plan: no formal approval gate, just
# edit-after-notifying, narrated into the chat afterward.
class EditItems
  EDITABLE_STATUSES = %w[placed accepted preparing].freeze
```

Four things to know:

**Vendor-only** (`OrderPolicy#update_items?`), and only while the order is
early — once it is `ready_for_pickup`, `out_for_delivery`, or terminal,
edits are refused. Once the vendor has committed to a fulfillment path, the
contents are settled.

**All changes are resolved and validated before anything is written:**

```ruby
# Resolves and validates every change up front — a disabled/sold-out (or
# cross-shop) item anywhere in the batch fails the whole edit before
# anything is written, same spirit as Carts::Checkout re-validating
# availability at checkout time.
```

Including a cross-shop guard: `item.shop_id != @order.shop_id` raises. You
cannot smuggle another shop's item onto an order.

**Quantity 0 removes a line; an unknown item id adds one.** One endpoint
covers add, update, and remove.

**Edits re-read the current price.** An edited or added line uses
`item.price_cents` as of the edit, not the original snapshot. That is
consistent — the vendor is renegotiating that line, and the customer was
told in chat first — but it is the one place the snapshot rule is
deliberately set aside, so know it exists.

Afterwards the subtotal is recomputed and a summary posts to chat: *"Vendor
updated this order: added 2x Pandesal; removed 1x Adobo."*

### Payment status: a separate axis

```ruby
# The vendor's own assertion that they've seen proof of payment (ADR 0009)
# — trust-based, not a verified transaction. Idempotent: marking an
# already-paid order paid again is a no-op, not an error.
class MarkPaid
  def call
    @order.update!(payment_status: "marked_paid") if @order.payment_status == "unpaid"
    @order
  end
end
```

`payment_status` is `unpaid` or `marked_paid`, **entirely independent of
`status`**. An order can be `completed` and `unpaid`, or `placed` and
`marked_paid`. Nothing in the state machine consults it, and vendor-only
by policy.

The idempotence is a small, good decision: a double-tapped button on a
flaky connection is a no-op, not a 422.

## Walkthrough: one order, cradle to grave

**`placed`** — `Carts::Checkout` creates it and writes the `nil → placed`
event. `placed_at` set. Conversation created empty.

**`placed → accepted`** — the vendor taps Accept.
`POST /orders/:id/transitions` with `to_status: "accepted"`. Policy: vendor
owns the shop, passes. Controller: not a customer, so no restriction.
Service: `placed` allows `accepted`. Transaction: status set, `accepted_at`
stamped, event written. Then chat: *"Order accepted by the vendor."* The
customer's order list shows an unread badge.

**Sold out mid-prep** — the vendor messages the customer, then
`PATCH /orders/:id/items` swapping the item. `EditItems` checks the status
is in `placed/accepted/preparing`, validates the whole batch, rewrites the
lines, recomputes the subtotal, and posts *"Vendor updated this order:
..."*.

**`accepted → preparing`** — no timestamp column; the event row is the
record. Chat: *"Vendor is preparing the order."*

**Customer tries to cancel** — `POST /orders/:id/transitions` with
`cancelled`. Policy passes (they own it). Controller passes (`cancelled` is
allowed for customers). Service: `preparing` allows only
`ready_for_pickup`/`out_for_delivery` → **422 "Cannot move an order from
preparing to cancelled."** This is the open decision.

**`preparing → ready_for_pickup`** — chat: *"Order is ready for pickup."*

**Payment** — the customer sends a GCash screenshot in chat. Nothing
changes automatically. The vendor looks at it and taps Mark paid →
`payment_status: "marked_paid"`. No status change.

**`ready_for_pickup → completed`** — the vendor confirms handover.
`completed_at` stamped. Chat: *"Order completed."*

**Rating unlocked** — `Ratings::Create` requires `status == "completed"`,
so only now can the customer rate (lesson 9).

## Common misconceptions

**"A customer can cancel any time before completion."** Only from `placed`
or `accepted`. After `preparing`, nobody can.

**"Chat can trigger a transition."** Never. Explicit API calls only.

**"`TransitionStatus` checks permissions."** It checks legality. The
controller and policy check permission.

**"Every state stamps a timestamp."** Only `accepted`, `completed`, and
`cancelled`. The rest live in `order_status_events`.

**"Order edits were never built."** Formal change requests were not; a
vendor-only `PATCH /orders/:id/items` was.

**"`payment_status` is part of the lifecycle."** It is an independent axis.

**"The customer confirms completion."** The vendor does.

## Exercises

**1.** Write out all eight states and every legal transition, from memory.

<details><summary>Answer</summary>

`placed → accepted | rejected | cancelled`;
`accepted → preparing | cancelled`;
`preparing → ready_for_pickup | out_for_delivery`;
`ready_for_pickup → completed`; `out_for_delivery → completed`;
`completed`, `rejected`, `cancelled` terminal. Common misses: cancellation
disappearing after `accepted`, and both fork states leading to the same
`completed`.
</details>

**2.** A vendor cancels with `reason_code: "changed_mind"`. What happens?

<details><summary>Answer</summary>

422 "A cancellation reason is required." `changed_mind` is in the
*customer* list; `reason_options` picks the vendor list for a vendor actor,
and the key is not in it, so the presence-and-membership check fails. The
message is slightly misleading — the reason was given, just not a valid one
for that party.
</details>

**3.** Why is the chat message posted outside the transaction?

<details><summary>Answer</summary>

So a messaging or broadcast failure cannot roll back a completed state
change. The order genuinely did transition; the chat is a mirror of the
`order_status_events` audit trail, not the source of truth. Inside the
transaction, a failed broadcast would undo real business state.
</details>

**4.** A vendor edits an order to add an item whose price rose since
placement. Which price is used, and does that violate the snapshot rule?

<details><summary>Answer</summary>

The current price — `EditItems` uses `item.price_cents` at edit time. It is
a deliberate exception, not a violation: the vendor is renegotiating that
line and has told the customer in chat first. The original lines stay
frozen; only the edited ones are repriced.
</details>

**5.** An order is `completed` with `payment_status: "unpaid"`. Bug?

<details><summary>Answer</summary>

No. The two axes are independent. A vendor may hand over an order and mark
it complete before confirming payment — or simply forget to tap Mark paid.
Nothing in the state machine consults `payment_status`, which is also why
there is no reconciliation (lesson 1).
</details>

## Recap

- Eight states. **Cancellation only from `placed` or `accepted`**;
  `preparing` forks to pickup/delivery; three terminal states.
- `Orders::TransitionStatus` is the **only** door, enforces the machine
  only, and never infers anything from chat.
- Status change + audit event are **atomic**; the system chat message posts
  **after**, so a messaging failure cannot roll back real state.
- **Cancellation requires a reason code** from the acting party's own list,
  with free text mandatory for `other`. `"cancelled"` is absent from the
  static message table because its message is composed with the reason.
- Customers may only ever request `cancelled`; every other move is vendor-
  only, including `completed`.
- **Order edits** shipped as a light vendor-only `PATCH /orders/:id/items`
  limited to `placed/accepted/preparing`, validated as a batch, repricing
  edited lines at current prices.
- **`payment_status` is a separate axis** from `status`, vendor-set, and
  idempotent.

---

Next: [Lesson 9 — Chat, payment, and ratings](09-chat-payment-ratings.md)

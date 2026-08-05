# Lesson 9 — Chat, payment, and ratings

> Part 9 of 11. Previous: [The order lifecycle](08-order-lifecycle.md) · Next: [The operations surface](10-ops-surface.md)

## Why this matters

Chat is not a side feature here. With no payment gateway and no courier
tracking, **the conversation is the product's connective tissue**: it is
where payment gets arranged, where changes get announced, and where the
order's history is visible to the two people who care.

That makes one rule the sharpest in the codebase, and worth being able to
state precisely: chat *narrates* state, it never *drives* it.

## The lesson

### One conversation per order, forever

`conversations` has one meaningful column, `order_id`, with a unique index.
The conversation is created empty by `Carts::Checkout` inside the placement
transaction and lives as long as the order does.

The controller looks it up by **order id, not conversation id**:

```ruby
# A conversation is looked up by its order_id (one per order) rather than
# its own id — shared between customer and vendor (ConversationPolicy
# unifies ownership for both sides).
```

which is why the routes read `/orders/:id/conversation` and
`/orders/:id/messages`. There is no `/conversations/:id` on the public API —
only in the admin namespace.

Authorization is per-action, with a nice touch:

```ruby
def set_conversation
  order = Order.find(params[:id])
  @conversation = order.conversation
  raise ApiError::NotFound, "This order has no conversation yet" if @conversation.nil?

  authorize @conversation, action_name == "create_message" ? :post_message? : :show?
end
```

Reading and posting are separate permissions (`show?` vs `post_message?`),
even though today both resolve to the same `participant?` check. The seam
is there if reading ever needs to outlive posting — an archived or disputed
order, say.

### Posting a message

```ruby
# Creates a message on an order's conversation and broadcasts it in real
# time (ActionCable). sender_user is nil for the vendor's auto-posted
# payment message (message_type: "system", ADR 0009) — every other message
# has a real sender.
class PostMessage
  def call
    message = @conversation.messages.new(
      sender_user: @sender_user, message_type: @message_type, body: @body
    )
    message.image.attach(@image) if @image.present?
    message.save!

    OrderChatChannel.broadcast_to(@conversation, MessageSerializer.call(message))
    message
  end
end
```

Save then broadcast, in that order — the database is the record, the socket
is a courtesy. A dropped WebSocket costs a live update, not a message.

Message types: `text`, `image`, and `system`. The controller picks between
the first two by whether a file came along:

```ruby
message_type: params[:image].present? ? "image" : "text",
```

An image message may have a nil `body` (image-only), which is why the
column is nullable. One image per message (ADR 0006), same JPEG/PNG/WebP and
5 MB rules as everywhere else.

`sender_user` may also be nil, for system messages with no acting party.
That nullability comes back to bite in the unread query below — remember it.

### Real-time delivery

```ruby
# Real-time delivery for per-order chat (ADR 0009). Only the order's customer
# or the shop's vendor may subscribe — same ownership rule as the REST
# policies (see ConversationPolicy).
class OrderChatChannel < ApplicationCable::Channel
  def subscribed
    conversation = Conversation.find_by(id: params[:conversation_id])
    reject and return if conversation.nil? || !authorized?(conversation)

    stream_for conversation
  end

  private

  def authorized?(conversation)
    order = conversation.order
    order.customer_profile.user_id == current_user.id ||
      order.shop.vendor_profile.user_id == current_user.id
  end
end
```

The channel **re-implements** the ownership check rather than calling
`ConversationPolicy`. Pundit is controller-shaped (it wants a `current_user`
and a policy lookup in a request context), and a channel is not a
controller. Duplication over abstraction again — but it does mean a change
to the ownership rule has to be made in two places, which is worth knowing.

Connection auth is the `?token=` query param from lesson 3. So a subscriber
is authenticated at the connection and authorized at the subscription.

### Unread: computed, not stored

The naive approach is a `read` boolean per message per user. This codebase
uses a **cursor** — `conversation_reads.last_read_message_id` — and computes
unread state on demand. `Messaging::UnreadOrders`:

```ruby
# Which of a set of orders have messages the given user hasn't read yet,
# computed in exactly two queries regardless of how many orders are
# passed in — safe to call from list endpoints, not just single-order ones.
```

Two queries, always:

```ruby
cursors = ConversationRead.where(user: @user, conversation_id: conversation_ids)
                          .pluck(:conversation_id, :last_read_message_id).to_h

latest_other_message_id = Message.where(conversation_id: conversation_ids)
                                 .where("sender_user_id IS NULL OR sender_user_id != ?", @user.id)
                                 .group(:conversation_id)
                                 .maximum(:id)
```

Then a pure-Ruby comparison: unread if there is a latest message from
someone else and either no cursor exists or that message's id beats it.

Three things to take from this:

**The N+1 avoidance is the point.** `OrdersController#index` calls it once
with the whole list. Per-order it would be two queries per order.

**Ids, not timestamps.** Message ids are monotonic within a conversation, so
`latest_id > cursor` is exact and immune to clock skew or same-second
messages.

**The NULL-sender defense is the detail worth remembering:**

```ruby
# NULL-sender defensive: current data never has one (see plan notes),
# but "sender_user_id != user.id" alone would silently exclude a NULL
# sender under SQL's three-valued logic, so it's spelled out.
```

In SQL, `NULL != 5` evaluates to `NULL`, not `TRUE`, so a `WHERE` clause
drops the row. A system message with no sender would silently never count as
unread. The explicit `IS NULL OR` branch prevents a bug that would only
appear once someone posts a senderless message — which `PostMessage`
explicitly supports.

There is also a neat interaction with the status system messages:

```ruby
# Status-change system messages count — they're posted by the acting
# party (see Orders::TransitionStatus), so the OTHER party sees them as
# unread, never the actor themselves.
```

The vendor accepts an order, the system message is attributed to the vendor,
so the *customer* gets the unread badge and the vendor does not. Attribution
does the work; no special-casing needed.

Marking read is a cursor update:

```ruby
def mark_read
  read = ConversationRead.find_or_initialize_by(conversation: @conversation, user: current_user)
  read.last_read_message_id = @conversation.messages.maximum(:id)
  read.last_read_at = Time.current
  read.save!
  head :no_content
end
```

### Payment: the pinned panel

Lesson 1 covered the *why*. Here is the *how*, and it is the one place ADR
0009's text and the code disagree.

**What the ADR says:** the shop's payment message and QR auto-post as the
first chat message at checkout, tagged `system`.

**What the code does:** `Carts::Checkout` creates an **empty** conversation.
`OrderSerializer` reads the panel live on every order fetch:

```ruby
# Read live off the shop, not snapshotted at checkout — a pinned panel
# that always reflects current vendor settings (ADR 0009, revised).
# Safe here even though the public shop listing must never show this
# (see ShopSerializer's include_payment_info) — OrdersController
# already gates every order to just its two participants.
opening_message: order.shop.opening_message,
opening_message_photos: PhotoSerializer.list(order.shop.opening_message_photos),
```

The revision is better for the reason lesson 5 gave: a payment destination
is context, not a term of sale. Frozen at checkout, a vendor changing their
GCash number would send every in-flight customer's money to a dead account.

Note the security reasoning in the comment. The same data is *gated* on the
public shop serializer (`include_payment_info`) and *safe* here, because
`OrdersController` already restricts every order to its two participants.
Same field, two contexts, two answers.

### The sharpest rule

From ADR 0009:

> **Order status and chat are two separate systems.** Status transitions
> only ever happen through explicit button-driven API calls, never inferred
> from chat message content. The app does not parse messages to decide
> anything.

So:

- "I've paid" → nothing. The vendor taps Mark paid.
- "Please cancel" → nothing. Someone taps Cancel.
- "On my way" → nothing. The vendor taps Out for delivery.

The flow is strictly one-directional: **state changes produce chat messages;
chat messages never produce state changes.**

Why this is worth defending: message parsing is a bottomless source of bugs
and false positives ("don't cancel my order"), it fails across languages and
Taglish, and it makes the audit trail ambiguous — did the order cancel
because of a button or a sentence? One direction means
`order_status_events` is always the complete truth.

### Ratings

```ruby
# The only way a rating is written. Enforces the two business rules that
# aren't expressible as a Pundit check on the order alone: the order must be
# finished, and only the customer side rates this phase.
class Create
  def call
    unless @order.status == "completed"
      raise ApiError::UnprocessableEntity, "An order can only be rated once it is completed"
    end

    unless @reviewer_user == @order.customer_profile.user
      raise ApiError::Forbidden, "Only the order's customer may rate it"
    end

    Rating.create!(
      order: @order, reviewer_user: @reviewer_user,
      reviewee: @order.shop, score: @score, comment: @comment
    )
  end
end
```

Three gates, three different enforcers — a good summary of the codebase's
layering:

| Rule | Enforced by | Failure |
|---|---|---|
| Order is `completed` | `Ratings::Create` | 422 |
| Reviewer is the order's customer | `Ratings::Create` | 403 |
| Only once per order | **DB uniqueness constraint** | `RecordInvalid` → 422 |

The uniqueness constraint covers
`(order_id, reviewer_user_id, reviewee_type, reviewee_id)` — the pattern
this codebase reaches for whenever "exactly once" actually matters.

`reviewee` is the shop, via the polymorphic association that leaves room for
mutual ratings later (open decision #6).

Ratings are **public**: `average_rating` and `ratings_count` are ungated on
`ShopSerializer`, there is a public `GET /shops/:slug/ratings` list, and
vendor-web shows them read-only. A vendor can see their standing and cannot
reply, edit, or remove.

`OrderSerializer` carries the rating inline with a comment worth noticing:

```ruby
# Only the customer may rate, and only once, so an order has at most one
# rating this phase — .first is the whole set, not a shortcut.
```

That is the right way to write a comment about a `.first` call: it explains
why it is total rather than lossy.

## Walkthrough: an order's conversation, in full

1. **Checkout.** Empty conversation created inside the transaction.
2. **Customer opens the order.** `GET /orders/:id/conversation` → policy
   `show?` → messages ordered by `created_at`. Empty. But the order payload
   itself carries the pinned payment panel, read live off the shop.
3. **Client subscribes.** `wss://host/cable?token=...`, then
   `OrderChatChannel` with `conversation_id`. The channel re-checks
   ownership and streams.
4. **Vendor accepts.** `TransitionStatus` writes the event, then
   `PostMessage` creates *"Order accepted by the vendor."* with
   `message_type: "system"`, `sender_user:` the vendor. Broadcast.
5. **Unread.** The customer's next `GET /orders` runs `UnreadOrders`: latest
   message not sent by them exists, no cursor → badge. The vendor sees none,
   because they sent it.
6. **Customer pays and posts a screenshot.** `POST /orders/:id/messages`
   with an image, no body → `message_type: "image"`. Saved, attached,
   broadcast. **No state changes.**
7. **Vendor reads.** `POST /orders/:id/conversation/mark_read` sets their
   cursor to the max message id.
8. **Vendor marks paid.** A deliberate button press. `payment_status`
   becomes `marked_paid`. Note: `MarkPaid` posts no chat message — unlike
   status transitions, payment is not narrated.
9. **Through to completed.** Each transition adds a system message; each is
   unread for the other party only.
10. **Rating.** With `status == "completed"`, `POST /orders/:id/ratings`
    passes both service gates and the DB constraint. It appears immediately
    in the shop's public average.

## Common misconceptions

**"Saying 'I paid' marks it paid."** Never. Chat drives nothing.

**"The payment QR is the first chat message."** Not anymore — a live-read
pinned panel. The ADR text is stale.

**"Unread is a column."** It is computed from a per-user cursor in two
queries.

**"System messages have no sender."** They *may* not, but status messages
are attributed to the acting party — which is exactly what makes unread work
correctly.

**"The channel uses ConversationPolicy."** It re-implements the same check;
Pundit is controller-shaped.

**"`Ratings::Create` prevents double rating."** The DB constraint does. The
service enforces status and reviewer.

**"Vendors can respond to reviews."** Read-only for vendors.

## Exercises

**1.** Why `sender_user_id IS NULL OR sender_user_id != ?` rather than just
the inequality?

<details><summary>Answer</summary>

SQL three-valued logic: `NULL != 5` is `NULL`, not `TRUE`, so a `WHERE`
clause drops NULL-sender rows. `PostMessage` explicitly supports a nil
sender for system messages, so those messages would silently never count as
unread. The explicit branch keeps them counted.
</details>

**2.** A vendor moves an order to `preparing`. Who gets an unread badge, and
what mechanism produces that asymmetry?

<details><summary>Answer</summary>

Only the customer. `TransitionStatus` posts the system message with
`sender_user:` the acting vendor, and `UnreadOrders` excludes messages sent
by the user being computed for. No special-casing — attribution alone
produces the asymmetry.
</details>

**3.** Why is payment info gated on `ShopSerializer` but ungated on
`OrderSerializer`?

<details><summary>Answer</summary>

Context. The shop serializer feeds public discovery pages that anyone can
load, where financial details must not appear. The order serializer is only
ever reached through `OrdersController`, which restricts every order to its
two participants — and those two are exactly the people who need the
payment details.
</details>

**4.** A customer tries to rate an order they cancelled. What happens, and
which layer stops them?

<details><summary>Answer</summary>

422 "An order can only be rated once it is completed," from
`Ratings::Create`'s first gate. The status check comes before the reviewer
check, so even the correct customer is refused on a non-completed order.
</details>

**5.** You are asked to auto-detect "paid" in chat and flip
`payment_status`. Give the argument against.

<details><summary>Answer</summary>

It violates ADR 0009's separation directly. Practically: parsing fails on
Taglish and negation ("hindi pa ako nakabayad", "don't mark it paid yet"),
produces false positives that move real money-adjacent state, and makes the
audit trail ambiguous — you could no longer tell whether a change came from
a deliberate action or a sentence. One direction (state → chat) keeps
`order_status_events` complete and unambiguous. The vendor tapping a button
takes two seconds and is unambiguous.
</details>

## Recap

- **One conversation per order**, created empty at checkout, looked up by
  order id, with separate `show?` / `post_message?` permissions.
- `PostMessage` **saves then broadcasts**; message types are `text`,
  `image`, `system`; both `body` and `sender_user` are nullable.
- `OrderChatChannel` **re-implements** the participant check because Pundit
  is controller-shaped.
- **Unread is computed** from a per-user cursor in exactly two queries, by
  id not timestamp, with an explicit NULL-sender branch. Attribution alone
  makes system messages unread for the other party only.
- The **payment panel is read live** off the shop (ADR 0009 revised), gated
  publicly but safe on an order that is already participant-scoped.
- **Chat narrates, never drives.** State changes produce messages; messages
  never produce state changes.
- **Ratings** need `completed` status and the order's own customer, once —
  the last one guaranteed by a DB uniqueness constraint. Public, and
  read-only for vendors.

---

Next: [Lesson 10 — The operations surface](10-ops-surface.md)

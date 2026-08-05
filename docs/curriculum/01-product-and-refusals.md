# Lesson 1 — The product and its three refusals

> Part 1 of 11. Next: [How the system is shaped and shipped](02-shape-and-shipping.md)

## Why this matters

Most of the architectural decisions in this repo only make sense if you
hold one premise in your head. Without it, half the codebase looks like
missing features: no map, no Stripe, no delivery tracking, no multi-vendor
cart. With it, those absences are the design.

If you go into a beta explaining this product as "a local marketplace app,"
you will get asked for a map within a week and you will not have a good
answer. This lesson gives you the answer.

## The lesson

### The premise: micro-hyperlocal

The intended footprint is **a small cluster of neighboring buildings or
units**. Not a city. Not a district. Not even a neighborhood in the usual
sense. A handful of adjacent buildings where residents already live within
walking distance of each other.

A vendor is a neighbor selling their own products. A customer is another
neighbor. That is the whole world the software models.

Everything below follows from that.

### Refusal 1: no geography

There is no latitude, no longitude, no radius, no distance sort, no map.
Look at the `addresses` table and you will find `label`, `recipient_name`,
`mobile_number`, `unit`, `building`, and delivery instructions — and no
coordinates at all.

The reasoning (`docs/adr/0002-no-geo-discovery.md`) is that within a few
adjacent buildings **there is no meaningful distance to filter or sort by**.
Everything is a two-minute walk. A distance sort over a 200-metre radius is
noise dressed up as a feature, and it would drag in geocoding, a maps
dependency, coordinate privacy questions, and a "nearby" UX that implies a
much bigger catchment than actually exists.

So addresses describe **where to walk to, in words**.

The consequence to remember: if a future version needs to span a genuinely
larger area, that is a real product change requiring a geo model — not a
config tweak. It touches the schema, discovery, and the product's core
claim.

### Refusal 2: no payment gateway

No Stripe, no PayMongo, no GCash API. Not this phase and not any planned
one. `docs/adr/0009-vendor-managed-payment-via-chat.md` is worth reading in
full, but the key paragraph is the problem statement:

> In the target community, payment already happens informally and
> out-of-band: bank transfer, GCash, or cash on pickup, arranged directly
> between buyer and seller. The gap is not "how do we move money" — it's
> "how does the customer get the vendor's payment details without asking
> every time."

That reframe is the whole decision. A vendor already has a QR code and a
short note ("GCash to 09xx, please send proof of payment here"). Today they
retype it per order. **That** is the friction the app removes, without ever
touching money.

So the mechanism is:

1. The vendor configures one payment message and one QR image per shop.
2. When an order exists, that panel is shown in the order's conversation.
3. The customer pays out-of-band and says so in chat, usually with a
   screenshot.
4. The vendor looks at it and manually flips `payment_status` from `unpaid`
   to `marked_paid`.

`marked_paid` is **a vendor's assertion, not a verified transaction**. The
code says so out loud, in `OrdersController#mark_paid`:

```ruby
# POST /api/v1/orders/:id/mark_paid — vendor's own assertion that
# they've seen proof of payment (ADR 0009), not a verified transaction.
```

This is a big deal for the beta. There is no reconciliation, no refund
flow, and no dispute mechanism beyond the chat log plus admin read access.
That is acceptable at neighbor scale and would not be at any other scale.

### Refusal 3: no courier network

Fulfillment is exactly two options: **customer pickup** or **vendor
delivery**. Both are a short walk. There is no dispatch, no rider app, no
tracking, no platform-managed logistics.

You can see this constrain the state machine directly — `preparing` forks
into `ready_for_pickup` or `out_for_delivery` and both lead to `completed`.
There is no `assigned_to_courier`, no `picked_up_by_rider`. Two paths,
because there are two ways a thing can travel one building over.

### The fourth thing, which is not a refusal: rules live in the API

> Business rules live in the Rails API, not the clients.

An Android client is planned for a **separate repo** with an undecided
stack (leaning native Kotlin/Compose). The API is built to serve it without
changes. That is why every rule is enforced server-side even when the web
client also enforces it. The clearest statement of this is at the top of
`app/models/concerns/image_attachable.rb`:

```ruby
# Server-side enforcement of the ADR 0006 image rules. The limits live here, in
# the API layer, on purpose: the same rules must hold for the web clients and a
# future mobile client, so the clients cannot be trusted to enforce them.
```

"Cannot be trusted" is not paranoia about attackers here — it is about a
second client, written later, in a different language, by someone who did
not read the web client's validation code.

The practical shape this takes: **thin controllers, service objects for the
real work.** Order placement, status transitions, ratings, cart operations
each get a service class (`Carts::Checkout`, `Orders::TransitionStatus`,
`Ratings::Create`). Controllers parse params, call the service, serialize
the result.

## Walkthrough: tracing a refusal through the code

Take "no geography" and follow it through four layers:

1. **Schema** — `addresses` has `unit` and `building`, no `lat`/`lng`.
   `shops` has an `address` text column and no `service_radius`.
2. **Discovery** — `GET /shops` cannot sort by distance because there is
   nothing to sort by, so it sorts by a **daily rotation** instead
   (lesson 6). The fairness problem that geo would have solved implicitly
   gets solved explicitly.
3. **Search** — `Shop.search` is a text scope over shop names, descriptions,
   item names, and tags. The comment on it says the quiet part:

   ```ruby
   # Keyword search across the shop itself and its catalog (item names, tags) —
   # not geo/distance (ADR 0002), just text matching
   ```

4. **Serialization** — a shop's exact `address` is withheld from public
   payloads; only `building` is public, for vendor safety, since many
   vendors sell out of their own unit. Note that this privacy stance is
   *easier* to hold precisely because there are no coordinates to leak.

One decision, visible at every layer. That is what a load-bearing ADR looks
like.

## Common misconceptions

**"No payment gateway means payment is unbuilt."** No. It is built, it is
just built as a communication feature rather than a financial one. There is
a `payment_instructions` field, a `payment_qr_code` image, a
`payment_status` column, and a `mark_paid` endpoint. It is complete; it just
never touches money.

**"No cart" — outdated.** ADR 0004 deferred the cart, ADR 0008 brought it
back. The cart is real and persisted. `README.md` still says otherwise;
`README.md` is stale (lesson 11).

**"Micro-hyperlocal is a marketing word."** It is a schema constraint. The
absence of coordinates makes larger footprints genuinely hard, on purpose.

## Exercises

**1.** A prospective vendor two neighborhoods over asks to join the beta.
What is the honest answer, in terms of what the software can and cannot do?

<details><summary>Answer</summary>

The software would technically let them create a shop — nothing enforces a
geographic boundary, because there is no geography in the model. But the
product cannot serve them: customers have no way to know a shop is far away
(no distance shown, no filtering), fulfillment assumes a walk, and the
daily rotation would surface them alongside actual neighbors. The
constraint is social and operational, not technical, which is exactly why
"pilot location" is open decision #1 — somebody has to draw the boundary by
hand.
</details>

**2.** A customer says they paid but the vendor never marked the order paid.
What does the system know, and what recourse exists?

<details><summary>Answer</summary>

The system knows: `payment_status` is still `unpaid`, and the full chat
history including any screenshot the customer posted. That is all. There is
no transaction record because no money moved through the platform. Recourse
is the vendor changing their mind, or an admin reading the conversation
via the admin panel (`GET /api/v1/admin/conversations/:id`) to arbitrate. No
refund, chargeback, or hold mechanism exists.
</details>

**3.** Why does `ImageAttachable` enforce a 5 MB limit in a Rails model
rather than in the file picker?

<details><summary>Answer</summary>

Because a future Android client will call the same API and will not share
the web client's validation code. Client-side checks are a UX nicety; the
model validation is the actual rule. Same reasoning for every other limit
in the system.
</details>

**4.** Name the two fulfillment methods and find where the list of legal
values is defined.

<details><summary>Answer</summary>

`pickup` and `delivery`. Defined twice as frozen constants:
`Shop::FULFILLMENT_METHODS` and `Order::FULFILLMENT_METHODS`, both
`%w[pickup delivery]`. `Carts::Checkout` checks the requested method
against *both* the system list and the specific shop's own
`fulfillment_methods` array.
</details>

## Recap

- The premise is a **small cluster of adjacent buildings**. Everything
  follows from that.
- **No geo** (ADR 0002): addresses are words, discovery is text search plus
  a daily rotation, expanding the footprint is a product change.
- **No payment gateway** (ADR 0009): the app removes the friction of
  re-sending payment details, never touches money, and `marked_paid` is the
  vendor's word.
- **No courier**: pickup or vendor delivery, which is why the state machine
  has exactly two fulfillment paths.
- **Rules live in the API** because a separate-repo Android client is
  coming and clients cannot be trusted to enforce anything.

---

Next: [Lesson 2 — How the system is shaped and shipped](02-shape-and-shipping.md)

# ADR 0009 — Vendor-managed payment via chat, no payment gateway

Status: accepted
Date: 2026-07-31

## Context

M3 (order placement) and M4 (per-order chat) are being built together.
Payment is the natural point where a marketplace app is expected to
integrate a payment gateway (Stripe, PayMongo, GCash API, etc.). This app
will not do that, this phase or any planned future one — no gateway
integration has been scoped, budgeted, or designed for.

In the target community (neighbors in a small cluster of buildings), payment
already happens informally and out-of-band: bank transfer, GCash, or cash on
pickup, arranged directly between buyer and seller. The gap is not "how do
we move money" — it's "how does the customer get the vendor's payment
details without asking every time." A vendor already has a QR code (GCash,
bank app, whatever they use) and a short note ("GCash to 09xx, please send
proof of payment here"). Today that has to be retyped or re-sent per order,
which is exactly the kind of friction the app can remove without touching
money at all.

## Decision

- A vendor sets up **one payment message + one QR code image per shop**
  (`Shop#payment_instructions` text, `Shop#payment_qr_code` single image).
  Per-shop, not per-vendor, so a vendor running multiple shops can use
  different payment setups for each.
- The moment a cart converts into an order (`Carts::Checkout`), the shop's
  payment message + QR auto-post as the **first message** in that order's
  conversation, tagged `message_type: "system"` so clients can style it
  distinctly from anything either party typed. If a vendor hasn't configured
  payment info yet, checkout still succeeds — no auto-message posts, it's a
  soft gap, not a hard failure.
- From that point, "I've paid," a screenshot of the transfer, "where's my
  order," etc. all happen as ordinary chat messages in the same
  conversation. The vendor manually marks `Order#payment_status:
  marked_paid` once they've seen proof, based on their own judgment of
  what's in chat.
- **Order status and chat are two separate systems.** Status transitions
  (`placed → accepted → ...`) only ever happen through explicit
  button-driven API calls (`POST /orders/:id/transitions`), never inferred
  from chat message content. The app does not parse messages to decide
  anything.

## Consequences

- No payment gateway, no PCI scope, no transaction fees, no reconciliation
  logic — ever, in this design. This is a deliberate, permanent product
  boundary, not a phase-1 gap waiting to be filled in later.
- `payment_status` on `Order` is trust-based and vendor-asserted, not a
  verified fact the app can guarantee. This is consistent with the project's
  broader stance that trust/safety (vendor verification, ratings) is the
  real product wedge — the app's job is building accountability around
  people, not adjudicating money.
- Because the QR/message is shop-level config set once, a vendor's ongoing
  per-order effort drops to roughly zero for the payment step itself — the
  system message does the repetitive part.
- Chat becomes a strict, permanent record of *communication* only; the
  order's `status` and `order_status_events` remain the strict, permanent
  record of *state*. Neither system reads the other. This keeps the state
  machine's guarantees (only legal transitions, always logged, always
  attributable to an actor) intact regardless of what gets said in chat.
- If a scam pattern emerges around fake payment proof, the fix is expected
  to live in the trust/verification layer (ratings, vendor verification,
  blocklists — see the project's Notion build log and open decisions), not
  in this payment flow.

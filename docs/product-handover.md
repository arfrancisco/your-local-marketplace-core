# Product handover (original spec)

> **Historical document.** This is the product spec this repo grew from,
> preserved as written. **The current build diverges from it in several
> places** — most significantly, it assumes radius-based geographic
> discovery, which has been dropped entirely. Where this document and the
> ADRs in `docs/adr/` disagree, **the ADRs win.**
>
> Known divergences:
> - Geo/radius discovery (sections 6, 8, 9) — dropped, see ADR 0002
> - Cart (sections 6, 9, 12) — deferred, see ADR 0004
> - Order change requests/edits (sections 6, 9, 10) — deferred, see ADR 0005
> - Image storage — Cloudflare R2 rather than unspecified, see ADR 0006
>
> Source: Notion page "Hyperlocal Marketplace — Claude Code Handover",
> itself reconstructed from a 2026-07-08 product discussion. No separate
> original spec was saved.

---

## 1. Executive summary

Build a hyperlocal marketplace for neighborhood food vendors. Customers should be able to discover nearby shops, browse available items, place and adjust orders, communicate with the vendor inside the order, and rate the transaction. Vendors should be able to create and operate a shop, manage their catalog, control availability, receive and update orders, and communicate with customers.

The product should use one shared Ruby on Rails API backend. The previously discussed client direction was separate customer-facing and vendor-facing applications, with web clients in React and mobile clients in React Native for Android and iOS.

The first milestone should prove the entire core transaction loop with the smallest practical implementation:

1. Customer and vendor registration and verification
2. Vendor shop and item setup
3. Nearby discovery
4. Cart and order placement
5. Vendor acceptance and status updates
6. Per-order chat
7. Order completion and rating

## 2. Source confidence and decision labels

This document distinguishes between:

- **Recovered** — explicitly discussed in the original conversation
- **Proposed default** — added here to remove ambiguity and make the project buildable
- **Later** — valuable, but should not block the first proof of concept

Claude should preserve recovered requirements. Proposed defaults may be changed when the product owner makes a different decision.

## 3. Product goal

**Recovered**

Create a neighborhood-scale food marketplace where small local vendors can sell to nearby customers without each vendor needing to build a separate ordering system.

The system is both:

- a hyperlocal discovery marketplace
- an order-management and communication system

**Success for the proof of concept**

A vendor can register, verify their account, create a shop, publish items, and open the shop. A nearby customer can register, discover that shop, add items to a cart, place an order, chat with the vendor, receive status updates, complete the order, and leave a rating.

## 4. Product principles

1. One backend, multiple clients. Business rules live in the Rails API, not separately in every client.
2. Hyperlocal by design. Discovery and ordering depend on customer and shop location.
3. Availability must be truthful. A closed shop or disabled item should not accept new orders.
4. Orders are historical records. Item names, prices, quantities, and totals must be snapshotted when an order is placed.
5. Conversation is attached to the transaction. Chat belongs to an order, not to a generic public inbox.
6. Changes must be explicit. Order edits need an audit trail and customer/vendor agreement where appropriate.
7. Start with a complete thin slice. Do not build every marketplace feature before proving one order end to end.

## 5. Users and clients

### Recovered user roles

**Customer**

- Register with email and mobile number
- Complete email and mobile verification
- Set or choose a location
- Discover nearby vendors and food
- Browse shops and items
- Add items to a cart
- Place an order
- Chat inside the order
- Participate in order edits
- Track order status
- Rate the completed transaction

**Vendor**

- Register with email and mobile number
- Complete email and mobile verification
- Create and configure a shop
- Open or close the shop
- Create, update, enable, or disable items
- Add item price, photos, description, and tags
- Receive and manage orders
- Chat with the customer inside the order
- Propose or approve order edits
- Update fulfillment status

### Proposed supporting role

**Platform administrator**

A minimal admin interface should exist for development and operations. It should allow an authorized operator to inspect users, shops, items, orders, verification state, ratings, and reported problems. It does not need a polished standalone client in the first milestone.

### Recovered client direction

- Customer web application — React
- Customer mobile application — React Native for Android and iOS
- Vendor web application — React
- Vendor mobile application — React Native for Android and iOS
- Shared backend — Ruby on Rails API

### Proposed implementation sequence

Build the Rails API first, followed by responsive customer and vendor web clients. Add React Native clients after the API contracts and core workflows stabilize. Keep the API fully capable of supporting mobile from the beginning.

## 6. Recovered functional scope

**Authentication and verification**

- Customer and vendor registration
- Email verification
- Mobile verification
- Authenticated sessions for web and mobile
- Role-aware authorization

**Vendor shop management**

- Create a shop
- Store shop name, description, photos, contact details, and location
- Open or close the shop manually
- Expose only active/open shops to new customer orders

**Catalog management**

Each item supports: name, description, price, one or more photos, tags, enabled/disabled state, shop ownership.

A disabled item remains visible in historical orders but cannot be added to a new cart.

**Nearby discovery**

- Search for nearby shops and/or food
- Filter results by the customer's location and a service radius
- Exclude shops that cannot currently accept the order
- Allow keyword and tag-based matching

**Cart**

- One active cart per customer per shop
- Add, update, and remove items
- Calculate subtotal from current catalog prices
- Revalidate availability and price before checkout

**Orders**

- Create an order from a cart
- Snapshot ordered item details and prices
- Support vendor acceptance or rejection
- Track order status
- Preserve status history
- Allow controlled order edits
- Show totals and customer/vendor-visible notes

**Per-order chat**

- One private conversation tied to each order
- Customer and vendor messages
- Message timestamps and sender identity
- Unread state or last-read markers
- Messages remain available as part of the order history

**Ratings**

- Rating becomes available after completion
- Customer can rate the vendor/order
- Rating includes a numeric score and optional text
- Prevent duplicate ratings for the same order and reviewer

## 7. Proposed proof-of-concept boundaries

These defaults make the first build smaller and safer. They were not all explicitly decided in the original discussion.

**Payments** — Do not integrate card or wallet payments in the first proof of concept. Record a payment method such as cash/manual settlement and a payment status, but keep actual settlement outside the platform until the ordering workflow is validated.

**Fulfillment** — The platform does not need its own courier network in the first version. Support configurable fulfillment methods such as pickup or vendor-arranged delivery. The vendor and customer may use order chat for details that are not yet automated.

**Geography** — Use latitude/longitude and a configurable search/service radius. Do not hardcode a particular neighborhood or distance. PostgreSQL with PostGIS is preferred if available; a simpler distance calculation is acceptable for the first local prototype if isolated behind a location service.

**Shop hours** — Manual open/closed control is required. Scheduled business hours can be added later.

**Inventory** — Use item enabled/disabled availability in the first version. Exact stock quantities and ingredient-level inventory are later features.

**Promotions and fees** — No discounts, vouchers, marketplace commissions, vendor subscriptions, or dynamic delivery fees are required for the first proof of concept.

**Multi-vendor checkout** — A cart belongs to one shop. Do not support a single checkout containing items from multiple vendors.

## 8. Recommended technical architecture

**Backend**

- Ruby on Rails in API mode
- PostgreSQL
- PostGIS where practical for distance queries
- Redis for caching, Action Cable, and background-job coordination
- Sidekiq or the project's selected Rails-compatible job runner
- Active Storage for shop and item images
- JSON API endpoints under `/api/v1`
- Token-based authentication suitable for web and mobile
- Policy-based authorization, such as Pundit-style policies
- Action Cable or an equivalent channel for real-time order chat and order updates

**Frontend**

- React customer web application
- React vendor web application
- React Native customer and vendor mobile applications later
- A generated or shared API schema/client is preferred to reduce contract drift

**Deployment**

Keep the application deployable as separate services while remaining easy to run locally: Rails API, PostgreSQL/PostGIS, Redis, background worker, customer web client, vendor web client, object storage in production.

Use Docker Compose for local dependencies, but do not force the Rails development process itself into a container unless it improves the workflow.

**Observability**

From the beginning, log: request ID, authenticated actor, shop and order IDs where relevant, state transitions, failed authorization, verification attempts, background-job failures.

Add error reporting and basic health endpoints before public testing.

## 9. Suggested domain model

### Identity and profiles

**`users`**: id, email, mobile_number, password_digest or authentication-provider fields, email_verified_at, mobile_verified_at, status, last_signed_in_at, created_at, updated_at

A user may have a customer profile, vendor profile, or both. Authorization should be capability-based rather than assuming roles are permanently exclusive.

**`customer_profiles`**: id, user_id, display_name, default_address_id, created_at, updated_at

**`vendor_profiles`**: id, user_id, display_name, verification_status, created_at, updated_at

**`addresses`**: id, user_id nullable, label, recipient_name, mobile_number, address_line_1, address_line_2, barangay, city, province, postal_code, latitude, longitude, delivery_instructions, created_at, updated_at

### Shop and catalog

**`shops`**: id, vendor_profile_id, name, slug, description, contact_number, latitude, longitude, address fields or address_id, status (draft, active, suspended), accepting_orders boolean, fulfillment_methods, service_radius_meters, created_at, updated_at

**`shop_images`**: Use Active Storage attachments or a dedicated image record if ordering and metadata are required.

**`items`**: id, shop_id, name, description, price_cents, currency, enabled, position, created_at, updated_at

**`tags`**: id, name, slug

**`item_tags`**: item_id, tag_id

Item photos should use Active Storage with ordered attachments or a dedicated `item_images` join model.

### Cart

**`carts`**: id, customer_profile_id, shop_id, status (active, converted, abandoned), created_at, updated_at

Enforce at most one active cart for a customer/shop combination.

**`cart_items`**: id, cart_id, item_id, quantity, customer_note, created_at, updated_at

### Orders

**`orders`**: id, public_reference, customer_profile_id, shop_id, delivery_address_id nullable, fulfillment_method, status, subtotal_cents, delivery_fee_cents, total_cents, currency, payment_method, payment_status, customer_note, vendor_note, placed_at, accepted_at, completed_at, cancelled_at, created_at, updated_at

**`order_items`** (snapshot fields rather than relying on the live item record): id, order_id, item_id nullable, item_name, item_description, unit_price_cents, quantity, line_total_cents, customer_note, created_at

**`order_status_events`**: id, order_id, from_status, to_status, actor_user_id, reason, metadata, created_at

**`order_change_requests`**: id, order_id, proposed_by_user_id, status (pending, accepted, rejected, withdrawn), reason, proposed_snapshot or normalized child records, resolved_by_user_id, resolved_at, created_at, updated_at

For the first implementation, a JSON proposal snapshot is acceptable if the service layer validates it and accepted changes are copied into normalized order items with a complete audit event.

### Chat

**`conversations`**: id, order_id, created_at (one conversation per order)

**`messages`**: id, conversation_id, sender_user_id, body, message_type, metadata, created_at, edited_at nullable

**`conversation_reads`**: conversation_id, user_id, last_read_message_id nullable, last_read_at

### Ratings

**`ratings`**: id, order_id, reviewer_user_id, reviewee_type, reviewee_id, score, comment, created_at, updated_at

Add a uniqueness constraint preventing the same reviewer from rating the same order/reviewee twice.

### Verification

**`verification_challenges`**: id, user_id, channel (email, sms), purpose, code_digest, sent_to, expires_at, consumed_at, attempts_count, created_at

Never store plaintext one-time codes.

## 10. Order lifecycle

**Proposed initial state machine**

```
cart
  -> placed
  -> accepted
  -> preparing
  -> ready_for_pickup / out_for_delivery
  -> completed
```

Alternative terminal paths:

```
placed -> rejected
placed/accepted -> cancelled
```

Rules:

- Only an active, accepting shop can receive a newly placed order.
- Checkout revalidates item availability and current price inside a transaction.
- The vendor controls acceptance, preparation, and readiness states.
- The customer may request cancellation; whether it is automatic depends on the current state.
- Every state transition creates an `order_status_event`.
- Completion unlocks rating.
- Order edits after placement occur through an explicit change request or a narrowly defined service, never through arbitrary record mutation.

## 11. Key service objects

Keep controllers thin. Recommended services: `Authentication::RegisterUser`, `Verification::SendChallenge`, `Verification::ConsumeChallenge`, `Shops::Create`, `Shops::SetAcceptingOrders`, `Catalog::CreateItem`, `Discovery::NearbyShops`, `Carts::AddItem`, `Carts::Reprice`, `Orders::Place`, `Orders::TransitionStatus`, `Orders::RequestChange`, `Orders::ResolveChange`, `Messages::Send`, `Ratings::Create`.

`Orders::Place` should be the most carefully tested service. It should lock or re-read the cart and items, validate the shop, snapshot prices and names, calculate totals server-side, create the order and items atomically, convert the cart, create the initial status event, and initialize the order conversation.

## 12. API outline

Use RESTful JSON endpoints under `/api/v1`. Exact naming can evolve, but the first contract should cover:

**Authentication and profile**

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /verifications/email`
- `POST /verifications/email/confirm`
- `POST /verifications/mobile`
- `POST /verifications/mobile/confirm`
- `GET /me`
- `PATCH /me`

**Discovery and customer catalog**

- `GET /shops/nearby`
- `GET /shops/:slug`
- `GET /shops/:shop_id/items`
- `GET /tags`

**Vendor shop and catalog**

- `POST /vendor/shops`
- `GET /vendor/shops/:id`
- `PATCH /vendor/shops/:id`
- `POST /vendor/shops/:id/open`
- `POST /vendor/shops/:id/close`
- `POST /vendor/shops/:shop_id/items`
- `PATCH /vendor/items/:id`
- `POST /vendor/items/:id/enable`
- `POST /vendor/items/:id/disable`

**Cart and checkout**

- `GET /carts/current?shop_id=...`
- `POST /carts/:id/items`
- `PATCH /carts/:id/items/:cart_item_id`
- `DELETE /carts/:id/items/:cart_item_id`
- `POST /carts/:id/checkout`

**Orders**

- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/cancel`
- `POST /orders/:id/change_requests`
- `POST /orders/:id/change_requests/:change_request_id/accept`
- `POST /orders/:id/change_requests/:change_request_id/reject`
- `GET /vendor/orders`
- `POST /vendor/orders/:id/accept`
- `POST /vendor/orders/:id/reject`
- `POST /vendor/orders/:id/status`

**Messages and ratings**

- `GET /orders/:order_id/messages`
- `POST /orders/:order_id/messages`
- `POST /orders/:order_id/ratings`

WebSocket channels may supplement message and order endpoints but should not replace durable HTTP APIs.

## 13. Authorization rules

At minimum:

- A customer can access only their own carts and orders.
- A vendor can manage only shops they own.
- A vendor can access only orders placed with their shops.
- Only order participants can read or send messages in the order conversation.
- Only valid actors may perform a status transition.
- A rating requires a completed order and participation by the reviewer.
- Admin access is explicit and audited.

Test authorization as a matrix, not only through happy-path controller specs.

## 14. Validation and edge cases

The first implementation must handle:

- Shop closes while a customer has items in a cart
- Item is disabled after it was added to a cart
- Item price changes before checkout
- Customer moves outside the service radius
- Duplicate checkout request caused by retry or double-click
- Vendor accepts the same order twice
- Unauthorized user attempts to read order messages
- Verification code expires or is guessed repeatedly
- Order change modifies totals
- Customer or vendor cancels during an invalid state
- Image upload fails after a catalog record is created

Use idempotency keys for order placement if practical. At minimum, enforce server-side safeguards against duplicate conversion of the same cart.

## 15. Security and privacy requirements

- Normalize and uniquely index email and mobile values
- Rate-limit authentication and verification endpoints
- Hash verification codes
- Never trust client-calculated totals or distances
- Validate uploads by type and size
- Do not expose exact customer address before it is needed by the vendor for an accepted order
- Avoid logging message bodies, passwords, verification codes, or full addresses
- Audit sensitive admin actions
- Use secure token storage patterns appropriate to each client

## 16. Testing strategy

**Backend**

- Model and validation specs for invariants
- Service specs for checkout, status transitions, edits, chat authorization, and ratings
- Request specs for API contracts and authorization
- State-machine transition matrix tests
- Geospatial query tests with deterministic fixtures
- Background-job tests for notifications and image processing

**Frontend**

- Component tests for catalog, cart, and order state UI
- API contract/error handling tests
- End-to-end happy path: vendor registers and publishes an item; customer discovers the shop; customer places an order; vendor accepts and updates status; both sides exchange a message; order completes; customer leaves a rating

**CI**

Run backend tests, frontend tests, linting, schema/contract checks, and one end-to-end smoke test on every pull request.

## 17. Recommended repository structure

A monorepo is reasonable for the proof of concept:

```
hyperlocal-marketplace/
  README.md
  docs/
    product-handover.md
    adr/
  apps/
    api/                 # Rails API
    customer-web/        # React
    vendor-web/          # React
    customer-mobile/     # React Native, later
    vendor-mobile/       # React Native, later
  packages/
    api-client/
    shared-types/
    ui/                  # only if genuinely shared
  docker-compose.yml
```

A Rails-first repository with frontend directories is also acceptable. Prefer the structure that lets the product owner run and understand the system with the least ceremony.

## 18. Development milestones

**Milestone 0 — Project foundation**

- Scaffold Rails API and PostgreSQL
- Add authentication and authorization foundation
- Configure Active Storage, Redis, and background jobs
- Add API versioning, error format, health check, CI, and seed strategy
- Add architecture decision records

Acceptance: The app boots locally, CI passes, and a verified test user can authenticate.

**Milestone 1 — Vendor can publish a shop**

- Vendor profile
- Shop creation and location
- Open/closed state
- Item CRUD, images, tags, enable/disable
- Minimal vendor web UI

Acceptance: A vendor can create an open shop with at least one orderable item.

**Milestone 2 — Customer can discover and build a cart**

- Customer profile and address/location
- Nearby shop query
- Shop/catalog page
- Single-shop cart
- Availability and price revalidation
- Minimal customer web UI

Acceptance: A nearby customer can find the shop and create a valid cart.

**Milestone 3 — Complete order loop**

- Checkout transaction
- Order snapshots
- Vendor order queue
- Acceptance/rejection
- Status history and updates
- Cancellation rules

Acceptance: The customer can place an order and the vendor can take it through completion.

**Milestone 4 — Chat, edits, and ratings**

- Per-order conversation
- Real-time updates or polling fallback
- Order change requests and audit trail
- Completion rating
- Notifications

Acceptance: Both parties can resolve an order through chat, safely change it, complete it, and record a rating.

**Milestone 5 — Mobile clients and pilot hardening**

- React Native clients using the same API
- Push notifications
- Error reporting and operational dashboards
- Admin inspection tools
- Pilot data and privacy review

## 19. Explicit non-goals for the first proof of concept

- Integrated online payments
- Platform-owned courier dispatch
- Multi-vendor checkout
- Advanced inventory management
- Promotions, vouchers, loyalty, or subscriptions
- Marketplace commission and vendor payout accounting
- Recommendation algorithms
- Public social feeds
- Complex dispute-resolution workflows
- Multi-region scaling

These can be revisited after the order loop works with real users.

## 20. Open product decisions

Do not block initial backend scaffolding on these, but record them in `docs/open-decisions.md`:

1. Exact target neighborhood or initial pilot area
2. Default and maximum service radius
3. Pickup, vendor delivery, or both for the pilot
4. Cancellation policy by order state
5. Whether vendors may edit accepted orders directly or must always request customer approval
6. Whether vendors need business verification before publishing
7. Rating direction: customer-to-vendor only or mutual ratings
8. Required notification channels: email, SMS, push, in-app
9. Currency and tax/receipt requirements
10. Whether one user may operate multiple shops

## 21. Definition of done for the initial proof of concept

The proof of concept is done when:

- A vendor account can be created and verified
- The vendor can publish an open, located shop and an enabled item
- A customer account can be created and verified
- The customer can set a location and discover the shop within its service radius
- The customer can build a single-shop cart and place an order
- Prices and item details are snapshotted server-side
- The vendor can accept the order and progress it through valid statuses
- The customer and vendor can exchange private order messages
- An order edit can be proposed, accepted/rejected, and audited
- The completed order can be rated once
- Unauthorized access is blocked by automated tests
- The full flow works in a deployed staging environment

## 22. Direct kickoff prompt for Claude Code

Use the following as the initial instruction to Claude Code:

> Build a proof of concept for a hyperlocal neighborhood food marketplace. Use one Ruby on Rails API backend with PostgreSQL, and design the API for separate customer and vendor web/mobile clients. The recovered product scope includes customer and vendor registration with email and mobile verification; vendor shop setup; manual open/close control; nearby shop and food search; catalog items with price, photos, description, tags, and enable/disable state; a single-shop cart; order placement and status tracking; per-order private chat; controlled order edits; and ratings after completion.
>
> Start with a Rails API and responsive React customer and vendor web clients. Keep the contracts suitable for future React Native Android and iOS clients. Implement the project as a complete thin slice rather than a collection of disconnected screens. The first end-to-end goal is: vendor registers and publishes an open shop with one item; nearby customer discovers it and places an order; vendor accepts and progresses the order; customer and vendor chat; the order completes; customer leaves a rating.
>
> Use server-side pricing, geospatially aware discovery, immutable order-item snapshots, an explicit order state machine, status-event history, policy-based authorization, and audited order changes. Keep controllers thin and implement checkout/status changes in service objects. Use Active Storage for images, Redis plus a background-job runner, and Action Cable or an equivalent for real-time chat and order updates. Add request specs, service specs, authorization matrix tests, and one end-to-end smoke test. Do not add integrated payments, courier dispatch, multi-vendor checkout, promotions, or advanced inventory in the first proof of concept.
>
> Before writing substantial code, create `README.md`, `docs/product-handover.md`, `docs/open-decisions.md`, initial ADRs, a proposed database schema, API endpoint outline, and a milestone plan. Then implement Milestone 0 and Milestone 1. Make reasonable defaults where the handover labels a decision as proposed, document those defaults, and do not silently treat them as recovered product requirements.

## 23. First Claude Code task

After providing this handover, ask Claude Code to do only the following first:

1. Inspect the repository and report its current state.
2. Propose the monorepo or Rails-first structure.
3. Write the architecture and open-decision documents.
4. Produce the initial ERD and migration plan.
5. Define the API error format, authentication approach, authorization approach, and order state machine.
6. Produce a commit-sized plan for Milestone 0 and Milestone 1.
7. Stop for review before implementing beyond the approved plan.

This gives Claude enough direction to be useful while keeping major product and architecture choices reviewable.

# Lesson 4 — What you're allowed to do: authorization

> Part 4 of 11. Previous: [Identity and authentication](03-identity-and-auth.md) · Next: [The data model](05-data-model.md)

## Why this matters

Authorization bugs are the ones that end betas. This codebase gets it right
in a specific way that is worth understanding rather than trusting: it uses
**three different enforcement layers** depending on the shape of the rule,
and knowing which layer owns which rule tells you where to look when
something is wrong — and where to add a rule so it cannot be bypassed.

## The lesson

### Layer 1: Pundit policies, default-deny

Five policy files, all short. The base is the important one:

```ruby
class ApplicationPolicy
  attr_reader :user, :record

  def index?    = false
  def show?     = false
  def create?   = false
  def new?      = create?
  def update?   = false
  def edit?     = update?
  def destroy?  = false

  class Scope
    def resolve
      raise NoMethodError, "#{self.class} must implement #resolve"
    end
  end
end
```

**Everything is `false` until a subclass opts in**, and a `Scope` that
forgets to implement `resolve` raises rather than silently returning
everything. Default-deny means the failure mode of forgetting something is
a locked door, not an open one.

### Ownership is always a walk to the user id

Every policy in this codebase resolves permission the same way: traverse
from the record to the owning `User` and compare ids. There is no shared
`Ownable` mixin — the walk is just written out each time, which is
consistent with the repo's preference for duplication over abstraction.

```ruby
# ShopPolicy
def owner? = record.vendor_profile.user_id == user.id

# ItemPolicy — one hop further
def owner? = record.shop.vendor_profile.user_id == user.id

# ConversationPolicy — either side of the order
def participant?
  order = record.order
  (user.customer_profile.present? && order.customer_profile.user_id == user.id) ||
    (user.vendor_profile.present? && order.shop.vendor_profile.user_id == user.id)
end
```

Notice `ConversationPolicy` checks `user.customer_profile.present?` before
dereferencing it. That guard is necessary precisely because identity is
capability-based — a vendor-only user has a nil `customer_profile`, and
without the guard the check would raise instead of returning false.

### The interesting one: OrderPolicy

```ruby
class OrderPolicy < ApplicationPolicy
  def show?       = customer_owner? || vendor_owner?
  def transition? = customer_owner? || vendor_owner?
  # Only the vendor marks payment received — it's their judgment call based
  # on what they see in chat (ADR 0009), not something a customer asserts.
  def mark_paid?  = vendor_owner?
  # Vendor-initiated only — the customer is told via chat, not self-service.
  def update_items? = vendor_owner?
end
```

An order has **two** owners, and the policy says so. This is what lets one
controller serve both roles.

### Why there is no vendor/orders namespace for detail actions

Compare how shops and orders are routed:

- **Shops and items** live in a `namespace :vendor` — only vendors touch
  them, so a separate namespace with a `Vendor::BaseController` that
  requires a vendor profile is the natural fit.
- **Orders and conversations** are *not* namespaced for detail actions,
  because both a customer and a vendor legitimately act on the same order.
  `OrderPolicy`/`ConversationPolicy` already unify that ownership check, so
  duplicating a controller per role would mean two copies of the same logic
  diverging over time.

Only the **list** endpoints differ, because "my orders" genuinely means two
different queries:

```
GET /orders          → the current customer's own orders
GET /vendor/orders   → the current vendor's shop orders
```

`routes.rb` spells this reasoning out where the routes are drawn. It is a
good example of a comment earning its place.

### Layer 2: controller-level rules the policy cannot express

A Pundit policy answers "may this user act on this record." It cannot
easily answer "may this user make *this particular* move." So one rule
lives in the controller:

```ruby
def transition
  to_status = params.require(:to_status)
  if customer_actor? && to_status != "cancelled"
    raise ApiError::Forbidden, "Customers may only cancel an order"
  end

  order = Orders::TransitionStatus.new(...).call
  ...
end
```

**A customer may only ever request `cancelled`.** Accepting, preparing,
marking ready, completing — all vendor-only. `OrderPolicy#transition?`
returns true for both sides because both sides do legitimately transition
orders; the narrower rule about *which* transitions is enforced one layer
up.

This gives you a three-way split for a transition request, and knowing it
makes debugging fast:

| Question | Enforced by | Failure |
|---|---|---|
| Do you own this order? | `OrderPolicy#transition?` | 403 `forbidden` |
| Are you allowed to make *this* move? | `OrdersController#transition` | 403 `forbidden` |
| Is the move legal from the current state? | `Orders::TransitionStatus` | 422 `unprocessable_entity` |

The service deliberately does **not** know who is allowed to do what. Its
own comment says so:

```ruby
# Which actor may call which transition is enforced by the controller's
# Pundit check (OrderPolicy), not here; this only enforces the state
# machine itself (Order::TRANSITIONS).
```

Separating "is this move legal" from "may this actor make it" is what keeps
both pieces testable in isolation.

### Layer 3: query scoping, where there is nothing to authorize

The strongest form of authorization is making the unauthorized thing
unreachable. Two places do this.

**Private vendor notes.** A vendor can keep private notes about a customer.
Another vendor must never see them, even about the same customer. Rather
than a policy, the controller carries a security comment and a hard
convention:

```ruby
# SECURITY: every action reaches notes through
# `current_vendor_profile.vendor_customer_notes`. That scoping is the
# entire privacy boundary for this feature — there is deliberately no
# code path here that queries VendorCustomerNote unscoped.
```

There is no `VendorCustomerNotePolicy` because there is no query that could
return the wrong row. A policy protects a reachable object; scoping makes it
unreachable.

Note the deliberate choice of status code: a cross-vendor id **404s**, not
403s. Returning 403 would confirm the record exists, which is itself a leak.
The same convention is used by `ItemsController`.

**Cart items.** Same pattern:

```ruby
# Scoped through the customer's own carts, so another customer's cart_item
# id simply 404s rather than leaking whether it exists.
def set_cart_item
  @cart_item = CartItem.joins(:cart)
    .where(carts: { customer_profile_id: customer_profile.id })
    .find(params[:id])
end
```

**Discovery.** A third, quieter instance: `Shop.listed` is used everywhere
customers look up a shop, so a draft or closed shop 404s as if it does not
exist:

```ruby
# A shop that is not open simply does not exist as far as discovery is
# concerned (404), the same as an unknown slug.
def find_listed_shop!
  Shop.listed.find_by!(slug: params[:slug])
end
```

### Profile requirements: the fourth, cheapest check

Before ownership even comes up, some endpoints need the user to have the
right *kind* of profile at all. `Vendor::BaseController`:

```ruby
class BaseController < Api::V1::BaseController
  before_action :require_vendor_profile

  def require_vendor_profile
    raise ApiError::Forbidden, "A vendor profile is required for this action" if current_vendor_profile.nil?
  end
end
```

`CartController` and `OrdersController#index` do the customer equivalent.
The point is a clear 403 with a useful message instead of a confusing empty
result — the cart controller's comment: "a vendor-only user gets a clear
403 rather than a confusing empty cart."

### The admin side: no Pundit at all

`Api::V1::Admin::BaseController` deliberately does not use Pundit:

```ruby
# Pundit is still deliberately not used here: every authenticated admin has
# the same authorization level, there's nothing finer-grained to express
# once authenticate_admin! passes.
```

There are no admin roles. Authentication *is* authorization on that surface.

What the admin base *does* add is the audit trail, as a single
`around_action` covering all 16+ admin controllers:

```ruby
def record_audit_log
  yield
  write_audit_log(response.status) if mutating_request?
rescue StandardError => e
  write_audit_log(exception_status_code(e)) if mutating_request?
  raise
end
```

Four details worth noticing:

1. **Only mutating requests** (`POST/PATCH/PUT/DELETE`) are logged. Reads
   are deliberately not: the question is "who did this," not "who looked."
2. **The rescue branch matters.** If the action raises and `ErrorHandling`
   converts it to a 422, the log records 422 — not the 200 the response
   object still carries mid-unwind. `exception_status_code` maps each
   exception class to the status it will actually render as.
3. **Logging never breaks the request.** `write_audit_log` rescues and logs
   to stderr. An audit failure must not become a user-facing failure.
4. **`resource_type` is inferred** from the controller name via
   `controller_name.classify`, "approximate on purpose."

Login itself is never attributed — `SessionsController#create` skips
`authenticate_admin!`, so there is no admin to attribute it to yet.

### Where errors come out

All of these raise; none of them render. `ErrorHandling` maps the exception
to the standard envelope (lesson 10):

| Raised | Status | `code` |
|---|---|---|
| `Pundit::NotAuthorizedError` | 403 | `forbidden` |
| `ApiError::Forbidden` | 403 | `forbidden` |
| `ActiveRecord::RecordNotFound` | 404 | `not_found` |
| `ApiError::UnprocessableEntity` | 422 | (per error) |

Note that a Pundit failure and a hand-raised `ApiError::Forbidden` are
indistinguishable to the client. That is intentional.

## Walkthrough: four ways to fail one request

`POST /api/v1/orders/42/transitions` with `to_status: "completed"`.

**A vendor who does not own shop 42's shop.** `set_order` calls
`authorize @order` → `OrderPolicy#transition?` → `vendor_owner?` is false,
`customer_owner?` is false → `Pundit::NotAuthorizedError` → **403
`forbidden`**. Note the order is found first, then authorized; the 404-vs-403
distinction is not applied here because order ids are not enumerable in the
same way.

**The order's own customer.** Policy passes (`customer_owner?`). Then the
controller's rule fires: `to_status != "cancelled"` → `ApiError::Forbidden`
→ **403 "Customers may only cancel an order."**

**The correct vendor, order still `placed`.** Policy passes, controller rule
does not apply. `Orders::TransitionStatus` checks
`can_transition_to?("completed")` — `placed` only allows
`accepted`/`rejected`/`cancelled` → **422 "Cannot move an order from placed
to completed."**

**The correct vendor, order `ready_for_pickup`.** All three layers pass. The
transition runs in a transaction, the status event is written, and a system
message posts to chat.

## Common misconceptions

**"Pundit protects everything."** Three of the most sensitive boundaries —
vendor notes, cart items, unlisted shops — are enforced by query scoping
with no policy at all.

**"`OrderPolicy#transition?` returning true means a customer can complete an
order."** No. The policy is ownership-only; the controller separately
restricts customers to `cancelled`.

**"A 404 means it does not exist."** On scoped lookups it may exist and
belong to someone else. That ambiguity is the point.

**"Admins have roles."** They do not. Every authenticated admin is fully
privileged; the audit log is the accountability mechanism instead.

**"Read access is audited."** Only mutations are.

## Exercises

**1.** You add `GET /api/v1/vendor/payouts`. What do you inherit for free by
subclassing `Vendor::BaseController`, and what must you still do?

<details><summary>Answer</summary>

Free: authentication (`authenticate!` from `Api::V1::BaseController`) and
the vendor-profile requirement, plus `current_vendor_profile`. Still
yours: scoping the query through `current_vendor_profile` so one vendor
cannot read another's payouts — the profile check proves they are *a*
vendor, not that they own the records.
</details>

**2.** Vendor A requests vendor B's private note about a shared customer.
What status, and why that one?

<details><summary>Answer</summary>

404. The lookup goes through
`current_vendor_profile.vendor_customer_notes`, so the row is simply not in
scope and `find` raises `RecordNotFound`. 404 rather than 403 on purpose:
403 would confirm the note exists, which is itself a disclosure.
</details>

**3.** Why does `ConversationPolicy#participant?` check
`user.customer_profile.present?` before comparing ids?

<details><summary>Answer</summary>

Because identity is capability-based, a vendor-only user has a nil
`customer_profile`. Without the guard, `user.customer_profile.user_id`
would raise `NoMethodError` on nil — which `ErrorHandling` would turn into
a 500 instead of a clean 403.
</details>

**4.** An admin's PATCH returns 422. What status does the audit log record,
and what would a naive implementation have recorded?

<details><summary>Answer</summary>

422. `record_audit_log` rescues the exception and calls
`exception_status_code`, which maps `ActiveRecord::RecordInvalid` to 422. A
naive `yield` then `response.status` would record 200, because the response
object has not been finalized while the exception is still unwinding.
</details>

**5.** Where would you add a rule that a shop cannot be opened until its
vendor profile is verified?

<details><summary>Answer</summary>

`ShopPolicy#open?` if you frame it as a permission, or `Shop#open!` /
a service if you frame it as a business rule. Given the repo's convention
that business rules live in services and the API rather than policies, and
that the same rule must hold for a future mobile client, the service or
model layer is the better fit — with the policy staying about ownership.
Note this is currently **open decision #5**: nothing gates shop creation on
`verification_status` today.
</details>

## Recap

- `ApplicationPolicy` is **default-deny**; every permission is false until
  opted into, and an unimplemented `Scope#resolve` raises.
- Every ownership check **walks to the `User` id**, written out per policy
  rather than abstracted.
- `OrderPolicy` recognizes **two owners** per order, which is why one
  controller pair serves both customer and vendor; only list endpoints
  differ.
- Authorization is split across **three layers**: policy (do you own it),
  controller (may you make this specific move), service (is the move legal).
- The strongest boundaries are **query scopes**, not policies — vendor
  notes, cart items, unlisted shops — and they return **404, not 403**, so
  existence is never confirmed.
- The **admin surface uses no Pundit** (all admins are equal) and instead
  writes an `AdminAuditLog` row for every mutating request, recording the
  status it will actually render, never breaking the request if logging
  fails.

---

Next: [Lesson 5 — The data model and the snapshot rule](05-data-model.md)

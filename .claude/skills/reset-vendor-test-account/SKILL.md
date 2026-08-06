---
name: reset-vendor-test-account
description: >
  Reset a local customer account back to "no vendor_profile yet" so the
  become-a-vendor upgrade flow and vendor onboarding tour can be tested
  again from a clean start, without registering a brand-new account each
  time. Use this whenever the user wants to retest "become a vendor",
  vendor onboarding, or the onboarding tour's replay path locally, and an
  account (typically the seeded customer@example.com) already has a shop
  from a previous test pass. Local dev / seeded data only — never run this
  against production. Written 2026-08-06.
---

# Reset a local account for retesting the become-a-vendor flow

## What this resets

`VendorProfile#destroy` cascades via `dependent: :destroy` through the full
vendor side of the data model — confirmed in `app/models/vendor_profile.rb`
and `app/models/shop.rb`:

```
vendor_profile
  -> shops         (has_many, dependent: :destroy)
       -> items        (dependent: :destroy)
       -> carts         (dependent: :destroy)
       -> orders        (dependent: :destroy)
       -> ratings (as reviewee) (dependent: :destroy)
  -> vendor_customer_notes (dependent: :destroy)
```

Destroying the `vendor_profile` is enough — everything under it goes with
it in one call, no manual cleanup of shops/items/orders needed. The
`customer_profile` and the `User` row itself are untouched, so login,
address, and residency/verification state all survive the reset.

## Steps

1. **Never do this against production.** This is a destructive delete —
   confirm you're pointed at the local DB (`dotenv bin/rails runner` from
   `apps/api`, not `railway connect Postgres` / `railway run`).

2. **Inspect before destroying**, so you know what you're about to remove
   and can tell the user what shop/items are going away:
   ```bash
   cd apps/api
   dotenv bin/rails runner '
   u = User.find_by(email: "customer@example.com")
   vp = u&.vendor_profile
   if vp
     shop = Shop.find_by(vendor_profile_id: vp.id)
     puts "vendor_profile ##{vp.id}, shop: #{shop&.name.inspect}"
   else
     puts "already has no vendor_profile"
   end
   '
   ```

3. **Destroy the vendor profile**:
   ```bash
   dotenv bin/rails runner '
   u = User.find_by(email: "customer@example.com")
   u.vendor_profile&.destroy!
   u.reload
   puts "vendor_profile now: #{u.vendor_profile.inspect}"
   '
   ```
   Swap the email for whatever account the user is actually testing with —
   `customer@example.com` is just the usual seeded default, not hardcoded
   behavior.

4. **Tell the user what's still true after the reset**, so they don't
   waste a test run rediscovering it:
   - If they're testing in a real browser against local dev servers (not
     e2e), remind them of the cross-origin gotcha already documented in
     `local-dev-setup`'s symptom table: clicking "Become a vendor" /
     "Start selling" locally does a full-page nav from customer-web
     (`:5173`) to vendor-web (`:5174`), and `localStorage` doesn't carry
     across that origin split in dev the way it does in production (one
     origin there). They'll land on vendor-web's bare `/login`, need to
     log back in with the same account, then manually navigate to
     `/onboarding` (vendor-web's login always redirects to `/shops`, not
     back to the tour).
   - Any in-progress uncommitted code changes to the become-a-vendor flow
     or onboarding tour are local-only until shipped — say so explicitly
     if that's the state (check git status / recent conversation context)
     so "is it fixed?" gets an accurate answer, not just "yes" from having
     just edited the code.

## Why destroy the vendor_profile instead of other resets

- **Not `User.destroy` / re-registering**: throws away verified email/
  mobile status, residency, address, and any orders placed as a customer
  — usually more state loss than the user actually wants for "let me
  retest becoming a vendor."
- **Not manually deleting the `Shop` row alone**: `Shop` validates
  `vendor_profile_id` uniqueness (`app/models/shop.rb`), so a leftover
  `vendor_profile` with no shop would just hit that same uniqueness
  constraint again on the next onboarding attempt — the eligibility check
  cares about `vendor_profile` existing, not the shop.
- **Not resetting `demo` flags or any other column**: `demo?` is derived
  from the user's seed origin (see `docs/adr/` on the demo-flag work) and
  is unrelated to vendor eligibility — leave it alone.

# Privacy Policy

**Effective date:** Upon beta launch (date to be confirmed)
**Last updated:** 2026-08-01

Alain Roy Francisco, doing business as KapitMarket PH ("we," "us,"
"our"), of Prisma Residences, Pasig City, Philippines, operates
KapitMarket PH (the "Service"), a hyperlocal marketplace connecting
vendors and customers within a small cluster of nearby buildings.
KapitMarket PH is currently
in a closed or limited beta / pilot phase — see the Terms and
Conditions, Section 1, for what that means. This policy explains what
personal data we collect, why, who sees it, and the rights you have over
it, in line with the Philippines' Data Privacy Act of 2012 (RA 10173) and
its implementing rules.

By using the Service you acknowledge this policy. Where we ask for
consent for a specific purpose (like marketing), we ask separately and
you can withdraw it at any time as described below.

## 1. What we collect

We collect only what the Service needs to work, plus what you choose to
add. Concretely, today, that's:

**Account**
- Email address (required)
- Mobile number (required at signup)
- Password (stored as a one-way cryptographic hash — we never store or
  can see your actual password)
- Display name
- Account status and last-sign-in time

**Verification**
- One-time codes sent to your email or mobile to confirm you own that
  address/number. We store only a hash of the code, never the plaintext,
  and it expires after 10 minutes.

**Customer profile and delivery**
- Display name
- Delivery address(es): recipient name, building, unit, a contact mobile
  number, and any delivery instructions or notes you add. This is
  building/unit-level information for a short-distance handoff — we do
  not collect GPS coordinates or run any location/mapping feature (see
  ADR 0002 in the project's technical decisions — there's deliberately no
  geo-discovery in this product).
- Residency status: whether you've told us you're a resident/tenant of
  the community, and, if so, whether you're willing to be verified as
  one. Both start as self-reported answers you give at signup, and
  answering "no" to either does not restrict your use of the Service.
  If you tell us you're a resident, an administrator may review and mark
  that claim as verified or rejected; until that review happens, your
  status is "pending," not confirmed.

**Vendor profile and shop**
- Display name, verification status
- Shop name, description, address, contact number, opening message, shop
  photos
- Your payment instructions text and payment QR code image, which you
  provide and control (for example, GCash or bank transfer details) —
  this is your own payment information that you're choosing to publish
  to customers who order from you, not something we collect for our own
  use

**Orders and items**
- Items you list (name, description, price, photos)
- Orders placed: items, quantities, price at the time of the order
  (prices are snapshotted into the order and never changed retroactively,
  so your order history stays accurate to what actually happened),
  fulfillment method, any note you add, and the order's status history
  (who changed what, and when)
- Payment status as asserted by the vendor — this is not a fact we
  independently verify (see the Terms and Conditions, Section 6)

**Vendor notes about you**
- If you order from a vendor, that vendor may write and keep a private
  note about you (for example, noting a no-show), visible to them on any
  future order you place with that vendor. These notes are never shown to
  you and are not visible to any other vendor — only to the vendor who
  wrote it and to us, for moderation and support.

**Chat**
- Messages (text and, optionally, one image per message) within a
  specific order's conversation, visible only to the customer and vendor
  on that order, plus a record of when each of you last read the thread

**Technical**
- API access tokens (stored as a hash, not the raw token), with an
  expiry and last-used time, used to keep you signed in
- Standard request/server logs used for security and abuse prevention
  (for example, rate-limiting to stop brute-force login attempts);
  sensitive fields like passwords and tokens are stripped from logs
  before they're written

We do not currently collect precise location, run analytics or
advertising trackers, or use tracking cookies. Your sign-in is kept via a
token stored in your browser's local storage, not a cookie, and isn't
used to track you across other sites.

## 2. Why we use it (purposes)

- **To create and secure your account** — authenticate you, verify you
  own the email/mobile you gave us, keep your session, prevent
  unauthorized access.
- **To operate the marketplace** — show vendors their shops and orders,
  show customers shops and items, connect a specific order between one
  customer and one vendor, and share only what that transaction needs:
  the vendor sees the delivery address and contact number for their own
  order, the customer sees that vendor's shop and payment details. Users
  don't see each other's information outside of shared orders.
- **To enable per-order chat** so a customer and vendor can coordinate
  pickup/delivery and share things like payment proof, without us
  reading or acting on the content beyond storing and delivering it.
- **For trust and safety** — vendor verification status, ratings, rate
  limiting and abuse prevention, investigating reports, and suspending
  accounts that violate our Terms.
- **For service communications** — order status updates, verification
  codes, and other messages necessary to the transaction you're part of.
  These aren't optional while you have an active order; they're how the
  Service functions.
- **For marketing (planned, not yet active)** — we intend to eventually
  send product updates and promotional messages to the email and/or
  mobile number on your account. We have not built this yet. When we do,
  it will be opt-in and separate from the consent you give to just use
  the Service: we'll ask you to check a distinct box (unchecked by
  default), and every marketing email or SMS will include a clear way to
  opt out (unsubscribe link, or reply STOP for SMS). Opting out of
  marketing never affects the transactional messages your orders need.
- **To comply with the law** and to establish, exercise, or defend legal
  claims.

We don't sell your personal data to third parties, and we don't use it
for third-party advertising.

## 3. Who we share it with

- **Other users, scoped to what a transaction needs.** A vendor sees a
  customer's delivery details only for orders placed with that vendor. A
  customer sees a vendor's shop and payment details because the vendor
  chose to publish them. Chat is visible only to the two people on that
  order. Vendor notes about you (see above) go the other direction only —
  a vendor's note is visible to that vendor, never to you or to any other
  vendor.
- **Service providers who process data on our behalf**, under
  confidentiality and data protection obligations:
  - **Cloudflare R2** — stores uploaded images (shop photos, item photos,
    chat images, payment QR codes).
  - **Railway** — hosts our application servers.
  - An **email/SMS delivery provider** we haven't selected yet, which
    will send verification codes and (once built) marketing messages.
    We'll update this policy to name it once chosen.
- **Legal and safety** — if required by law, court order, or to protect
  the rights, property, or safety of our users or the public.
- **Business transfers** — if we're ever involved in a merger,
  acquisition, or sale of assets, personal data may be transferred as
  part of that deal, subject to this policy or a successor policy you're
  notified of.

We do not currently use any third-party analytics or advertising
services.

## 4. Where your data is stored

Our servers and storage providers may be located outside the
Philippines. Where that's the case, we take reasonable steps to ensure
your data continues to receive a comparable level of protection,
consistent with RA 10173's requirements for cross-border data transfers.

## 5. How long we keep it

- **Order and chat history** is kept as a historical record — it's the
  basis for ratings, dispute resolution, and accountability between
  users, so we don't alter or delete it just because an order is old.
- **Account data** is kept while your account is active.
- If you request account deletion, we deactivate your account and remove
  or anonymize personal data that isn't needed for a legal or legitimate
  business reason (for example, we may keep a minimal record of past
  orders for fraud prevention or legal compliance, but strip it of
  unnecessary personal detail where we can).
- **Verification codes** expire in 10 minutes and are not usable after
  that; expired/consumed codes may still be retained briefly in hashed
  form for abuse investigation.

## 6. Your rights

Under the Data Privacy Act, you have the right to:

- Be informed that your data is being processed (this policy)
- Access your personal data
- Object to processing, including to withdraw consent (for example, for
  marketing, once that's built)
- Correct inaccurate data
- Request erasure or blocking of data, subject to legal retention needs
- Data portability, where applicable
- Be indemnified for damages from a violation of your rights
- File a complaint with the **National Privacy Commission** (NPC) if you
  believe we've mishandled your data

To exercise any of these, contact us at team.kapitmarket@gmail.com. We'll respond
within a reasonable time and consistent with what the law requires.

## 7. Security

- Passwords are hashed, never stored or logged in plaintext.
- Verification codes and API access tokens are stored as hashes, not raw
  values.
- Sensitive request parameters (passwords, tokens, secrets) are stripped
  from application logs.
- We rate-limit authentication and other sensitive endpoints to reduce
  brute-force and abuse risk.
- Uploaded images are restricted by file type and size before they're
  accepted.

No system is perfectly secure, and we can't guarantee absolute security,
but we design for it deliberately rather than as an afterthought.

## 8. Children

The Service is not intended for anyone under 18. We don't knowingly
collect data from minors. If you believe a minor has an account, contact
us at team.kapitmarket@gmail.com and we'll investigate and remove it if confirmed.

## 9. Changes to this policy

We'll post updates here with a new "Last updated" date. For material
changes to how we use your data (for example, when we launch marketing
messaging), we'll ask for the specific consent that requires, rather
than relying on this policy alone.

## 10. Contact us

Questions, requests, or complaints about your personal data:
team.kapitmarket@gmail.com, Prisma Residences, Pasig City, Philippines.

If you're not satisfied with our response, you may lodge a complaint
with the National Privacy Commission of the Philippines
(https://www.privacy.gov.ph).

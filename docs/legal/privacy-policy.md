# Privacy Policy

**Effective date:** Upon beta launch (date to be confirmed)
**Last updated:** 2026-08-04

KapitMarket PH ("we," "us," "our"), a sole proprietorship based in Pasig
City, Philippines, operates KapitMarket PH (the "Service"), a hyperlocal
marketplace connecting vendors and customers within a small cluster of
nearby buildings. KapitMarket PH is currently in a closed or limited beta
/ pilot phase. See the Terms and Conditions, Section 1, for what that
means.

This policy explains what personal data we collect, why, who sees it, and
the rights you have over it, in line with the Philippines' Data Privacy
Act of 2012 (RA 10173) and its implementing rules and regulations.

We are the Personal Information Controller for the data described here.
Privacy questions, requests, and complaints go to **armfrancisco@gmail.com**,
which reaches the person responsible for data protection at KapitMarket PH.

## 1. What we collect

We collect only what the Service needs to work, plus what you choose to
add. Concretely, today, that is:

**Account**

- Email address (required)
- Mobile number (optional)
- Password, stored as a one-way cryptographic hash. We never store, and
  cannot see, your actual password.
- Display name
- Account status, account creation time, and last sign-in time

**Verification**

- One-time codes sent to your email or mobile to confirm you own that
  address or number, along with which address or number it was sent to,
  when it expires, and how many attempts have been made. We store only a
  hash of the code itself, never the plaintext, and it expires after 10
  minutes.

**Customer profile, addresses, and carts**

- Display name, and which saved address is your default
- Delivery addresses: a label, recipient name, building, unit, a contact
  mobile number, delivery instructions, and free-text notes. This is
  building and unit level information for a short walk. We do not collect
  GPS coordinates and the Service has no location, distance, or mapping
  feature at all.
- Cart contents: which items from which shop you have added, quantities,
  and any note you attach to a line. A cart persists between visits until
  you check out or clear it.

**Vendor profile and shop**

- Display name and verification status
- Shop name, description, address, contact number, opening or payment
  message, shop photos, fulfillment methods, and open/closed state
- Your payment instructions text and payment QR code images, which you
  provide and control, for example GCash or bank transfer details. This
  is your own payment information that you are choosing to publish to
  customers who order from you, not something we collect for our own use.
  It is shown only to the two participants in an order, never on the
  public shop listing.

**Orders and items**

- Items you list: name, description, price, photos, tags
- Orders placed: items, quantities, unit price and line totals captured
  at the moment of the order, fulfillment method, customer and vendor
  notes, an order reference, and timestamps. Prices and item details are
  snapshotted into the order and never changed retroactively, so order
  history stays accurate to what actually happened.
- The full status history of each order: every status change, who made
  it, when, and any reason given
- Payment status as asserted by the vendor. This is not a fact we
  independently verify. See the Terms and Conditions, Section 7.

**Chat**

- Messages, text and optionally one image per message, within a specific
  order's conversation, visible only to that order's customer and vendor
- A record of when each participant last read the conversation

**Uploaded images**

- The image files themselves, plus filename, file size, content type, and
  a checksum. Note that photos taken on a phone can contain embedded
  metadata such as the time and, on some devices, the GPS location where
  the photo was taken. We do not currently strip this metadata, and we do
  not read or use it. If this matters to you, strip metadata before
  uploading, or turn off location tagging in your camera app.

**Technical**

- API access tokens, stored as a hash rather than the raw token, with an
  expiry (30 days) and a last-used time, used to keep you signed in
- **IP addresses**, used for rate limiting and abuse prevention on
  sign-in, registration, verification, early-access signup, and browsing
- Standard web server and application logs, which record requests made to
  the Service. Passwords, tokens, and similar secrets are stripped from
  these logs before they are written.

**Before you're a full user**

- If you sign up for early access or a waitlist, we collect your name,
  email and/or mobile number, whether you are interested as a buyer,
  seller, or both, and any free-text context you provide. No account and
  no password is created for this.

We do not collect precise location, we do not run analytics or
advertising trackers, and we do not use tracking cookies. See Section 6.

## 2. Why we use it, and on what legal basis

Under the Data Privacy Act we must have a lawful basis for each use.
Ours are:

- **To create and secure your account**, authenticate you, verify you own
  the email or mobile you gave us, keep your session, and prevent
  unauthorized access. Basis: performance of our contract with you
  (these are the Terms you agreed to), and our legitimate interest in
  keeping accounts secure.
- **To operate the marketplace**: show vendors their shops and orders,
  show customers shops and items, and connect a specific order between
  one customer and one vendor, sharing only what that transaction needs.
  Basis: performance of our contract with you.
- **To enable per-order chat** so a customer and vendor can coordinate
  pickup or delivery and share things like payment proof. We store and
  deliver messages. We do not read them to make decisions about your
  order. Basis: performance of our contract with you.
- **For trust and safety**: rate limiting, abuse prevention, vendor
  verification, investigating reports, and suspending accounts that
  violate our Terms. Basis: our legitimate interest in protecting users
  from fraud and abuse, which is the core purpose of this Service.
- **For service communications**: verification codes, order status
  updates, and account or security notices. These are not optional while
  your account is active, because they are how the Service functions.
  Basis: performance of our contract with you.
- **To comply with legal obligations**, including laws regulating online
  marketplaces in the Philippines, which require us to hold identifying
  information about the vendors selling through the Service and to act on
  lawful takedown orders. Basis: compliance with a legal obligation.
- **To establish, exercise, or defend legal claims.** Basis: our
  legitimate interest, and legal obligation where applicable.

## 3. Marketing: planned, not yet active, and opt-in only

We intend to eventually send product updates and promotional messages to
the email address and/or mobile number on your account. **We have not
built this yet and are not sending any marketing messages today.**

When we do build it:

- It will be **opt-in**, collected as its own separate checkbox that is
  unchecked by default, not bundled into the consent you give to use the
  Service. Under RA 10173 and National Privacy Commission guidance,
  marketing consent must be specific, informed, and freely given, and it
  cannot be a condition of using the Service.
- Every marketing email will include a working unsubscribe link, and
  every marketing SMS will include a clear opt-out such as replying STOP,
  along with our name.
- You can withdraw consent at any time, in the app or by emailing us.
  Withdrawing marketing consent never affects the transactional messages
  your account and orders need.

We do not sell your personal data, and we do not share it with third
parties for their own advertising.

## 4. Who we share it with

- **Other users, scoped to what a transaction needs.** A vendor sees a
  customer's name, delivery address, contact number, order contents, and
  chat messages only for orders placed with that vendor. A customer sees
  a vendor's shop details, contact number, and payment details for orders
  they have placed. Chat is visible only to the two people on that order.
  Users cannot see each other's information outside a shared order.
- **Service providers who process data on our behalf**, under
  confidentiality and data protection obligations:
  - **Cloudflare R2**, which stores uploaded images (shop photos, item
    photos, chat images, payment QR codes).
  - **Railway**, which hosts our application servers and databases.
  - An **email and SMS delivery provider**, which will send verification
    codes and, once built, marketing messages. We have not finalized this
    provider yet and will name it here once we do.
- **Government agencies, law enforcement, and courts**, where required by
  law, a lawful order, or to protect the rights, property, or safety of
  our users or the public. This includes providing vendor identifying
  information where a regulator is entitled to it.
- **Business transfers.** If the Service is ever merged, acquired, or
  sold, personal data may transfer as part of that, subject to this
  policy or a successor policy you are notified of.

We do not currently use any third-party analytics or advertising
services.

## 5. Where your data is stored

Our hosting and storage providers may hold data on servers outside the
Philippines. Where that is the case, we take reasonable steps to ensure
your data continues to receive a comparable level of protection, and we
remain accountable for it under RA 10173's rules on cross-border
transfers.

## 6. Cookies and local storage

We do not use tracking cookies, advertising cookies, or third-party
analytics cookies.

When you sign in, the Service stores an access token in your browser's
local storage so you stay signed in between visits. This is strictly
necessary for the Service to work, is readable only by KapitMarket PH's
own pages, and is not used to track you across other websites. Signing
out removes it. Clearing your browser's site data also removes it and
signs you out.

## 7. How long we keep it

- **Order, order status history, and chat records** are kept as a
  permanent historical record for as long as the Service operates. They
  are the basis for dispute resolution, accountability between neighbors,
  and, once launched, ratings. Both the customer and the vendor have a
  legitimate interest in that record, so we do not delete one party's
  side of it on the other party's request.
- **Account and profile data** is kept while your account is active, and
  after closure only as described in Section 9.
- **Verification codes** expire after 10 minutes. Expired and used
  challenge records may be retained in hashed form for a limited period
  for abuse investigation.
- **Access tokens** expire after 30 days, or immediately when you sign
  out.
- **Early-access signups** are kept until the beta ends or until you ask
  us to remove you, whichever comes first.
- **Server logs** are kept for a short period for security and debugging
  and are then overwritten in the ordinary course of our hosting
  provider's log rotation.

## 8. Your rights

Under the Data Privacy Act, you have the right to:

- **Be informed** that your data is being processed (this policy)
- **Access** your personal data and know how it has been used
- **Object** to processing, and to withdraw a consent you previously gave
  (for example, marketing, once that exists)
- **Correct** inaccurate or outdated data. Most of this you can do
  yourself in the app: your email, mobile number, display name,
  addresses, shop details, and listings are all editable.
- **Request erasure or blocking** of data, subject to the retention
  limits in Section 7 and Section 9
- **Data portability**, meaning a copy of the data you provided in a
  commonly used electronic format
- **Be indemnified** for damages caused by a violation of your rights
- **Complain to the National Privacy Commission** if you believe we have
  mishandled your data

To exercise any of these, email **armfrancisco@gmail.com** with enough
detail to identify your account. We may ask you to verify your identity
before acting, so that someone else cannot make a request about your
data. During the beta phase these requests are handled manually. We aim
to respond within 15 working days, and where a request is complex we will
tell you and give you a timeframe.

## 9. Closing your account, and what we cannot delete

There is no self-service account deletion button in the app yet. To close
your account, email **armfrancisco@gmail.com** and we will action it
manually.

When you ask us to close your account:

- We deactivate the account so it can no longer sign in, and revoke its
  access tokens.
- We delete or anonymize the personal data that is not needed for a legal
  or legitimate business reason: your profile display name, saved
  addresses, cart contents, and unused verification records.
- **We do not delete completed orders, order status history, or chat
  messages**, because they are also the other party's record of a real
  transaction, and are needed for dispute resolution, fraud prevention,
  and legal compliance. We will disconnect them from your account
  identity where we can do so without destroying the other party's
  record.
- If you are a vendor, closing your account unpublishes your shops and
  listings so they are no longer discoverable.

If you think we are keeping something we should not be, tell us and we
will look at it specifically. You can also raise it with the National
Privacy Commission.

## 10. Security

- Passwords are hashed with bcrypt, never stored or logged in plaintext.
- Verification codes and API access tokens are stored as hashes, not raw
  values.
- Sensitive parameters such as passwords, tokens, and secrets are
  stripped from application logs.
- Access to orders and chat is checked on every request. A user can only
  reach an order or conversation they are a participant in, and can only
  manage shops and items they own.
- We rate-limit sign-in, registration, verification, early-access
  signups, and browsing to reduce brute-force and scraping risk.
- Uploaded images are restricted by file type and size on the server, not
  just in the browser.
- The Service is served over HTTPS.

No system is perfectly secure and we cannot guarantee absolute security,
but we design for it deliberately rather than as an afterthought.

## 11. If there is a data breach

If a security incident affects your personal data in a way that is likely
to create a real risk of serious harm, we will notify the National
Privacy Commission and the affected users within 72 hours of learning
about it, as RA 10173 and its implementing rules require. The
notification will describe what happened, what data was involved, what we
have done about it, and what you can do to protect yourself.

## 12. Children

The Service is not intended for anyone under 18, and our Terms require
account holders to be adults. We do not knowingly collect data from
minors. If you believe a minor has an account, contact
armfrancisco@gmail.com and we will investigate and remove it if
confirmed.

## 13. Automated decision-making

We do not make decisions about you by automated processing alone, and we
do not profile you. Order acceptance, rejection, cancellation, payment
status, and any moderation action are all decisions made by a person, not
by the system.

## 14. Changes to this policy

We will post updates here with a new "Last updated" date. For material
changes to how we use your data, for example when we launch marketing
messaging, we will ask for the specific consent that requires rather than
relying on an updated policy alone, and we will make a reasonable effort
to notify you.

## 15. Contact us

Questions, requests, or complaints about your personal data:
**armfrancisco@gmail.com**, or by post at Prisma Residences, Pasig Blvd.,
Brgy. Bagong Ilog, Pasig City 1600, Philippines.

If you are not satisfied with our response, you may lodge a complaint
with the National Privacy Commission of the Philippines
(https://www.privacy.gov.ph).

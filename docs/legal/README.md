# Legal docs: status, assumptions, and open items

Terms and Conditions and Privacy Policy for KapitMarket PH, written
against what the codebase actually does (models, controllers, policies,
ADRs) rather than generic boilerplate. **Not legal advice, and not
reviewed by a lawyer.** Get a Philippines-licensed lawyer to review both
before real signups open. The app handles addresses, phone numbers,
photos, and order history for real people in real buildings.

Reviewed and revised 2026-08-04 against the implementation. Findings from
that review are below.

## Jurisdiction

Philippines throughout: `PHP` currency, GCash payment rails (ADR 0009),
Pasig City pilot. Written against:

- **RA 10173** (Data Privacy Act of 2012) and its IRR
- **RA 11967** (Internet Transactions Act of 2023), fully in force since
  20 June 2025, which regulates online marketplaces specifically
- **RA 7394** (Consumer Act), referenced so the liability cap does not
  purport to waive non-waivable consumer rights

## Entity and naming

Both documents name the operator as **"KapitMarket PH, a sole
proprietorship based in Pasig City, Philippines"** with no personal name,
per preference. Two things to be aware of:

1. **An unregistered trade name gives no liability protection.** Until
   "KapitMarket PH" is registered with the DTI, it is not a legal entity.
   Contracts formed through the Service are with the individual operator
   personally, whatever name appears in the document. Omitting the name
   does not change who is liable, it only makes the document less clear
   about who the counterparty is.
2. **RA 11967 expects marketplace operators to be identifiable and
   registered.** Operating an e-marketplace under an unregistered name is
   a compliance gap on its own, separate from the fee question.

**Recommendation: register the business name with DTI sooner rather than
later.** It is inexpensive, can be done online, and it makes
"KapitMarket PH" a name that can legitimately stand alone in these
documents. Until then the current wording is a reasonable interim
position, not a durable one.

**Address note.** The published address was reduced to building level
(Prisma Residences, Pasig Blvd., Brgy. Bagong Ilog, Pasig City 1600),
dropping the unit number, since these documents are public and a unit
number is a home address. A DPA privacy notice does need reachable
contact details, which the email plus building-level address provides.
Once DTI registration is done, use the registered business address
instead.

## Findings from the 2026-08-04 review

### Fixed in this revision

- **Ratings were described as if they exist.** There is no rating code in
  the repo at all (zero matches). Both documents now say ratings are
  planned and not currently available.
- **Cart was missing entirely.** ADR 0008 reintroduced carts and
  `Carts::Checkout` is built, but neither document mentioned cart data.
  Added to both, including that a cart reserves nothing and is
  re-validated at checkout.
- **Cancellation was left as an open TODO.** The implementation already
  answers it: `Order::TRANSITIONS` plus `OrdersController#transition`
  restrict customers to `cancelled` only, and cancellation is legal only
  from `placed` and `accepted`. Terms Section 6 now states the real rules,
  including that orders cannot be cancelled in-app once `preparing`.
- **Payment info delivery was described per the original ADR 0009**, which
  said the QR auto-posts as a system chat message. The implementation was
  revised: it is a pinned panel read live from the shop
  (`OrderSerializer`). Terms Section 8 now matches, including the
  consequence that editing shop payment details changes what shows on past
  orders.
- **IP addresses were not disclosed.** `Rack::Attack` throttles by IP
  across five endpoint groups. Now listed as collected technical data.
- **No legal bases were stated.** RA 10173 requires a lawful criterion per
  purpose. Privacy Policy Section 2 now gives one per purpose.
- **No breach notification commitment.** RA 10173's IRR requires NPC and
  data subject notification within 72 hours for qualifying breaches. Added
  as Section 11.
- **Account deletion was promised loosely.** Rewritten honestly: there is
  no deletion endpoint, it is a manual email process, and completed
  orders and chat cannot be deleted because they are also the other
  party's record. See the open item below, this needs a real procedure.
- **Image metadata (EXIF) was not disclosed.** Active Storage keeps
  uploads as-is and nothing strips EXIF, so a phone photo can carry GPS
  coordinates into an app that otherwise has no geo. Disclosed, with a
  recommended code fix below.
- **Missing standard clauses** added to the Terms: platform IP ownership,
  reporting and takedown route, electronic communications consent,
  severability, no waiver, assignment, entire agreement, force majeure,
  and a savings clause so the liability cap does not purport to waive
  non-waivable consumer rights.
- **RA 11967 vendor identity obligation** added to Terms Section 4.
  Marketplaces must collect and hold merchant identifying information
  before listing. This maps onto the already-planned
  `vendor_profiles.verification_status` work.
- **Em-dashes removed** from both documents, per the repo convention in
  `CLAUDE.md`. The earlier drafts violated it.

### Open items needing your decision or code work

1. **Consent gating is still not built.** Nothing in the app requires
   agreement before signup, and neither web client links to these
   documents. Needs: `terms_accepted_at` (and a version marker) on
   `users`, validation in `Auth::RegisterUser`, a required checkbox in
   `AuthModal.tsx` and vendor-web's login/registration page, separate
   unchecked-by-default marketing opt-in columns, and a route in each
   client that serves these documents.
2. **Verification codes are written to logs in plaintext.**
   `VerificationDeliveryJob` logs `code=#{code}`, and `code` is not in
   `filter_parameters`. The Privacy Policy says codes are stored only as
   hashes, which is true of the database but not of the logs. Fix before
   any real user data exists: drop the log line when a real provider is
   wired in, and add `:code` to the filter list.
3. **Chat message bodies are written to logs.** `body` is not filtered,
   so `POST /orders/:id/messages` parameters land in the Rails log. Add
   `:body` to `filter_parameters`.
4. **ActionCable passes the bearer token as a query parameter**
   (`?token=...`), so live tokens can land in access logs and proxy logs.
   Worth revisiting, and it undercuts the "tokens are stripped from logs"
   statement.
5. **Deleting a user would cascade-destroy other people's records.**
   `User has_one :customer_profile, dependent: :destroy` chains through
   `CustomerProfile has_many :orders, dependent: :destroy` to
   `order_items`, `order_status_events`, and the conversation. A vendor's
   sales record would disappear with the customer. In practice the delete
   would probably fail first on the `messages.sender_user_id` and
   `order_status_events.actor_user_id` foreign keys, which have no
   `dependent:` rule. Either way there is no working deletion path today.
   Design an anonymize-in-place routine (blank the personal fields, keep
   the order rows) before promising erasure to anyone.
6. **EXIF stripping.** Consider stripping metadata on upload. It is a
   small change in the image pipeline and removes the awkwardness of a
   deliberately geo-free product storing GPS-tagged photos.
7. **Email/SMS provider not named.** The Privacy Policy leaves this as a
   provider to be appointed. Once chosen (a Resend connector is available
   in this workspace), name it as a subprocessor.
8. **Early-access signup collects contact details with no privacy notice
   at the point of collection.** `EarlyAccessModal.tsx` has no consent
   text or policy link. If those addresses will later receive marketing,
   that consent needs capturing now, not retroactively.
9. **Vendor verification is dormant.** `verification_status` exists but
   nothing sets or enforces it. RA 11967 makes this a compliance
   obligation, not just a trust feature, so it should move up the
   priority list. Terms Section 4 already commits vendors to providing
   identifying information on request.

## Before you charge fees

The beta is free, and the Terms say so (Section 1), so business
registration does not block launching. Before charging vendors anything:

- **DTI Business Name registration** for "KapitMarket PH" (also the fix
  for the naming issue above)
- **BIR registration**, to issue receipts and pay tax on fee income
- Revisit **NPC registration**. It is threshold-based (250+ employees, or
  sensitive personal information of 1,000+ individuals), so a small pilot
  almost certainly does not trigger it. Designating someone responsible
  for data protection is still expected practice, and the Privacy Policy
  points at the operator's email for that.

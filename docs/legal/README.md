# Legal docs — status and how to use these

This folder has a first draft of the **Terms and Conditions** and
**Privacy Policy** the app needs before real signups open. They are grounded
in what the codebase actually does today (models, ADRs, `docs/erd.md`), not
generic boilerplate. They are **not legal advice** and have **not been
reviewed by a lawyer**. Before this gates real signups with real neighbors'
data, get a Philippines-licensed lawyer to review both documents — the app
handles addresses, phone numbers, photos, and order history for real people
in real buildings, and the National Privacy Commission can fine up to
₱5,000,000 per violation for DPA non-compliance.

## Why Philippine law

The codebase assumes the Philippines throughout: currency is `PHP`
(`items.currency`, `orders.currency`), ADR 0009 names GCash and `09xx`
mobile formats as the default payment rails, and there's no other
jurisdiction signal anywhere in the repo. Both drafts are written against
the **Data Privacy Act of 2012 (RA 10173)**. If the pilot isn't the
Philippines, say so and I'll redo the compliance framing.

## Placeholders — filled in

- **Entity**: Alain Roy Francisco, doing business as KapitMarket PH (an
  individual/sole proprietor for now, not yet a registered business name —
  see "Before you charge fees" below)
- **Address**: 3017 Astra Tower, Prisma Residences, Pasig Blvd., Brgy.
  Bagong Ilog, Pasig City 1600, Philippines
- **Contact**: armfrancisco@gmail.com (used for both support and privacy
  requests for now — split these into separate inboxes once there's
  volume)
- **Governing city**: Pasig City
- **Effective date**: left as "upon beta launch (date to be confirmed)" in
  both documents — update it to the real date once you publish these for
  real users, and update "Last updated" on any future edit.

## Before you charge fees

You're running the beta free of charge, which the Terms now say
explicitly (Section 1, "Beta / pilot notice") — so there's no rush on
formal business registration to start the pilot under your own name.
Before you start charging vendors anything, though, get:

- **DTI Business Name registration** for "KapitMarket PH" (cheap, fast,
  needed to legally invoice/collect under that name instead of your own)
- **BIR registration** (needed to issue receipts/invoices and pay tax on
  fee income)
- Reconsider **NPC registration** as a Personal Information Controller if
  user volume grows — required past certain thresholds under RA 10173's
  implementing rules; a lawyer can tell you if/when you cross it

None of this blocks the beta. It blocks turning on Section 6's fees.

## What's deliberately left open

A few product decisions aren't made yet (see `docs/open-decisions.md`) and
the drafts either leave them general or flag them inline:

- **Cancellation policy** (open decision #3) — the ToS describes the
  mechanism (status transitions, logged, attributable) but not which states
  allow customer self-cancel. Tighten this once that's decided.
- **Fees** — nothing in the schema charges a platform fee today. The ToS
  says the service is free for now and reserves the right to introduce fees
  with notice. Update if that changes.
- **Vendor permits for food/goods** — if vendors will sell home-cooked food,
  you likely want a vendor representation about local permits (barangay
  business permit, health clearance, etc.) beyond what's drafted. Flagged
  inline in the ToS, worth a lawyer's specific attention.
- **Email/SMS delivery provider** — not chosen yet (`VerificationDeliveryJob`
  just logs codes today, per its comment). The Privacy Policy names this as
  "a provider we'll appoint" rather than a specific vendor; update once
  Postmark/Twilio/whatever is picked, since that provider becomes a named
  subprocessor.

## Marketing consent — why it's a separate checkbox, not bundled into ToS

You mentioned wanting to eventually send ads/updates to the email and
mobile number on file. Under RA 10173 and NPC guidance, marketing consent
must be **specific, informed, and not bundled** with the consent needed to
just use the service — a single "I agree to the Terms" checkbox is not
enough to authorize marketing messages. The Privacy Policy documents this
future use; the ToS/signup flow should collect it as its own opt-in
checkbox (unchecked by default), separate from the required "I agree to the
Terms and Privacy Policy" checkbox that gates signup. Every marketing
message needs a working unsubscribe/STOP path once this is built.

## Implementation not yet done

The documents exist as text; nothing in the app enforces "must agree before
signup" yet. That needs, roughly:

- A `terms_accepted_at` (and maybe `terms_version`) column on `users`,
  required at registration
- `email_marketing_opt_in` / `sms_marketing_opt_in` columns, both default
  `false`, set only from an explicit unchecked-by-default checkbox
- `Auth::RegisterUser` validating acceptance before creating the account
- A required checkbox in `AuthModal.tsx` (customer-web) and the equivalent
  vendor-web registration form, linking to rendered versions of these two
  documents
- Somewhere to actually serve the text (a simple route/page in each web
  client, or host as static pages)

Say the word if you want this wired up — it touches the API and both web
clients, so I held off doing it until the content itself was reviewed and
the placeholders above are filled in.

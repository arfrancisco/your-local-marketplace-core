# Curriculum: understanding this codebase

Eleven lessons that teach the system from the ground up. Each lesson is
self-contained teaching material — you do not need the code open to follow
it, though you will learn more if you do.

**Read the lessons first. The quiz comes after.** `docs/codebase-guide.md`
is the condensed reference version of the same material; use it to revise
once you have been through a lesson, not instead of the lesson.

## How each lesson is built

1. **Why this matters** — what breaks if you do not know this.
2. **The lesson** — the actual teaching, with the real code inline and
   explained line by line where it matters.
3. **Walkthrough** — one concrete scenario traced end to end.
4. **Common misconceptions** — the things people get wrong here specifically.
5. **Exercises** — do these. Answers below each.
6. **Recap** — the five or so sentences worth keeping.

Budget 25-40 minutes per lesson. They build on each other, so go in order.

## The syllabus

### Part 1 — Foundations (lessons 1-3)

| # | Lesson | You will be able to |
|---|---|---|
| 1 | [The product and its three refusals](01-product-and-refusals.md) | Explain why there is no map, no payment gateway, and no courier, and what that buys |
| 2 | [How the system is shaped and shipped](02-shape-and-shipping.md) | Draw the deploy topology, explain the routing trap, and put code in production |
| 3 | [Who you are: identity and authentication](03-identity-and-auth.md) | Trace a bearer token from login to a controller, and explain the two auth worlds |

### Part 2 — The rules (lessons 4-5)

| # | Lesson | You will be able to |
|---|---|---|
| 4 | [What you're allowed to do: authorization](04-authorization.md) | Predict which check rejects a request and what the client sees |
| 5 | [The data model and the snapshot rule](05-data-model.md) | Say what is immutable, what is live, and why each is the way it is |

### Part 3 — The flows (lessons 6-9)

| # | Lesson | You will be able to |
|---|---|---|
| 6 | [Discovery: how a customer finds a shop](06-discovery.md) | Compute the daily rotation by hand and distinguish the three item states |
| 7 | [Cart and checkout](07-cart-and-checkout.md) | List every checkout gate in order and explain the guest-cart handoff |
| 8 | [The order lifecycle](08-order-lifecycle.md) | Reproduce the state machine from memory and explain who drives each move |
| 9 | [Chat, payment, and ratings](09-chat-payment-ratings.md) | Explain the chat/status separation and why it is the sharpest rule here |

### Part 4 — Running it (lessons 10-11)

| # | Lesson | You will be able to |
|---|---|---|
| 10 | [The operations surface](10-ops-surface.md) | Debug a production error report and explain every guard around the admin surface |
| 11 | [Pre-beta review](11-pre-beta-review.md) | List what the docs get wrong, which flags are non-default, and what still needs a decision |

## A note on the docs you'll see referenced

This repo has a lot of documentation and **some of it is stale**. The
lessons flag drift as it comes up, and lesson 11 collects all of it.

Current and trustworthy: `CLAUDE.md`, `docs/architecture.md`, the ADRs'
*reasoning* (their *mechanics* have drifted in two places).

Historical, do not trust for mechanics: `README.md`, `docs/erd.md`,
`docs/milestones.md`, `docs/product-handover.md`.

Always true: `apps/api/db/schema.rb`, the code, and `spec/`.

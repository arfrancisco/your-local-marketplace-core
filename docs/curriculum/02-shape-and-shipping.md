# Lesson 2 — How the system is shaped and shipped

> Part 2 of 11. Previous: [The product and its three refusals](01-product-and-refusals.md) · Next: [Identity and authentication](03-identity-and-auth.md)

## Why this matters

Two things in this lesson have already caused real production incidents in
this repo: the route-ordering trap broke image loading, and the manual
deploy meant the live site ran days-old code while commits kept landing
locally. Both are the kind of thing you only get bitten by once if you
understand them, and repeatedly if you do not.

You also cannot ship the beta without knowing the deploy command, because
there is no pipeline that will do it for you.

## The lesson

### Four apps, one artifact, one service

The repo contains four applications:

```
apps/api/            Rails API — all business rules
apps/customer-web/   React SPA for customers
apps/vendor-web/     React SPA for vendors
apps/admin-web/      React SPA for admins
admin-mcp/           TypeScript MCP server (a client of the admin API)
e2e/                 Playwright end-to-end tests
```

The first four build into **one Docker image** running as **one Railway
service**. There is no API gateway, no reverse proxy in front of Rails, no
separate static hosting, no CDN in the path. Rails serves everything.

This is unusual enough to be worth stating plainly: when you visit the
customer site, a Rails process hands you the HTML. When the SPA then calls
`/api/v1/shops`, that is the same Rails process, same origin, no CORS
involved.

### How the image is built

`apps/api/Dockerfile` has three Node build stages, one per SPA, then the
Ruby stage. Each Node stage installs, builds, and hands its `dist/` to the
final image:

| SPA | Served at | Lands in |
|---|---|---|
| customer-web | `/` | `public/` |
| vendor-web | `/vendor/*` | `public/vendor/` |
| admin-web | `/admin/*` | `public/admin/` |

The Dockerfile's opening comment is a warning you should internalize:

```dockerfile
# Build context for this Dockerfile is the REPO ROOT, not apps/api — it needs
# to see apps/customer-web, apps/vendor-web, and apps/admin-web too...
# If deploying with `railway up`, run it from the repo root with
# `--path-as-root .` and point at this file, not `apps/api` as the root.
```

Note also what the Node stages bake in at **build time**, because Vite
inlines env vars into the bundle:

```dockerfile
ENV VITE_API_BASE_URL=/api/v1
ENV VITE_SKIP_VERIFICATION=true
```

`VITE_API_BASE_URL=/api/v1` is a *relative* path — the same-origin
consequence of the one-service design. `VITE_SKIP_VERIFICATION=true` is a
temporary beta flag (lesson 11). The important structural point: **you
cannot change a `VITE_*` value with a Railway env var.** It is compiled into
the JavaScript. Changing it requires a rebuild and redeploy.

### The routing trap

Rails needs to serve three SPAs' `index.html` for arbitrary client-side
routes, so React Router can take over after the initial load. That is
`StaticController`'s entire job. The route table ends like this:

```ruby
get "vendor", to: "static#vendor_app"
get "vendor/*path", to: "static#vendor_app"

get "admin", to: "static#admin_app"
get "admin/*path", to: "static#admin_app"

# ...Sidekiq mount...

RESERVED_PATH_PREFIXES = %w[/api /rails /cable /up /sidekiq].freeze
root to: "static#customer_app"
get "*path", to: "static#customer_app",
    constraints: ->(req) { RESERVED_PATH_PREFIXES.none? { |prefix| req.path.start_with?(prefix) } }
```

Two separate mechanisms are protecting you here, and you need both:

**Mechanism 1: ordering.** `get "*path"` matches literally every path.
Anything drawn *after* it is unreachable. So it must be the last route in
the file — which is why the vendor and admin routes appear above it.

**Mechanism 2: the constraint.** Ordering alone is not enough, because
Rails appends **engine-mounted routes after this file's routes have been
drawn**. ActiveStorage's `/rails/active_storage/*`, ActionCable's `/cable`,
the `/up` health check, and Sidekiq's dashboard all get added later, which
means the catch-all would shadow them despite being "last." The
`RESERVED_PATH_PREFIXES` lambda is what stops that.

The comment in `routes.rb` records what happened when it was missing:

> without these exclusions this catch-all would shadow all of them —
> exactly what broke image loading in production the first time.

Image loading, specifically, because ActiveStorage serves blobs from
`/rails/active_storage/*`. Every shop photo 404'd into an HTML page.

**What `StaticController` does not handle:** real static assets. JS bundles,
CSS, favicons under `/assets/*` and `/vendor/assets/*` are served directly
by `Rack::Static` before routing runs at all. `StaticController` only ever
returns an `index.html` shell.

### One genuinely clever bit: social previews

`StaticController#customer_app` has one special case. Real visitors always
get the plain built `index.html`. But if the request is from a **recognized
social-media crawler** (Facebook/Instagram only, currently) **and** the path
matches `/shops/:slug`, the controller reads the HTML, injects
shop-specific Open Graph meta tags, and returns that instead:

```ruby
def customer_app
  index_path = Rails.root.join("public/index.html")
  return serve_spa(...) unless File.exist?(index_path)

  shop = crawler_shop_for_request
  return serve_spa(...) unless shop

  meta = SocialPreviews::BuildShopMeta.new(shop: shop, base_url: request.base_url).call
  html = SocialPreviews::InjectMetaTags.new(html: File.read(index_path, encoding: "UTF-8"), meta: meta).call
  render plain: html, content_type: "text/html"
end
```

Why it has to work this way: crawlers do not execute JavaScript, so an SPA
that sets its `<title>` at runtime unfurls as the site-wide default on every
link. Server-side injection into the static shell is the fix, and doing it
only for crawlers keeps the fast path untouched for real users.

Note `render plain:` with an explicit content type rather than
`render html:` — this is an API-only Rails app with no ActionView rendering
pipeline, so the usual helpers are not available. Same reason
`serve_spa` uses `send_file`.

### Shipping: the part with no safety net

**Railway's `api` service has no connected source.** Pushing to GitHub
deploys nothing. The only way code reaches production:

```bash
railway up --service api --path-as-root . --detach
```

run from the **repo root**. `railway.json` points the builder at
`apps/api/Dockerfile`; `--path-as-root .` is what gives the build the whole
repo as context.

There is no CI/CD. `docs/architecture.md` records the consequence:

> This has caused real confusion (the live site ran days-old code while
> local commits kept landing).

### What CI actually covers

`.github/workflows/api-ci.yml` runs RSpec against Postgres 16 and Redis 7,
triggered on pushes to `main` and on PRs — but look at the path filter:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    paths:
      - "apps/api/**"
      - ".github/workflows/api-ci.yml"
```

So: **the three SPAs' Vitest suites and the Playwright e2e suite never run
in CI.** A frontend-only PR gets no automated checks at all. Worth knowing
before a beta.

Backing services in development come from `docker-compose.yml` (Postgres +
Redis). Sidekiq runs the background jobs against that same Redis.

## Walkthrough: one request, four possible fates

A browser asks for four different paths. Trace each:

**`GET /assets/index-a1b2.js`** → `Rack::Static` finds
`public/assets/index-a1b2.js` and serves it. Rails routing never runs.

**`GET /api/v1/shops`** → not a static file; routing runs; matches the
`namespace :api` block long before the catch-all. `ShopsController#index`.

**`GET /shops/lolas-kitchen`** → not a static file; no API route matches;
falls to `get "*path"`; the constraint passes (`/shops` is not reserved);
`StaticController#customer_app` returns `public/index.html`. React Router
reads the URL client-side and renders the shop page. If the requester's
user-agent is Facebook's crawler, it gets the meta-injected variant instead.

**`GET /rails/active_storage/blobs/.../photo.jpg`** → not in `public/`, so
`Rack::Static` passes; routing runs; the catch-all's constraint **rejects**
it because `/rails` is reserved; routing continues to the ActiveStorage
engine routes Rails appended after this file. The blob is served. Remove
the constraint and this exact request returns an HTML page instead of a
JPEG — the production incident.

## Common misconceptions

**"Pushing to main deploys."** It does not. Nothing about GitHub is
connected to Railway. Only `railway up` deploys.

**"CI green means the app is fine."** CI runs the API specs only. Frontend
tests and e2e are local-only.

**"I can flip `VITE_SKIP_VERIFICATION` in Railway."** No. `VITE_*` values
are compiled into the bundle at Docker build time. Changing one needs a
rebuild and redeploy.

**"`StaticController` serves my JS bundle."** It does not — `Rack::Static`
does. `StaticController` only ever returns `index.html`.

**"The catch-all being last is enough."** It is not, because engine routes
are appended after this file. The constraint is the second, necessary half.

## Exercises

**1.** You add a new mounted engine at `/metrics`. What must you also change,
and what happens if you forget?

<details><summary>Answer</summary>

Add `/metrics` to `RESERVED_PATH_PREFIXES`. If you forget, the catch-all
matches `/metrics` first and returns customer-web's `index.html` instead of
your engine's response — a 200 with the wrong body, which is worse than a
404 because nothing looks broken until you inspect the payload.
</details>

**2.** A teammate runs `railway up --service api` from inside `apps/api`.
What fails and why?

<details><summary>Answer</summary>

The Docker build fails at the first `COPY apps/customer-web/package*.json`
— that path does not exist relative to `apps/api`. The build context must
be the repo root, which is what `--path-as-root .` from the root provides,
because the image builds all three SPAs alongside the API.
</details>

**3.** A shop's cover photo returns an HTML page instead of an image in
production. What is the first thing you check?

<details><summary>Answer</summary>

Whether `/rails` is still in `RESERVED_PATH_PREFIXES` in `routes.rb`. This
is the known failure mode: ActiveStorage serves blobs from
`/rails/active_storage/*`, and without the exclusion the customer-web
catch-all shadows those engine routes and returns `index.html`.
</details>

**4.** A PR changes only `apps/customer-web/src/pages/ShopsPage.tsx`. What
runs in CI?

<details><summary>Answer</summary>

Nothing. The workflow's PR trigger is filtered to `apps/api/**` and the
workflow file itself. Frontend changes get no automated checks — the Vitest
and Playwright suites exist but are never run by CI.
</details>

**5.** Why does `StaticController` use `send_file` and `render plain:`
rather than `render file:` or `render html:`?

<details><summary>Answer</summary>

This is an API-only Rails app, so there is no ActionView rendering
pipeline for those helpers to use. `send_file` streams the file directly
and `render plain:` with an explicit `content_type` produces HTML without
needing a view layer.
</details>

## Recap

- **Four apps, one Docker image, one Railway service.** Rails serves the
  SPAs and the API from the same origin — which is why the API base URL is
  the relative `/api/v1`.
- The Docker **build context is the repo root**, because the image builds
  all three frontends.
- `VITE_*` values are **compiled in at build time**; they are not runtime
  config.
- The customer-web catch-all must be **last** *and* carry the
  `RESERVED_PATH_PREFIXES` constraint, because Rails appends engine routes
  after this file. Missing the constraint once broke image loading in
  production.
- `Rack::Static` serves real assets; `StaticController` only ever serves an
  `index.html` shell — with a crawler-only Open Graph injection path for
  `/shops/:slug`.
- **Deploys are manual**: `railway up --service api --path-as-root . --detach`
  from the repo root. Pushing to GitHub does nothing.
- **CI covers the API only.** No frontend tests, no e2e, no deploy.

---

Next: [Lesson 3 — Who you are: identity and authentication](03-identity-and-auth.md)

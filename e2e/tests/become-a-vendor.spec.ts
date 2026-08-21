import { test, expect, type Page } from '@playwright/test'

// Full "become a vendor" upgrade flow, driven against real, locally-running
// servers: register a customer (mobile verified as part of registration,
// see registration-and-verification.spec.ts) -> attempt the upgrade and see
// it rejected because email still isn't verified -> verify email from the
// account page -> upgrade succeeds -> full-navigation redirect into
// vendor-web's onboarding tour -> create a real first shop -> land on a
// fully-usable vendor dashboard. Becoming a vendor deliberately requires
// both channels verified — mobile automatically via registration, email as
// a separate step here — a higher trust bar than the mobile-only
// requirement to place an order. Uses the same test_helpers/
// verification_code endpoint as the registration spec to retrieve real
// codes deterministically.

const CUSTOMER_BASE = process.env.CUSTOMER_WEB_URL ?? 'http://localhost:5173'
const VENDOR_BASE = process.env.VENDOR_WEB_URL ?? 'http://localhost:5174'
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'sup3rsecret123'

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`
}

function uniqueMobile() {
  return `+63917${Math.floor(1000000 + Math.random() * 8999999)}`
}

// Retries on 404 specifically. verifyEmailFromAccountPage already waits for
// the UI to reflect "sent" before calling this, so that call site shouldn't
// actually need a retry (the code digest is cached synchronously in the
// same request that returns "sent", ahead of the async delivery job — see
// Verifications::IssueChallenge). The retry earns its keep on the other
// call site, registerEligibleResident's mobile-verification fetch, which
// has no UI signal to wait on before calling this.
async function fetchVerificationCode(page: Page, email: string, purpose: string): Promise<string> {
  const url = `${API_BASE}/api/v1/test_helpers/verification_code?email=${encodeURIComponent(email)}&purpose=${purpose}`
  let res = await page.request.get(url)
  for (let attempt = 0; attempt < 10 && res.status() === 404; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    res = await page.request.get(url)
  }
  expect(res.ok(), `test_helpers/verification_code should 200 for ${purpose}`).toBeTruthy()
  const body = await res.json()
  return body.code
}

// Clicks "Start selling" and follows the full-page redirect into vendor-web.
// In production both apps share one origin, so the auth token in
// localStorage carries over automatically. Locally, customer-web and
// vendor-web are two different dev-server ports — different origins, where
// localStorage is never shared by the browser regardless of app code. That
// split-port setup is a local-dev-only artifact (see README.md); carrying
// the token across manually here simulates production's real same-origin
// behavior so this test can focus on the onboarding flow itself, which is
// what it's actually meant to cover.
async function crossIntoVendorWeb(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('kapitmarket_token'))
  await page.getByRole('button', { name: 'Start selling' }).click()
  // Lands somewhere on vendor-web's origin — could be /onboarding or, since
  // there's no token there yet, vendor-web's own client-side RequireAuth
  // redirect to /login (a race against the token-set below; either landing
  // spot is fine, we just need to be on the right origin before injecting
  // the token and doing a fresh full navigation to pick it up).
  await page.waitForURL((url) => url.href.startsWith(VENDOR_BASE))
  await page.evaluate((t) => { if (t) localStorage.setItem('kapitmarket_token', t) }, token)
  await page.goto(`${VENDOR_BASE}/onboarding`)
}

// Registers a resident customer (eligible on the residency front) and
// verifies mobile (screen 2 is mandatory now — see
// registration-and-verification.spec.ts's header comment), completing the
// required profile screen — leaves the browser signed in on /shops. Email
// is deliberately left unverified here: that's the realistic state for
// every fresh registrant now, and becoming a vendor is a separate step
// (see verifyEmailFromAccountPage below).
async function registerEligibleResident(page: Page, email: string) {
  await page.goto(`${CUSTOMER_BASE}/login`)
  await page.getByRole('button', { name: /don.t have an account/i }).click()

  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mobile number', { exact: true }).fill(uniqueMobile())
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Yes').check()
  await page.getByLabel(/willing to be verified/i).check()
  await page.getByLabel(/I agree to the/i).check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText(/step 2 of 3/i)).toBeVisible()
  const code = await fetchVerificationCode(page, email, 'mobile_verification')
  await page.getByLabel('Verification code').fill(code)
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText(/step 3 of 3/i)).toBeVisible()
  await page.getByLabel(/first name/i).fill('Ana')
  await page.getByLabel(/last name/i).fill('Reyes')
  await page.getByLabel(/tower/i).fill('Kiran')
  await page.getByLabel(/^unit/i).fill('5B')
  await page.getByRole('button', { name: /finish/i }).click()
  await page.waitForURL('**/shops')
}

// Drives the Account page's inline email-verification widget (under
// #email-verify) — the second, separate verification vendor eligibility
// requires on top of registration's own mobile verification. Assumes the
// caller is already on /account.
async function verifyEmailFromAccountPage(page: Page, email: string) {
  // The button click itself is what issues the code (VerificationAction's
  // send() -> api.requestEmailVerification()) — fetching before clicking
  // finds no challenge yet and 404s. The request also isn't instant (bcrypt
  // on the code digest), so wait for the UI to actually reflect that it
  // completed (the Code input replacing the button) rather than racing the
  // raw HTTP GET against an in-flight POST.
  await page.getByRole('button', { name: 'Verify your email' }).click()
  // Exact: true — an unqualified substring match also catches the address
  // delivery-note textarea's placeholder ("...gate code 1234...").
  await page.getByPlaceholder('Code', { exact: true }).waitFor()
  const code = await fetchVerificationCode(page, email, 'email_verification')
  await page.getByPlaceholder('Code', { exact: true }).fill(code)
  await page.getByRole('button', { name: 'Confirm' }).click()
}

test('full upgrade flow: register, blocked on email verification, verify it, become a vendor, no forced tour stops along the way', async ({ page }) => {
  const email = uniqueEmail('vendorupgrade')

  await test.step('register as a resident — mobile verified, email not yet', async () => {
    await registerEligibleResident(page, email)
    await page.goto(`${CUSTOMER_BASE}/account`)
    // Not eligible yet: residency is satisfied, but email isn't verified —
    // no "Start selling" button, just the reason and an inline fix for it.
    await expect(page.getByRole('button', { name: 'Start selling' })).not.toBeVisible()
    await expect(page.getByText(/verify your email to become eligible/i)).toBeVisible()
  })

  await test.step('verifying email from the account page unlocks eligibility', async () => {
    await verifyEmailFromAccountPage(page, email)
    await expect(page.getByRole('button', { name: 'Start selling' })).toBeVisible()
  })

  await test.step('start selling redirects into vendor-web onboarding', async () => {
    await crossIntoVendorWeb(page)
  })

  await test.step('the splash explains there is no in-app payment, then hands off to the wizard', async () => {
    await expect(page.getByText(/no payment in this app/i)).toBeVisible()
    // The splash carries no stepper on purpose (ADR 0011): it is read-only
    // and cannot be failed, so counting it would only inflate the flow.
    await expect(page.getByText(/step \d+ of \d+/i)).toBeHidden()
    await page.getByRole('link', { name: 'Get started' }).click()
    await page.waitForURL('**/onboarding/shop')
  })

  await test.step('step 1 of 4: shop basics, with an opt-in preview that reads off the unsaved form', async () => {
    await expect(page.getByText('Step 1 of 4')).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill("Ana's Kitchen")
    // Required field — a bare Continue with this left blank just triggers
    // native HTML validation and silently never submits.
    await page.getByLabel(/^Building/).fill('Kiran')

    // Collapsed by default at every width, and it renders the in-progress
    // form values rather than only what has been saved — nothing has been
    // saved at all yet at this point, since the shop is created on Continue.
    await page.getByRole('button', { name: 'Preview your shop' }).click()
    await expect(page.getByRole('button', { name: 'Hide preview' })).toBeVisible()
    await expect(page.getByText("Ana's Kitchen")).toBeVisible()
    await page.getByRole('button', { name: 'Hide preview' }).click()

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/onboarding/photos')
  })

  await test.step('step 2 of 4: photos are skippable', async () => {
    await expect(page.getByText('Step 2 of 4')).toBeVisible()
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await page.waitForURL('**/onboarding/items')
  })

  await test.step('step 3 of 4: the first item is added inside the wizard', async () => {
    await expect(page.getByText('Step 3 of 4')).toBeVisible()
    await page.getByLabel(/^Name/).fill('Adobo Rice Bowl')
    await page.getByLabel('Price').fill('180')
    await page.getByRole('button', { name: 'Add item' }).click()

    await expect(page.getByText('Adobo Rice Bowl')).toBeVisible()
    // Once one item exists the affordance changes — more are optional.
    await expect(page.getByRole('button', { name: 'Add another' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/onboarding/payment')
  })

  await test.step('step 4 of 4: the API owns the open gate, and the wizard surfaces its refusal', async () => {
    await expect(page.getByText('Step 4 of 4')).toBeVisible()

    // Deliberately try to open with the message still blank. The rule lives
    // in Shop#open! (ADR 0009 — this message IS how a customer finds out how
    // to pay), and the wizard has no second copy of it client-side, so the
    // API's own refusal is what has to show up here.
    await page.getByRole('button', { name: 'Open my shop' }).click()
    await expect(page.getByRole('alert')).toContainText(/opening message/i)
    await expect(page).toHaveURL(/\/onboarding\/payment$/)

    // Placeholder, not getByLabel('Message') — a label wrapping a text
    // control's accessible name includes that control's current value, so
    // this stops matching once the field is non-empty (see
    // order-and-chat-flow.spec.ts, which hits this for real on a reused shop).
    await page.getByPlaceholder('e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here.').fill('GCash to 0917-555-0000. Please send proof of payment here.')
    await page.getByRole('button', { name: 'Open my shop' }).click()

    await page.waitForURL('**/shops')
    await expect(page.getByText("Ana's Kitchen")).toBeVisible()
    // Finished, so the resume banner is gone and the shop is really open.
    await expect(page.getByText('Finish setting up your shop')).toBeHidden()
    await expect(page.getByRole('button', { name: /shop is open/i })).toBeVisible()
  })

  await test.step('the dashboard\'s "?" tour is opt-in: opens on click, closes on ×, never navigates', async () => {
    await page.getByRole('button', { name: 'Tour your dashboard' }).click()
    await expect(page.getByText(/this is your dashboard from here on/i)).toBeVisible()
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await expect(page.getByRole('tooltip')).not.toBeVisible()
    await expect(page).toHaveURL(`${VENDOR_BASE}/shops`)
  })

  await test.step('the inventory tab still adds items after onboarding, alongside the one the wizard created', async () => {
    // Inventory lives in the bottom TabBar now, not the kebab menu (which
    // only keeps "Edit shop details" and "Preview shop"). The wizard created
    // the first item; this is the ordinary path for every one after it.
    await page.getByRole('link', { name: /^inventory$/i }).click()
    await expect(page.getByText('Adobo Rice Bowl')).toBeVisible()

    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByLabel(/^Name/).fill('Pancit Bihon')
    await page.getByLabel('Price').fill('150')
    await page.getByRole('button', { name: 'Add item' }).click()

    await expect(page.getByText('Pancit Bihon')).toBeVisible()
    await expect(page).toHaveURL(/\/items$/)
  })

  await test.step('the bottom tab bar (replacing the retired hamburger drawer) is present with all 5 tabs, and Marketplace links back to customer-web', async () => {
    await expect(page.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/shops')
    await expect(page.getByRole('link', { name: /^inventory$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^reviews$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^account$/i })).toHaveAttribute('href', '/account')
    await expect(page.getByRole('link', { name: /^marketplace$/i })).toHaveAttribute('href', `${CUSTOMER_BASE}/shops`)
  })

  await test.step('Reviews tab actually navigates to the reviews page, not just present in the bar', async () => {
    await page.getByRole('link', { name: /^reviews$/i }).click()
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page).toHaveURL(/\/shops\/\d+\/reviews$/)
  })

  await test.step('the dashboard kebab menu is retired — just plain Edit / Shop Preview links now, since Inventory and Reviews moved to the bottom tabs', async () => {
    await page.getByRole('link', { name: /^home$/i }).click()
    await expect(page.getByRole('button', { name: /shop actions menu/i })).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', /\/shops\/\d+\/edit/)

    // Shop Preview actually navigates too, not just present.
    await page.getByRole('link', { name: 'Shop Preview' }).click()
    await expect(page.getByRole('heading', { name: "Ana's Kitchen" })).toBeVisible()
    await expect(page).toHaveURL(/\/shops\/\d+\/preview$/)
  })
})

// Abandoning the wizard partway is the common case, not an edge case: a
// vendor sets up on their phone between other things. What makes that safe is
// that the shop row exists from step 1 onward but stays draft/not-accepting,
// so a half-built shop is never visible to a customer, and shops.onboarding_step
// remembers where to drop them back in (ADR 0011).
test('leaving the wizard partway leaves the shop invisible, and the dashboard offers to resume it', async ({ page }) => {
  const email = uniqueEmail('returningvendor')
  await registerEligibleResident(page, email)

  await page.goto(`${CUSTOMER_BASE}/account`)
  await verifyEmailFromAccountPage(page, email)
  await crossIntoVendorWeb(page)

  await page.getByRole('link', { name: 'Get started' }).click()
  await page.waitForURL('**/onboarding/shop')
  await page.getByLabel('Name', { exact: true }).fill('Returning Vendor Shop')
  await page.getByLabel(/^Building/).fill('Kiran')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/onboarding/photos')

  // Walk away mid-wizard, straight to the dashboard. The shop exists, so this
  // no longer bounces back to the splash the way a shopless vendor would.
  await page.goto(`${VENDOR_BASE}/shops`)
  await expect(page.getByText('Returning Vendor Shop')).toBeVisible()
  await expect(page.getByText('not published yet')).toBeVisible()
  await expect(page.getByText('Finish setting up your shop')).toBeVisible()
  await expect(page.getByText(/step 2 of 4/i)).toBeVisible()

  // Resuming lands on the step they stopped at, not back at the beginning.
  await page.getByRole('link', { name: 'Continue setup' }).click()
  await page.waitForURL('**/onboarding/photos')
  await expect(page.getByText('Step 2 of 4')).toBeVisible()

  // Going Back is free: it saves nothing, so the furthest step reached does
  // not regress and a later resume still points forward.
  await page.getByRole('link', { name: /Back/ }).click()
  await page.waitForURL('**/onboarding/shop')
  await page.goto(`${VENDOR_BASE}/shops`)
  await expect(page.getByText(/step 2 of 4/i)).toBeVisible()
})

// The wizard's later steps all assume a shop exists — reaching them without
// one (a stale link, a bookmark, a hand-typed URL) has to land somewhere
// sensible rather than rendering a form with nothing behind it.
test('a wizard step deep-linked without a shop redirects back to the first step', async ({ page }) => {
  const email = uniqueEmail('deeplinkvendor')
  await registerEligibleResident(page, email)

  await page.goto(`${CUSTOMER_BASE}/account`)
  await verifyEmailFromAccountPage(page, email)
  await crossIntoVendorWeb(page)

  await page.goto(`${VENDOR_BASE}/onboarding/payment`)
  await page.waitForURL('**/onboarding/shop')
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
})

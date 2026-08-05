import { test, expect, type Page } from '@playwright/test'

// Full "become a vendor" upgrade flow, driven against real, locally-running
// servers: register a customer -> verify email (eligibility requirement,
// unlike mobile which stays optional) -> account page shows eligibility ->
// upgrade -> full-navigation redirect into vendor-web's onboarding tour ->
// create a real first shop -> land on a fully-usable vendor dashboard.
// Uses the same test_helpers/verification_code endpoint as the registration
// spec to retrieve real codes deterministically.

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

async function fetchVerificationCode(page: Page, email: string, purpose: string): Promise<string> {
  const res = await page.request.get(
    `${API_BASE}/api/v1/test_helpers/verification_code?email=${encodeURIComponent(email)}&purpose=${purpose}`
  )
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

// Dismisses however many tour callouts remain (each says "Got it" except
// the final one, which says "Done") — no fixed count assumed, so this
// doesn't need updating if the tour's stop count or labels ever change.
async function clickThroughTour(page: Page) {
  for (let i = 0; i < 8; i++) {
    const next = page.getByRole('button', { name: /^(Got it|Done)$/ })
    if (!(await next.isVisible().catch(() => false))) break
    await next.click()
  }
}

// Registers a resident customer (eligible on that front), verifies email
// (screen 2 is mandatory now — see registration-and-verification.spec.ts's
// header comment), and completes the required profile screen — leaves the
// browser signed in on /shops with a verified email.
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
  const code = await fetchVerificationCode(page, email, 'email_verification')
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

// There used to be a test here for "customer without a verified email is
// not yet eligible" (email verification was reachable-but-skippable during
// registration). Now that screen 2 of registration requires email
// verification to proceed at all (see registration-and-verification.spec.ts's
// header comment), there is no way to reach the account page via the UI
// with an unverified email anymore — that state is real for old accounts
// that registered before this change, but it isn't reachable through any
// current user-facing flow, so there's nothing left for an e2e test to
// drive here. The underlying `Vendors::EligibilityCheck` reason
// (`email_not_verified`) still exists and is still unit-tested at the
// service level.

test('full upgrade flow: register with verified email, become a vendor, onboarding tour to a real shop', async ({ page }) => {
  const email = uniqueEmail('vendorupgrade')

  await test.step('register as an eligible resident, email verified as part of registration', async () => {
    await registerEligibleResident(page, email)
    await page.goto(`${CUSTOMER_BASE}/account`)
    await expect(page.getByRole('button', { name: 'Start selling' })).toBeVisible()
  })

  await test.step('start selling redirects into vendor-web onboarding', async () => {
    await crossIntoVendorWeb(page)
  })

  await test.step('onboarding: welcome screen explains there is no in-app payment', async () => {
    await expect(page.getByText(/no payment in this app/i)).toBeVisible()
    await page.getByRole('button', { name: 'Get started' }).click()
  })

  await test.step('onboarding: create the first shop with the payment callout visible', async () => {
    await expect(page.getByText(/this is how you get paid/i)).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill("Ana's Kitchen")
    // Placeholder, not getByLabel('Message') — a label wrapping a text
    // control's accessible name includes that control's current value, so
    // this stops matching once the field is non-empty (see
    // order-and-chat-flow.spec.ts, which hits this for real on a reused shop).
    await page.getByPlaceholder('e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here.').fill('GCash to 0917-555-0000. Please send proof of payment here.')
    await page.getByRole('button', { name: 'Save shop' }).click()
  })

  await test.step('onboarding: dashboard tour ends on a fully usable /shops', async () => {
    // Click through however many "Got it" tour callouts remain, ending on a
    // plain, fully-functional shops page — no fixed count assumed here so
    // this doesn't need updating if the tour's stop count ever changes.
    await clickThroughTour(page)
    await page.waitForURL('**/shops')
    await expect(page.getByText("Ana's Kitchen")).toBeVisible()
  })
})

test('a vendor with an existing shop skips onboarding entirely', async ({ page }) => {
  // Reuses the flow above once, then confirms a second /shops visit for the
  // same now-vendor account goes straight to the real dashboard, not back
  // into onboarding — onboarding is derived from "zero shops", not a flag.
  const email = uniqueEmail('returningvendor')
  await registerEligibleResident(page, email)

  await page.goto(`${CUSTOMER_BASE}/account`)
  await crossIntoVendorWeb(page)

  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Returning Vendor Shop')
  await page.getByPlaceholder('e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here.').fill('Bank transfer to 1234-5678.')
  await page.getByRole('button', { name: 'Save shop' }).click()
  await clickThroughTour(page)
  await page.waitForURL('**/shops')

  // Now visit /shops fresh — should stay there, not bounce to /onboarding.
  await page.goto(`${VENDOR_BASE}/shops`)
  await expect(page).toHaveURL(`${VENDOR_BASE}/shops`)
  await expect(page.getByText('Returning Vendor Shop')).toBeVisible()
})

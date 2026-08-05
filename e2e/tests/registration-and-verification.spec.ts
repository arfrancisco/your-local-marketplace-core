import { test, expect, type Page } from '@playwright/test'

// Full 3-screen registration flow (register -> verify email -> complete
// profile), driven against real, locally-running servers. Uses the
// api/v1/test_helpers/verification_code endpoint to retrieve the real code
// deterministically, without a real inbox — that endpoint only exists
// in test/dev (with ENABLE_TEST_HELPERS=true), never production; see
// config/initializers/test_helpers.rb.
//
// Screen 2 is temporarily email verification, not mobile (Semaphore SMS
// approval still pending — see LoginPage.tsx's comment) and is no longer
// skippable, unlike the mobile-verification screen it replaces.

const CUSTOMER_BASE = process.env.CUSTOMER_WEB_URL ?? 'http://localhost:5173'
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'sup3rsecret123'

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`
}

function uniqueMobile() {
  // PH-shaped, unique per run so the uniqueness index never collides.
  return `+63917${Math.floor(1000000 + Math.random() * 8999999)}`
}

// The verification code isn't sent by an action this test itself waits on —
// email verification is auto-requested by a useEffect the moment screen 2
// mounts (VerifyEmailPage.tsx), so there's no UI signal to wait for before
// the challenge exists server-side. Poll briefly instead of fetching once,
// rather than a blind sleep.
async function fetchVerificationCode(page: Page, email: string, purpose: string): Promise<string> {
  let code: string | undefined
  await expect(async () => {
    const res = await page.request.get(
      `${API_BASE}/api/v1/test_helpers/verification_code?email=${encodeURIComponent(email)}&purpose=${purpose}`
    )
    expect(res.ok(), `test_helpers/verification_code should 200 for ${purpose}`).toBeTruthy()
    code = (await res.json()).code
  }).toPass({ timeout: 5000 })

  return code!
}

async function fillScreen1(page: Page, email: string, mobile: string, isResident: boolean) {
  await page.goto(`${CUSTOMER_BASE}/login`)
  await page.getByRole('button', { name: /don.t have an account/i }).click()

  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mobile number', { exact: true }).fill(mobile)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)

  await page.getByLabel(isResident ? 'Yes' : 'No').check()
  if (isResident) {
    await page.getByLabel(/willing to be verified/i).check()
  }
  await page.getByLabel(/I agree to the/i).check()

  await page.getByRole('button', { name: 'Create account' }).click()
}

test('full flow: register, verify email, complete profile as a resident', async ({ page }) => {
  const email = uniqueEmail('resident')
  const mobile = uniqueMobile()

  await test.step('screen 1: register as a resident who agrees to verification', async () => {
    await fillScreen1(page, email, mobile, true)
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible()
  })

  await test.step('screen 2: verify email with the real code', async () => {
    const code = await fetchVerificationCode(page, email, 'email_verification')
    await page.getByLabel('Verification code').fill(code)
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible()
  })

  await test.step('screen 3: complete profile — unit is required for a resident', async () => {
    await page.getByLabel(/first name/i).fill('Juan')
    await page.getByLabel(/last name/i).fill('Dela Cruz')
    await page.getByLabel(/tower/i).fill('Astra')
    await expect(page.getByLabel(/^unit/i)).toBeVisible()
    await page.getByLabel(/^unit/i).fill('12F')
    await page.getByRole('button', { name: /save|complete|continue|done|finish/i }).click()
    await page.waitForURL('**/shops')
  })

  await test.step('lands in the app, signed in', async () => {
    // Nav is behind a hamburger menu now — "My account" isn't on-screen
    // until it's opened.
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByText('My account')).toBeVisible()
  })
})

test('registration is still gated by the residency consent checkbox', async ({ page }) => {
  await page.goto(`${CUSTOMER_BASE}/login`)
  await page.getByRole('button', { name: /don.t have an account/i }).click()

  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail('gate'))
  await page.getByLabel('Mobile number', { exact: true }).fill(uniqueMobile())
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Yes').check()
  await page.getByLabel(/I agree to the/i).check()
  // Deliberately not checking the "willing to verify" consent checkbox.

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(/agree to verification/i)).toBeVisible()
  // Still on screen 1 — never advanced.
  await expect(page.getByText(/step 2 of 3/i)).not.toBeVisible()
})

test('email verification cannot be skipped, same as profile completion', async ({ page }) => {
  const email = uniqueEmail('nonresident')
  const mobile = uniqueMobile()

  await fillScreen1(page, email, mobile, false)
  await expect(page.getByText(/step 2 of 3/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip for now' })).not.toBeVisible()

  const code = await fetchVerificationCode(page, email, 'email_verification')
  await page.getByLabel('Verification code').fill(code)
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText(/step 3 of 3/i)).toBeVisible()

  // Non-resident: unit should not be a required field on this screen.
  await page.getByLabel(/first name/i).fill('Maria')
  await page.getByLabel(/last name/i).fill('Santos')
  await page.getByLabel(/tower/i).fill('Celeste')
  await page.getByRole('button', { name: /save|complete|continue|done|finish/i }).click()
  await page.waitForURL('**/shops')
})

test('duplicate email registration offers sign-in / forgot-password, not a raw error', async ({ page }) => {
  const email = uniqueEmail('dupe')
  const mobile = uniqueMobile()

  await fillScreen1(page, email, mobile, false)
  await expect(page.getByText(/step 2 of 3/i)).toBeVisible()

  // Second registration attempt with the same email, fresh page.
  await page.goto(`${CUSTOMER_BASE}/login`)
  await page.getByRole('button', { name: /don.t have an account/i }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mobile number', { exact: true }).fill(uniqueMobile())
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('No').check()
  await page.getByLabel(/I agree to the/i).check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText(/account with this email already exists/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in instead/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /forgot your password/i })).toBeVisible()
})

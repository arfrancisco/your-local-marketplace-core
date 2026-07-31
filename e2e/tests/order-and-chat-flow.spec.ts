import { test, expect, type Browser } from '@playwright/test'

// Full order-placement + chat flow (M3/M4, ADR 0009), driven against real,
// locally-running servers — no mocks. See README.md for what must be up
// first, and which seed accounts this relies on (db/seeds.rb).
//
// Covers, in one continuous run because each step depends on the last:
//   vendor sets their shop's opening message -> customer checks out -> both
//   sides see it as a pinned panel above the order's chat (read live off the
//   shop, not a chat message — ADR 0009, revised) -> customer and vendor
//   exchange chat messages in real time (no reload) -> vendor accepts the
//   order via an explicit status button -> customer sees the updated status.

const CUSTOMER_BASE = process.env.CUSTOMER_WEB_URL ?? 'http://localhost:5173'
const VENDOR_BASE = process.env.VENDOR_WEB_URL ?? 'http://localhost:5174'

const VENDOR_EMAIL = 'slice.corner@example.com' // "Pizza My Heart" owner, see db/seeds.rb
const CUSTOMER_EMAIL = 'customer@example.com'
const PASSWORD = 'password123'
const SHOP_NAME = 'Pizza My Heart'
const OPENING_MESSAGE_TEXT = 'GCash to 0917-000-0000. Please send proof of payment here.'

async function newPage(browser: Browser) {
  const context = await browser.newContext()
  return context.newPage()
}

test('vendor opening message, checkout, real-time chat, and status transition', async ({ browser }) => {
  const vendor = await newPage(browser)
  const customer = await newPage(browser)

  await test.step("vendor signs in and sets their shop's opening message", async () => {
    await vendor.goto(`${VENDOR_BASE}/login`)
    await vendor.fill('input[type=email]', VENDOR_EMAIL)
    await vendor.fill('input[type=password]', PASSWORD)
    await vendor.click('button[type=submit]')
    await vendor.waitForURL('**/shops')

    await vendor.locator('li.card', { hasText: SHOP_NAME }).getByText('Edit').click()
    await vendor.waitForURL('**/shops/*/edit')
    // The edit form's fields populate asynchronously after fetching the shop;
    // wait for that before typing so the fetch doesn't clobber our input.
    await vendor.waitForFunction(() => (document.querySelector('input') as HTMLInputElement | null)?.value.length)
    await vendor.waitForTimeout(500) // let React StrictMode's double effect-fire settle
    await vendor.getByLabel('Message').fill(OPENING_MESSAGE_TEXT)
    await vendor.click('button[type=submit]')
    await vendor.waitForURL('**/shops')
  })

  let orderId = ''

  await test.step('customer signs in, adds an item, and checks out', async () => {
    await customer.goto(`${CUSTOMER_BASE}/login`)
    await customer.fill('input[type=email]', CUSTOMER_EMAIL)
    await customer.fill('input[type=password]', PASSWORD)
    await customer.click('button:has-text("Sign in")')
    await customer.waitForURL('**/shops')

    await customer.click(`text=${SHOP_NAME}`)
    await customer.waitForURL('**/shops/pizza-my-heart')
    await customer.click('button:has-text("Add to cart")')
    await expect(customer.getByText('Your cart')).toBeVisible()

    await customer.click('button:has-text("Place order")')
    await customer.waitForURL('**/orders/*')
    orderId = customer.url().match(/orders\/(\d+)/)![1]
  })

  await test.step("the shop's opening message shows as a pinned panel on both sides", async () => {
    await expect(customer.locator('.opening-message')).toContainText(OPENING_MESSAGE_TEXT)

    await vendor.goto(`${VENDOR_BASE}/orders/${orderId}`)
    await expect(vendor.locator('.opening-message')).toContainText(OPENING_MESSAGE_TEXT)
  })

  await test.step('chat delivers in real time in both directions', async () => {
    // Both sides need their ActionCable subscription actually established
    // before either sends — a broadcast has no replay, so if the vendor's
    // subscribe call is still in flight when the customer sends, the vendor
    // simply never receives that message (this raced and flaked before this
    // wait was added).
    await customer.waitForSelector('.chat-composer')
    await vendor.waitForSelector('.chat-composer')

    await customer.fill('.chat-composer textarea', 'When will it be ready?')
    await customer.click('.chat-composer .send-btn')
    await expect(vendor.getByText('When will it be ready?')).toBeVisible() // no reload on the vendor side

    await vendor.fill('.chat-composer textarea', 'Ready in 10 minutes!')
    await vendor.click('.chat-composer .send-btn')
    await expect(customer.getByText('Ready in 10 minutes!')).toBeVisible() // no reload on the customer side
  })

  await test.step('vendor accepts the order via an explicit status button, customer sees it', async () => {
    await vendor.click('button:has-text("Accept")')
    await expect(vendor.locator('.tagline').first()).toHaveText('accepted')

    await customer.reload() // order status itself isn't pushed live, only chat is (see plan notes)
    await expect(customer.locator('.tagline').first()).toHaveText(/accepted/i)
  })
})

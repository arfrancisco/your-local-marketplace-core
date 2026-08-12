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
    // Vendor-web is a single-shop dashboard (not a shop list) — /shops lands
    // directly on this vendor's one shop, order management as the main
    // content, and "Edit shop details" tucked behind the kebab ("⋮") menu.
    await expect(vendor.getByRole('heading', { name: SHOP_NAME })).toBeVisible()

    await vendor.getByRole('button', { name: /shop actions menu/i }).click()
    await vendor.click('text=Edit shop details')
    await vendor.waitForURL('**/shops/*/edit')
    // The edit form's fields populate asynchronously after fetching the shop;
    // wait for that before typing so the fetch doesn't clobber our input.
    await vendor.waitForFunction(() => (document.querySelector('input') as HTMLInputElement | null)?.value.length)
    await vendor.waitForTimeout(500) // let React StrictMode's double effect-fire settle
    // Placeholder, not getByLabel('Message') — a label wrapping a text
    // control's accessible name includes that control's current value (per
    // the accname spec), so once this shop's opening message is non-empty
    // (true from the second run onward, since this reuses the same seeded
    // shop every time), the name becomes "Message" + the saved text and
    // stops matching an exact "Message" lookup entirely. The placeholder
    // is stable regardless of the field's current value.
    await vendor.getByPlaceholder('e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here.').fill(OPENING_MESSAGE_TEXT)
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
    await customer.click('button[aria-label="Add Pepperoni Slice to cart"]')
    // Cart summary is a fixed bottom bar (item count + subtotal), not shown
    // inline automatically — open it before checkout.
    await customer.click('.cart-summary-bar')
    await expect(customer.getByText('Your cart')).toBeVisible()

    // "Pizza My Heart" (db/seeds.rb) is a seeded demo shop, so the checkout
    // handle reads "Drag to place demo order" here, not "Drag to place
    // order" — match both, since this same control serves both a real
    // shop's checkout and a demo one's (see CartModal.tsx).
    //
    // Checkout requires an actual drag gesture, not a tap (DragToConfirmButton)
    // — a plain .click() lands with event.detail === 1, which satisfies
    // neither confirm path (the drag-distance check needs real pointer
    // movement; the detail === 0 shortcut is keyboard-only). Simulate a real
    // drag via Playwright's mouse API instead.
    // The end X has to be derived from the track's actual width, not a
    // fixed pixel offset — the cart sheet is up to 860px wide, so a small
    // hardcoded drag distance lands well short of the 85% completion
    // threshold and silently does nothing (this was tried and confirmed to
    // fail locally). Overshooting past the track's right edge is safe: the
    // component clamps dragX to the track's actual max drag distance.
    const dragHandle = customer.getByRole('button', { name: /drag to place( demo)? order/i })
    const track = customer.locator('.drag-confirm-track')
    // The cart is a bottom sheet and the handle can sit below the default
    // viewport height — boundingBox() coordinates outside the visible
    // viewport don't correspond to anything a real pointer can hit, so the
    // mouse events silently land nowhere. Scroll it into view first.
    await dragHandle.scrollIntoViewIfNeeded()
    const handleBox = await dragHandle.boundingBox()
    const trackBox = await track.boundingBox()
    if (!handleBox || !trackBox) throw new Error('drag-to-confirm handle/track has no bounding box')
    await customer.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await customer.mouse.down()
    await customer.mouse.move(trackBox.x + trackBox.width, handleBox.y + handleBox.height / 2, { steps: 10 })
    await customer.mouse.up()
    // Checkout lands on a dedicated "order placed" confirmation screen first
    // now, not the order page directly (see OrderPlacedPage.tsx) — follow
    // its "View order" link to reach the real order page the rest of this
    // test needs.
    await customer.waitForURL('**/orders/*/placed')
    orderId = customer.url().match(/orders\/(\d+)\/placed/)![1]
    await customer.getByRole('link', { name: /view order/i }).click()
    await customer.waitForURL(`**/orders/${orderId}`)
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
    // Order detail pages (both apps) show status via OrderStatusStepper, not
    // a .order-status-badge — that class only exists on the list views
    // (OrdersPage/OrderList). The step matching the order's live status is
    // the one with .step-current (see buildSteps in OrderStatusStepper.tsx).
    await expect(vendor.locator('.order-status-stepper .step-current .stepper-label')).toHaveText('Accepted')

    await customer.reload() // order status itself isn't pushed live, only chat is (see plan notes)
    await expect(customer.locator('.order-status-stepper .step-current .stepper-label')).toHaveText('Accepted')
  })
})

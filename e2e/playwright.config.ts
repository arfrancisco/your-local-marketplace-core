import { defineConfig } from '@playwright/test'

// Full-stack browser tests against real, locally-running servers — not
// mocked. See README.md for what needs to be up before running these.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false, // tests share seeded backend state (shop payment info, orders)
  // fullyParallel only stops tests *within* a file from interleaving —
  // Playwright still runs separate spec files concurrently on multiple
  // workers by default. That's fine for isolation (each file uses its own
  // accounts/shops), but multiple real browser contexts hammering the same
  // single local Rails dev server can starve the slower multi-page,
  // real-time-chat flow in order-and-chat-flow.spec.ts, timing it out.
  // Force one worker so the whole suite runs serially instead.
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
})

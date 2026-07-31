import { defineConfig } from '@playwright/test'

// Full-stack browser tests against real, locally-running servers — not
// mocked. See README.md for what needs to be up before running these.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false, // tests share seeded backend state (shop payment info, orders)
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
})

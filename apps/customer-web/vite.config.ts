/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server on 5173 (vendor-web uses 5174). The API's CORS config allows both.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // Force the default relative /vendor path regardless of what local dev's
    // .env.local sets — unit tests assert against that default, and dotenv
    // files aren't actually excluded from Vitest's env loading just because
    // they're named *.local.
    env: { VITE_VENDOR_WEB_BASE_URL: '' },
  },
})

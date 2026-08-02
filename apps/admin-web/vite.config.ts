/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server runs on 5175 (customer-web=5173, vendor-web=5174). The API's
// CORS config allows all three by default. Point VITE_API_BASE_URL at the
// Rails API.
//
// base: '/admin/' only for production builds — the built app is served by
// the Rails API under /admin/* (same domain as the other two), not its own
// separate host. Vite's dev server *does* respect `base` (it 302s "/" to
// it), so this must stay conditional or `npm run dev` breaks.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/admin/' : '/',
  plugins: [react()],
  server: {
    port: 5175,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
}))

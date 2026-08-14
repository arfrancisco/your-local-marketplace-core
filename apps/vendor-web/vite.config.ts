/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server runs on 5174 (customer-web will take 5173). The API's CORS config
// allows both origins by default. Point VITE_API_BASE_URL at the Rails API.
//
// base: '/vendor/' only for production builds — the built app is served by
// the Rails API under /vendor/* (same domain as customer-web), not its own
// separate host. Vite's dev server *does* respect `base` (it 302s "/" to it),
// so this must stay conditional or `npm run dev` breaks.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/vendor/' : '/',
  plugins: [react()],
  server: {
    port: 5174,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
}))

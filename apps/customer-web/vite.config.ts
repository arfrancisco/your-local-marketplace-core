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
  },
})

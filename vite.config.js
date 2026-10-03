import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  assetsInclude: ['**/*.pdf'],
  build: {
    // The letterhead template (~190 KB) is inlined into the JS bundle as a
    // data URI instead of being fetched at runtime, so browser extensions /
    // ad-blockers can never block it (net::ERR_BLOCKED_BY_CLIENT).
    assetsInlineLimit: 400 * 1024,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})

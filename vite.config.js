import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Fresh per-build id: the service worker is registered as sw.js?v=<id>, so
   every deploy installs a new worker and its activate step drops the caches
   of the previous build (the file itself lives in public/ and is copied
   verbatim, so the id can only be injected here). */
const BUILD_ID = String(Date.now())

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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

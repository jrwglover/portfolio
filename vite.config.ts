import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Stamped into the bundle so the dashboards can cache-bust their data fetches.
// A deploy that regenerated the JSON was still served from Cloudflare's cache,
// which showed the previous run's numbers with nothing to indicate it.
const BUILD_ID = Date.now().toString(36)

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss()],
})

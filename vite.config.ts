import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies API calls to the LocalReel server so the UI can use
// same-origin relative URLs in both development and production.
//
// The component dev server (`localreel-core/scripts/dev.ps1`) listens on 3101;
// an installed release listens on 3001. Override when you point the UI at
// something else:
//   $env:VITE_API_TARGET = 'http://127.0.0.1:3001'; npm run dev
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3101'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/thumbnails': apiTarget,
      '/transcodes': apiTarget,
    },
  },
})

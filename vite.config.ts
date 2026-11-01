import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies API calls to the LocalReel server so the UI can use
// same-origin relative URLs in both development and production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/thumbnails': 'http://127.0.0.1:3001',
      '/transcodes': 'http://127.0.0.1:3001',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Only VITE_* vars are bundled into the browser build. Never widen this:
  // anything exposed here is public to every visitor.
  envPrefix: ['VITE_'],
  // Unit tests only (e2e/ is run by Playwright)
  test: {
    include: ['tests/**/*.test.js'],
  },
  build: {
    rollupOptions: {
      output: {
        // Big libraries in their own files: they change rarely, so browsers
        // keep them cached across app releases (less data on mobile networks).
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          return undefined;
        },
      },
    },
  },
  // Short build id shown with error reports (Netlify sets COMMIT_REF)
  define: {
    __APP_BUILD__: JSON.stringify((process.env.COMMIT_REF || 'dev').slice(0, 7)),
  },
})

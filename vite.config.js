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
  // Short build id shown with error reports (Netlify sets COMMIT_REF)
  define: {
    __APP_BUILD__: JSON.stringify((process.env.COMMIT_REF || 'dev').slice(0, 7)),
  },
})

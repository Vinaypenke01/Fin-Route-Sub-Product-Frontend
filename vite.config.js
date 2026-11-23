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
})

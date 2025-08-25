import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// We won't add plugin as dev dependency to keep it minimal; Vite can run without it for JSX via esbuild.
// If missing, Vite still handles JSX with built-in esbuild transform in recent versions.
// Export a basic config.
export default defineConfig({
  server: { port: 5173 },
})

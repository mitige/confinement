import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  /*
   * Relative asset paths, so the same build works at a domain root and at a
   * sub-path — which is what GitHub Pages serves a project repository from
   * (mitige.github.io/confinement/). With the default absolute base the page
   * loads and then 404s every asset.
   */
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5273,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5273,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
})
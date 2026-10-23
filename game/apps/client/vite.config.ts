import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        levels: resolve(import.meta.dirname, 'levels.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 47220,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 47220,
    strictPort: true,
  },
})

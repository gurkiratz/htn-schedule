import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the build can be dropped into any subdirectory of a site.
  base: './',
  build: { outDir: 'dist' },
})

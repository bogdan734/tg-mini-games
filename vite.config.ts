import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /<repo>/ — dev server stays at /
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/tg-mini-games/' : '/',
  server: { host: true, port: 5173 },
}))

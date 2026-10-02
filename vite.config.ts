import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from joshuaswanson.github.io/cursed-chess/
  base: command === 'serve' && !isPreview ? '/' : '/cursed-chess/',
}))

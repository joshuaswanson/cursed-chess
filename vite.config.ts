import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from joshuaswanson.github.io/cursed-chess/
  base: command === "serve" && !isPreview ? "/" : "/cursed-chess/",
  // The random games played through every mode take a while on a slow machine
  test: { testTimeout: 120_000 },
  build: {
    rollupOptions: {
      output: {
        // React changes far less often than the game, so it is cached apart from it
        manualChunks: (id) =>
          /node_modules\/(react|react-dom|scheduler)\//.test(id)
            ? "react"
            : undefined,
      },
    },
  },
}));

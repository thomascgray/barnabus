import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 runs as a Vite plugin (no PostCSS config). `$lib` aliases the
  // shadcn-svelte component tree in src/lib (mirrors the SvelteKit convention so
  // shadcn's generated imports resolve in this plain-Vite app).
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
  server: {
    host: "localhost",
    port: 3000,
    // Forward backend paths to the bun --watch server so app code always uses
    // same-origin paths in both dev and prod (no if-dev branching).
    proxy: {
      "/api": "http://localhost:8080",
      "/uploads": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});

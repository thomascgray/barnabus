// vite.config.ts
import { defineConfig } from "file:///C:/Programming/barnabus/frontend/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///C:/Programming/barnabus/frontend/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import tailwindcss from "file:///C:/Programming/barnabus/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var vite_config_default = defineConfig({
  // Tailwind v4 runs as a Vite plugin (no PostCSS config). `$lib` aliases the
  // shadcn-svelte component tree in src/lib (mirrors the SvelteKit convention so
  // shadcn's generated imports resolve in this plain-Vite app).
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib")
    }
  },
  server: {
    host: "localhost",
    port: 3e3,
    // Forward backend paths to the bun --watch server so app code always uses
    // same-origin paths in both dev and prod (no if-dev branching).
    proxy: {
      "/api": "http://localhost:8080",
      "/uploads": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxQcm9ncmFtbWluZ1xcXFxiYXJuYWJ1c1xcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcUHJvZ3JhbW1pbmdcXFxcYmFybmFidXNcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1Byb2dyYW1taW5nL2Jhcm5hYnVzL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCB7IHN2ZWx0ZSB9IGZyb20gXCJAc3ZlbHRlanMvdml0ZS1wbHVnaW4tc3ZlbHRlXCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIC8vIFRhaWx3aW5kIHY0IHJ1bnMgYXMgYSBWaXRlIHBsdWdpbiAobm8gUG9zdENTUyBjb25maWcpLiBgJGxpYmAgYWxpYXNlcyB0aGVcbiAgLy8gc2hhZGNuLXN2ZWx0ZSBjb21wb25lbnQgdHJlZSBpbiBzcmMvbGliIChtaXJyb3JzIHRoZSBTdmVsdGVLaXQgY29udmVudGlvbiBzb1xuICAvLyBzaGFkY24ncyBnZW5lcmF0ZWQgaW1wb3J0cyByZXNvbHZlIGluIHRoaXMgcGxhaW4tVml0ZSBhcHApLlxuICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgc3ZlbHRlKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICRsaWI6IHBhdGgucmVzb2x2ZShcIi4vc3JjL2xpYlwiKSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcImxvY2FsaG9zdFwiLFxuICAgIHBvcnQ6IDMwMDAsXG4gICAgLy8gRm9yd2FyZCBiYWNrZW5kIHBhdGhzIHRvIHRoZSBidW4gLS13YXRjaCBzZXJ2ZXIgc28gYXBwIGNvZGUgYWx3YXlzIHVzZXNcbiAgICAvLyBzYW1lLW9yaWdpbiBwYXRocyBpbiBib3RoIGRldiBhbmQgcHJvZCAobm8gaWYtZGV2IGJyYW5jaGluZykuXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2FwaVwiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6ODA4MFwiLFxuICAgICAgXCIvdXBsb2Fkc1wiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6ODA4MFwiLFxuICAgICAgXCIvd3NcIjogeyB0YXJnZXQ6IFwid3M6Ly9sb2NhbGhvc3Q6ODA4MFwiLCB3czogdHJ1ZSB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFIsU0FBUyxvQkFBb0I7QUFDdlQsU0FBUyxjQUFjO0FBQ3ZCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUdqQixJQUFPLHNCQUFRLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUkxQixTQUFTLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQztBQUFBLEVBQ2pDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLE1BQU0sS0FBSyxRQUFRLFdBQVc7QUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBO0FBQUEsSUFHTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPLEVBQUUsUUFBUSx1QkFBdUIsSUFBSSxLQUFLO0FBQUEsSUFDbkQ7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

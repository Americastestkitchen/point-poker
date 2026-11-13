import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: "client",
  // React draws only the UI on top of the canvas; the 3D world stays plain Three.js.
  // Only index.html is built: gallery.html (the UI kit gallery) is dev-only.
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": api,
      "/ws": { target: api.replace("http", "ws"), ws: true },
    },
  },
});

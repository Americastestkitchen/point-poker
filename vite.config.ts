import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig(({ mode }) => ({
  root: "client",
  // React draws only the UI on top of the canvas; the 3D world stays plain Three.js.
  // Only index.html ships in dist; gallery mode checks the UI kit separately.
  plugins: [react()],
  build: mode === "gallery"
    // `npm run build:gallery`: bundles the gallery as a check, into a throwaway folder.
    ? { outDir: "../node_modules/.gallery", emptyOutDir: true, rolldownOptions: { input: "client/gallery.html" } }
    : { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": api,
      "/ws": { target: api.replace("http", "ws"), ws: true },
    },
  },
}));

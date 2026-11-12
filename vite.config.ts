import { defineConfig } from "vite";

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: "client",
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

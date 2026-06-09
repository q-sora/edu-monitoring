// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    // In development: proxy /api calls to the FastAPI backend
    // so the browser sees everything on port 3000 (no CORS issues).
    proxy: {
      "/api": {
        target: "http://192.168.13.245:8000",
        changeOrigin: true,
        // credentials (httpOnly cookies) are forwarded automatically
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          vendor:   ["react", "react-dom", "react-router-dom"],
          forms:    ["react-hook-form", "@hookform/resolvers", "zod"],
          network:  ["axios"],
        },
      },
    },
  },
});

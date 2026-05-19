import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // In local dev, proxy API calls to the Express server running on 3001
  server: {
    proxy: {
      "/me":       "http://localhost:3001",
      "/meals":    "http://localhost:3001",
      "/foods":    "http://localhost:3001",
      "/symptoms": "http://localhost:3001",
      "/health":   "http://localhost:3001",
    },
  },
  build: {
    outDir: "dist",
  },
});

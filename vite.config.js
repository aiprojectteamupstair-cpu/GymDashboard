import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/read-excel-file")) return "spreadsheet";
          if (id.includes("node_modules/react")) return "react";
        },
      },
    },
  },
});

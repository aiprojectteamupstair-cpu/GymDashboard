import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import process from 'node:process';

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  const backend = process.env.VITE_DATA_BACKEND || env.VITE_DATA_BACKEND || (command === 'serve' ? 'local' : 'supabase');
  if (!['local', 'supabase'].includes(backend)) throw new Error('VITE_DATA_BACKEND must be local or supabase.');
  if (command === 'build' && backend !== 'supabase') throw new Error('Local PostgreSQL is served by npm run dev. Production builds require VITE_DATA_BACKEND=supabase.');
  if (backend === 'supabase' && (!env.VITE_SUPABASE_PUBLISHABLE_KEY || (!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_USE_SAME_ORIGIN_PROXY !== 'true'))) throw new Error('Set the Supabase URL and publishable key in the environment.');
  return {
  plugins: [react(), ...(command === 'serve' && backend === 'local' ? [(await import('./server/local/vite-plugin.mjs')).localDatabasePlugin()] : [])],
  define: { 'import.meta.env.VITE_DATA_BACKEND': JSON.stringify(backend) },
  server: {
    host: '127.0.0.1', port: 3000, strictPort: false,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-db/**', '**/.private-imports/**'] },
  },
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
  };
});

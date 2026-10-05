import { defineConfig, loadEnv } from 'vite';
import process from 'node:process';
import react from '@vitejs/plugin-react';
import { localDatabasePlugin } from './server/local/vite-plugin.mjs';
import { workspaceBackend } from './config/backend.mjs';
import { supabaseRelayPlugin } from './server/supabase/vite-plugin.mjs';

export default defineConfig(({ mode, command, isPreview }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const backend = workspaceBackend(env, { command, mode, isPreview });
  return {
  define: { 'import.meta.env.VITE_BACKEND': JSON.stringify(backend.mode) },
  plugins: [react(), backend.mode === 'local' ? localDatabasePlugin() : supabaseRelayPlugin()],
  server: {
    host: '127.0.0.1', port: 3000, strictPort: false,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-db/**', '**/.private-imports/**'] },
  },
  preview: { host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts';
          if (id.includes('node_modules/read-excel-file')) return 'spreadsheet';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
};
});

import { backendConfig } from '../config/backend.mjs';
import { createLocalClient } from './local/client.js';
import { createSupabaseBackend } from './supabase/backend.js';

const config = backendConfig({
  VITE_BACKEND: import.meta.env.VITE_BACKEND,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
export const backendMode = config.mode;
export const backend = config.mode === 'supabase' ? createSupabaseBackend(config) : createLocalClient();

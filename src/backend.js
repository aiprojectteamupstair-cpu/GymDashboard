import { backendConfig } from '../config/backend.mjs';
import { createLocalClient } from './local/client.js';
import { createSupabaseBackend } from './supabase/backend.js';

const config = backendConfig(import.meta.env);
export const backendMode = config.mode;
export const backend = config.mode === 'supabase' ? createSupabaseBackend(config) : createLocalClient();

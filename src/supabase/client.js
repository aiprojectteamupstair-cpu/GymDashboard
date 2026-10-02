import { createClient } from '@supabase/supabase-js';
import { createLocalClient } from '../local/client.js';

export const isLocal = import.meta.env.VITE_DATA_BACKEND === 'local' || (import.meta.env.DEV && import.meta.env.VITE_DATA_BACKEND !== 'supabase');

const sameOriginProxy = import.meta.env.VITE_SUPABASE_USE_SAME_ORIGIN_PROXY === 'true';
export const SUPABASE_URL = sameOriginProxy
  ? new URL('/supabase', window.location.origin).href.replace(/\/$/, '')
  : import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).host : '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_SUPABASE_TIMEOUT_MS || 30000);

function timeoutSignal(baseSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!baseSignal) return timeout;
  return AbortSignal.any ? AbortSignal.any([baseSignal, timeout]) : baseSignal;
}

function describeNetworkFailure(error) {
  return new Error(
    `Network connection to the Supabase project API (${SUPABASE_HOST}) failed. ` +
    'The database is not changed. Check this computer/network can reach the project API over HTTPS, or set VITE_SUPABASE_URL to an approved proxy/custom domain and retry.',
    { cause: error },
  );
}

// Publishable key only. Authorization is enforced by Supabase Auth and table RLS.
export const supabase = isLocal ? createLocalClient() : createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: { persistSession: true, storage: window.sessionStorage, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options,
      signal: timeoutSignal(options.signal),
    }).catch(error => { throw describeNetworkFailure(error); }) },
  },
);

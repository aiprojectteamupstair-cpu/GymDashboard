import { createClient } from '@supabase/supabase-js';

// Publishable key only. Authorization is enforced by Supabase Auth and table RLS.
export const supabase = createClient(
  'https://axbfwmrrxsgzevvqshdu.supabase.co',
  'sb_publishable_Rzm48mMbwsjNV9VRmZ7wfQ_5oMejtxm',
  {
    auth: { persistSession: true, storage: window.sessionStorage, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    }) },
  },
);

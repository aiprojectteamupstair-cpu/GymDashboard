import { createClient } from '@supabase/supabase-js';
import { loadLiveData } from './readData.js';
import { createSupabaseFetch } from './transport.js';
import { browserSupabaseUrl, SUPABASE_PROJECT_REF } from '../../config/backend.mjs';

export function createSupabaseBackend({ key }) {
  const client = createClient(browserSupabaseUrl(globalThis.location.origin), key, {
    auth: { storageKey: `sb-${SUPABASE_PROJECT_REF}-auth-token` },
    global: { fetch: createSupabaseFetch() },
  });
  return {
    auth: client.auth,
    functions: client.functions,
    loadWorkspace: owner => loadLiveData(client, owner),
  };
}

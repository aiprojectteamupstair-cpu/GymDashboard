import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createCommandHandler } from './handler.js';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(createCommandHandler({
  userClient: (authorization: string) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { ...options, global: { headers: { Authorization: authorization } } }),
  adminClient: () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options),
}));

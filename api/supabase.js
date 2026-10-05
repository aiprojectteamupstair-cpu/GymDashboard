import { createHostedSupabaseRelay } from '../server/supabase/bootstrap.mjs';

export default { fetch: createHostedSupabaseRelay() };

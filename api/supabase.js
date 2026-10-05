import { createSupabaseRelay } from '../server/supabase/relay.mjs';

export default { fetch: createSupabaseRelay() };

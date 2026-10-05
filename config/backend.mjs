export const SUPABASE_PROJECT_REF = 'snbfdktwrgzhwjqmyhdz';

export function backendConfig(env = {}) {
  const mode = env.VITE_BACKEND || 'local';
  if (!['local', 'supabase'].includes(mode)) throw new Error('VITE_BACKEND must be local or supabase.');
  if (mode === 'local') return { mode };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url !== `https://${SUPABASE_PROJECT_REF}.supabase.co`) {
    throw new Error("Supabase URL must point to the selected TCF User's Database project.");
  }
  if (!key?.startsWith('sb_publishable_')) throw new Error('A Supabase publishable key is required.');
  return { mode, url, key };
}

export function browserSupabaseUrl(origin) {
  return new URL('/supabase', origin).href;
}

export function relayOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_RELAY_ORIGIN must be an HTTPS website origin without credentials or a path.');
  }
  return url.origin;
}

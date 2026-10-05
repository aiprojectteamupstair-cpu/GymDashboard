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

export function workspaceBackend(env, { command, mode, isPreview = false }) {
  // Commands select the backend; a developer's cloud settings cannot redirect dev.
  const local = mode === 'localdb' || (command === 'serve' && !isPreview);
  return backendConfig({ ...env, VITE_BACKEND: local ? 'local' : 'supabase' });
}

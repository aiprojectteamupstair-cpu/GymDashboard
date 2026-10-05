import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PROJECT_REF } from '../../config/backend.mjs';
import { createSupabaseRelay, readBody } from './relay.mjs';

const origin = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const equal = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const failure = () => Response.json({ message: 'Super Admin setup could not be completed. Check the server environment and bootstrap migration. Existing accounts are not reset.' }, {
  status: 503, headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' },
});

// Only the Vercel function imports this module. Never import it from src/.
export function createHostedSupabaseRelay({ env = process.env, fetcher = globalThis.fetch, clientFactory = createClient } = {}) {
  const relay = createSupabaseRelay(fetcher);
  return async request => {
    const url = new URL(request.url);
    const path = url.pathname.startsWith('/supabase/') ? url.pathname.slice(10) : url.searchParams.get('__supabase_path');
    const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = env.SUPER_ADMIN_PASSWORD;
    if (!email || !password || request.method !== 'POST' || path !== 'auth/v1/token' || url.searchParams.get('grant_type') !== 'password') {
      return relay(request);
    }
    if (!request.headers.get('apikey')?.startsWith('sb_publishable_')) return relay(request);
    // Read once with the relay's size limit; cloning an unread stream can buffer
    // arbitrary input or deadlock cancellation of an oversized request.
    let body;
    try { body = await readBody(request); }
    catch (error) {
      return Response.json({ message: 'Unable to read this request.' }, {
        status: error instanceof RangeError ? 413 : 400,
        headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' },
      });
    }
    const loginRequest = signal => new Request(request.url, { method: 'POST', headers: request.headers, body, signal });
    let credentials;
    try { credentials = JSON.parse(new TextDecoder().decode(body)); } catch { return relay(loginRequest(request.signal)); }
    if (typeof credentials?.email !== 'string' || typeof credentials.password !== 'string' ||
      credentials.email.trim().toLowerCase() !== email || !equal(credentials.password, password)) return relay(loginRequest(request.signal));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128 || !env.SUPABASE_SECRET_KEY) return failure();
    // Bound the entire auth/create/link sequence below the browser's 12s limit.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    let response = await relay(loginRequest(signal));
    if (![200, 400].includes(response.status)) return response;
    try {
      let result = await response.clone().json();
      const admin = clientFactory(origin, env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, options = {}) => fetcher(input, { ...options, signal, redirect: 'error' }) },
      });
      if (response.status === 400 && result.code === 'invalid_credentials') {
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        // A concurrent bootstrap may already have created the identity. Retry
        // authentication, never change its password, confirmation or ban status.
        if (created.error && !['email_exists', 'user_already_exists'].includes(created.error.code)) return failure();
        response = await relay(new Request(request.url, {
          method: 'POST', headers: request.headers, body: JSON.stringify(credentials), signal,
        }));
        result = await response.clone().json();
      }
      if (!response.ok) return response;
      if (!result.user?.id || result.user.email?.toLowerCase() !== email || !result.user.email_confirmed_at) return failure();
      const linked = await admin.rpc('bootstrap_super_admin_staff', {
        target_auth_id: result.user.id, expected_email: email,
      });
      if (linked.error || !linked.data) return failure();
      return response;
    } catch {
      // No request bodies, passwords, keys, tokens or upstream errors are logged.
      return failure();
    }
  };
}

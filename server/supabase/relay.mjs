import { SUPABASE_PROJECT_REF } from '../../config/backend.mjs';

const upstreamOrigin = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const tables = new Set(['app_staff', 'member_categories', 'packages', 'membership_plans', 'discounts',
  'members', 'member_codes', 'memberships', 'training_purchases', 'attendance', 'audit_events']);
const forwardedHeaders = ['apikey', 'authorization', 'content-type', 'accept', 'prefer', 'range',
  'range-unit', 'x-client-info', 'x-supabase-api-version'];
const responseHeaders = ['content-type', 'content-range', 'range-unit', 'retry-after', 'x-supabase-api-version'];
const noCache = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-TCF-Project': SUPABASE_PROJECT_REF };
const problem = (status, message) => Response.json({ message }, { status, headers: noCache });

function permitted(path, method, query) {
  if (path === 'auth/v1/health' || path === 'auth/v1/user') return method === 'GET';
  if (path === 'auth/v1/logout') return method === 'POST';
  if (path === 'auth/v1/token') return method === 'POST' && ['password', 'refresh_token'].includes(query.get('grant_type'));
  if (path.startsWith('rest/v1/')) return ['GET', 'HEAD'].includes(method) && tables.has(path.slice(8));
  return method === 'POST' && ['functions/v1/gym-commands', 'functions/v1/admin-accounts'].includes(path);
}

export async function readBody(request) {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 32768) { await reader.cancel(); throw new RangeError('Request too large.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.length; }
  return body;
}

export function createSupabaseRelay(fetcher = globalThis.fetch, timeoutMs = 10000) {
  return async request => {
    const url = new URL(request.url);
    const path = url.pathname.startsWith('/supabase/')
      ? url.pathname.slice('/supabase/'.length) : url.searchParams.get('__supabase_path');
    url.searchParams.delete('__supabase_path');
    // Older Vercel rewrites also inject the named :path capture into the query.
    // PostgREST treats every unrecognized query key as a column filter, so a
    // routing value such as path=rest/v1/app_staff must never reach the database.
    if (url.searchParams.get('path') === path) url.searchParams.delete('path');
    if (!path || !permitted(path, request.method, url.searchParams)) return problem(404, 'API route not available.');
    const apiKey = request.headers.get('apikey');
    if (!apiKey?.startsWith('sb_publishable_')) return problem(401, 'A publishable API key is required.');
    const headers = new Headers();
    for (const name of forwardedHeaders) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    // Only caller credentials cross this boundary. Cookies, Origin and proxy headers do not.
    const target = new URL(`/${path}`, upstreamOrigin);
    target.search = url.searchParams.toString();
    let body;
    try { body = await readBody(request); }
    catch (error) { return problem(error instanceof RangeError ? 413 : 400, 'Unable to read this request.'); }
    try {
      const upstream = await fetcher(target.href, { method: request.method, headers, body,
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), request.signal]), redirect: 'manual' });
      if (upstream.status >= 300 && upstream.status < 400) return problem(502, 'Unexpected database redirect.');
      const payload = request.method === 'HEAD' || upstream.status === 204 ? null : await upstream.arrayBuffer();
      const outputHeaders = new Headers(noCache);
      for (const name of responseHeaders) {
        if (upstream.headers.has(name)) outputHeaders.set(name, upstream.headers.get(name));
      }
      return new Response(payload, { status: upstream.status, headers: outputHeaders });
    } catch {
      return problem(503, 'The dashboard server could not reach the database. Please try again shortly.');
    }
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRelay } from '../server/supabase/relay.mjs';
import { browserSupabaseUrl } from '../config/backend.mjs';
import { createServer } from 'node:http';
import { supabaseRelayPlugin } from '../server/supabase/vite-plugin.mjs';

const headers = { apikey: 'sb_publishable_test', Authorization: 'Bearer synthetic-user-token' };
const req = (path, options = {}) => new Request(`https://gym.example${path}`, { headers, ...options });

test('browser Auth, reads and functions use the website origin', () => {
  assert.equal(browserSupabaseUrl('https://gym.example'), 'https://gym.example/supabase');
  assert.equal(browserSupabaseUrl('http://127.0.0.1:3001'), 'http://127.0.0.1:3001/supabase');
});

test('relay preserves login payload and status without forwarding cookies or caching tokens', async () => {
  let seen;
  const relay = createSupabaseRelay(async (url, options) => {
    seen = { url, options };
    return Response.json({ access_token: 'synthetic' }, { headers: { 'Set-Cookie': 'unwanted=value', 'Cache-Control': 'public, max-age=3600' } });
  });
  const body = JSON.stringify({ email: 'test@example.invalid', password: 'synthetic-only' });
  const response = await relay(req('/supabase/auth/v1/token?grant_type=password', {
    method: 'POST', body, headers: { ...headers, Cookie: 'local_session=private', Origin: 'https://gym.example', 'Content-Type': 'application/json' },
  }));
  assert.equal(seen.url, 'https://snbfdktwrgzhwjqmyhdz.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(new TextDecoder().decode(seen.options.body), body);
  assert.equal(seen.options.headers.get('Authorization'), headers.Authorization);
  assert.equal(seen.options.headers.has('Cookie'), false);
  assert.equal(seen.options.headers.has('Origin'), false);
  assert.equal(response.headers.has('Set-Cookie'), false);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');
  assert.equal((await response.json()).access_token, 'synthetic');
});

test('rewrite route preserves RLS read query, range and record totals', async () => {
  const relay = createSupabaseRelay(async (url, options) => {
    assert.equal(url, 'https://snbfdktwrgzhwjqmyhdz.supabase.co/rest/v1/members?select=id&offset=500');
    assert.equal(options.headers.get('Range'), '500-999');
    assert.equal(options.headers.get('Prefer'), 'count=exact');
    return Response.json([{ id: 'synthetic' }], { status: 206, headers: { 'Content-Range': '500-500/501' } });
  });
  const response = await relay(req('/api/supabase?__supabase_path=rest/v1/members&select=id&offset=500', {
    headers: { ...headers, Range: '500-999', Prefer: 'count=exact' },
  }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), '500-500/501');
});

test('relay refuses arbitrary targets, admin Auth, direct writes and oversized bodies', async () => {
  let calls = 0;
  const relay = createSupabaseRelay(async () => { calls++; return Response.json({}); });
  for (const path of ['/supabase/https://evil.invalid', '/supabase/auth/v1/admin/users', '/supabase/rest/v1/rpc/gym_command',
    '/api/supabase?__supabase_path=//evil.invalid', '/supabase/functions/v1/unknown']) {
    assert.equal((await relay(req(path))).status, 404);
  }
  assert.equal((await relay(req('/supabase/rest/v1/members', { method: 'POST', body: '{}' }))).status, 404);
  assert.equal((await relay(req('/supabase/auth/v1/health', { headers: {} }))).status, 401);
  assert.equal((await relay(req('/supabase/functions/v1/gym-commands', { method: 'POST', body: 'x'.repeat(32769) }))).status, 413);
  assert.equal(calls, 0);
});

test('upstream auth denials remain denials and redirects cannot expose credentials', async () => {
  const denied = createSupabaseRelay(async () => Response.json({ message: 'Invalid login credentials' }, { status: 400 }));
  const response = await denied(req('/supabase/auth/v1/token?grant_type=password', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Invalid login credentials');
  const redirect = createSupabaseRelay(async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 307, headers: { Location: 'https://evil.invalid' } });
  });
  assert.equal((await redirect(req('/supabase/auth/v1/health'))).status, 502);
});

test('upstream failures produce a redacted non-cacheable error', async () => {
  const relay = createSupabaseRelay(async () => { throw new Error('private upstream detail'); });
  const response = await relay(req('/supabase/auth/v1/health'));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private upstream detail'), false);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('both trusted write APIs and refresh/logout stay on the selected project', async () => {
  const relay = createSupabaseRelay(async url => {
    assert.equal(new URL(url).hostname, 'snbfdktwrgzhwjqmyhdz.supabase.co');
    return new Response(null, { status: 204 });
  });
  for (const path of ['functions/v1/gym-commands', 'functions/v1/admin-accounts', 'auth/v1/token?grant_type=refresh_token', 'auth/v1/logout']) {
    assert.equal((await relay(req(`/supabase/${path}`, { method: 'POST', body: '{}' }))).status, 204);
  }
});

test('production preview executes the relay with real HTTP bodies and leaves other routes alone', async () => {
  const plugin = supabaseRelayPlugin(createSupabaseRelay(async (url, options) => {
    assert.equal(new URL(url).hostname, 'snbfdktwrgzhwjqmyhdz.supabase.co');
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), { synthetic: true });
    return Response.json({ ok: true });
  }));
  assert.equal(plugin.configureServer, undefined);
  let middleware;
  plugin.configurePreviewServer({ middlewares: { use: handler => { middleware = handler; } } });
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/supabase/auth/v1/token?grant_type=password`, {
      method: 'POST', headers, body: JSON.stringify({ synthetic: true }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await fetch(`${origin}/api/local/workspace`)).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

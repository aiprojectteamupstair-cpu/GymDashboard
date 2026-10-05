import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedSupabaseRelay } from '../server/supabase/bootstrap.mjs';

const env = { SUPER_ADMIN_EMAIL: 'owner@example.test', SUPER_ADMIN_PASSWORD: 'test-owner-password', SUPABASE_SECRET_KEY: 'sb_secret_synthetic' };
const user = { id: '11111111-1111-4111-8111-111111111111', email: env.SUPER_ADMIN_EMAIL, email_confirmed_at: '2026-10-05T00:00:00Z' };
const request = (credentials = { email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD }, path = 'auth/v1/token?grant_type=password') => new Request(`https://gym.example/supabase/${path}`, {
  method: 'POST', headers: { apikey: 'sb_publishable_synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
});
const invalid = () => Response.json({ code: 'invalid_credentials' }, { status: 400 });
const signedIn = () => Response.json({ access_token: 'synthetic-token', user });

test('initial owner login creates confirmed Auth identity, links staff then returns normal session', async () => {
  const calls = [];
  let logins = 0;
  const handler = createHostedSupabaseRelay({ env, fetcher: async (_url, options) => {
    assert.equal(options.headers.get('apikey'), 'sb_publishable_synthetic');
    return ++logins === 1 ? invalid() : signedIn();
  }, clientFactory: (url, key, options) => {
    assert.equal(url, 'https://snbfdktwrgzhwjqmyhdz.supabase.co');
    assert.equal(key, env.SUPABASE_SECRET_KEY);
    assert.equal(options.auth.persistSession, false);
    return {
      auth: { admin: { createUser: async input => { calls.push(input); return { data: { user }, error: null }; } } },
      rpc: async (name, input) => { calls.push({ name, input }); return { data: 'staff-id', error: null }; },
    };
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(logins, 2);
  assert.deepEqual(calls, [{ email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD, email_confirm: true },
    { name: 'bootstrap_super_admin_staff', input: { target_auth_id: user.id, expected_email: user.email } }]);
  assert.equal((await response.json()).access_token, 'synthetic-token');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('ordinary/wrong-password logins and refresh never use privileged credentials', async () => {
  for (const input of [request({ email: 'admin@example.test', password: env.SUPER_ADMIN_PASSWORD }),
    request({ email: user.email, password: 'wrong-password' }), request({}, 'auth/v1/token?grant_type=refresh_token')]) {
    const handler = createHostedSupabaseRelay({ env, fetcher: async () => invalid(), clientFactory: () => assert.fail('Privileged client used') });
    assert.equal((await handler(input)).status, 400);
  }
});

test('existing confirmed owner is linked without password resets or account recreation', async () => {
  const handler = createHostedSupabaseRelay({ env, fetcher: async () => signedIn(), clientFactory: () => ({
    auth: { admin: { createUser: () => assert.fail('Existing account recreated') } },
    rpc: async () => ({ data: 'staff-id', error: null }),
  }) });
  assert.equal((await handler(request())).status, 200);
});

test('duplicate account or concurrent creation retries authentication but never resets password', async () => {
  let logins = 0;
  let linked = false;
  const handler = createHostedSupabaseRelay({ env, fetcher: async () => ++logins === 1 ? invalid() : signedIn(), clientFactory: () => ({
    auth: { admin: { createUser: async () => ({ error: { code: 'email_exists' } }) } },
    rpc: async () => { linked = true; return { data: 'staff-id' }; },
  }) });
  assert.equal((await handler(request())).status, 200);
  assert.equal(linked, true);
  const denied = createHostedSupabaseRelay({ env, fetcher: async () => invalid(), clientFactory: () => ({
    auth: { admin: { createUser: async () => ({ error: { code: 'email_exists' } }) } },
    rpc: () => assert.fail('Wrong existing password granted access'),
  }) });
  assert.equal((await denied(request())).status, 400);
});

test('link failures and invalid server configuration return no tokens or private errors', async () => {
  for (const settings of [env, { ...env, SUPABASE_SECRET_KEY: '' }, { ...env, SUPER_ADMIN_PASSWORD: 'short' }]) {
    const handler = createHostedSupabaseRelay({ env: settings, fetcher: async () => signedIn(), clientFactory: () => ({
      rpc: async () => ({ error: { message: 'private database detail' } }),
    }) });
    const response = await handler(request({ email: settings.SUPER_ADMIN_EMAIL, password: settings.SUPER_ADMIN_PASSWORD }));
    assert.equal(response.status, 503);
    const body = await response.text();
    for (const secret of ['private database detail', 'synthetic-token', env.SUPER_ADMIN_PASSWORD, env.SUPABASE_SECRET_KEY]) assert.equal(body.includes(secret), false);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('unconfirmed identities and oversized login bodies cannot invoke owner linking', async () => {
  const handler = createHostedSupabaseRelay({ env, fetcher: async () => Response.json({ user: { ...user, email_confirmed_at: null } }),
    clientFactory: () => ({ rpc: () => assert.fail('Unconfirmed user linked') }) });
  assert.equal((await handler(request())).status, 503);
  assert.equal((await handler(request({ email: user.email, password: 'x'.repeat(32769) }))).status, 413);
});

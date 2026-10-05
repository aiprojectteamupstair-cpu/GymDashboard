import test from 'node:test';
import assert from 'node:assert/strict';
import { backendConfig, workspaceBackend } from '../config/backend.mjs';
import { createAdminHandler } from '../supabase/functions/admin-accounts/handler.js';
import { createCommandHandler } from '../supabase/functions/gym-commands/handler.js';

test('development uses PostgreSQL even with cloud env; production requires cloud configuration', () => {
  const env = { VITE_BACKEND: 'supabase', VITE_SUPABASE_URL: 'https://snbfdktwrgzhwjqmyhdz.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.deepEqual(workspaceBackend({}, { command: 'serve', mode: 'development' }), { mode: 'local' });
  assert.deepEqual(workspaceBackend(env, { command: 'serve', mode: 'development' }), { mode: 'local' });
  assert.equal(workspaceBackend({ ...env, VITE_BACKEND: 'local' }, { command: 'build', mode: 'production' }).mode, 'supabase');
  assert.equal(workspaceBackend(env, { command: 'serve', mode: 'production', isPreview: true }).mode, 'supabase');
  assert.deepEqual(workspaceBackend({}, { command: 'build', mode: 'localdb' }), { mode: 'local' });
  assert.deepEqual(workspaceBackend({}, { command: 'serve', mode: 'localdb', isPreview: true }), { mode: 'local' });
  assert.throws(() => workspaceBackend({}, { command: 'build', mode: 'production' }), /selected/);
});

test('Supabase selection rejects mismatched projects and privileged keys', () => {
  const env = { VITE_BACKEND: 'supabase', VITE_SUPABASE_URL: 'https://snbfdktwrgzhwjqmyhdz.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.equal(backendConfig(env).mode, 'supabase');
  assert.deepEqual(backendConfig({ VITE_BACKEND: 'local' }), { mode: 'local' });
  assert.throws(() => backendConfig({ ...env, VITE_SUPABASE_URL: 'https://axbfwmrrxsgzevvqshdu.supabase.co' }), /selected/);
  assert.throws(() => backendConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' }), /publishable/);
  assert.throws(() => backendConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: '' }), /publishable/);
  assert.throws(() => backendConfig({ VITE_BACKEND: 'typo' }), /must be/);
});

test('both Edge APIs allow selected local dev/preview origins but still require authentication', async () => {
  const forbidden = () => { throw new Error('Unauthenticated request reached privileged client'); };
  for (const createHandler of [createAdminHandler, createCommandHandler]) {
    const handler = createHandler({ userClient: forbidden, adminClient: forbidden });
    for (const origin of ['http://127.0.0.1:3001', 'http://localhost:4173']) {
      const preflight = await handler(new Request('https://test.invalid', { method: 'OPTIONS', headers: { Origin: origin } }));
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
      const unauthenticated = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Origin: origin } }));
      assert.equal(unauthenticated.status, 401);
    }
    const unknown = await handler(new Request('https://test.invalid', { method: 'OPTIONS', headers: { Origin: 'https://untrusted.invalid' } }));
    assert.equal(unknown.status, 403);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminHandler } from '../supabase/functions/admin-accounts/handler.js';

function harness({ role = 'super_admin', authenticated = true, rpcError = null, linked = false, reconcileError = null } = {}) {
  const calls = [];
  const q = result => { const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => result }; return query; };
  const handler = createAdminHandler({
    userClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'owner' } : null } }) },
      from: () => q({ data: role ? { role_code: role, enabled: true } : null }) }),
    adminClient: () => { calls.push('privileged'); return {
      auth: { admin: { createUser: async input => { calls.push(['create', input]); return { data: { user: { id: 'new-user' } } }; },
        deleteUser: async id => { calls.push(['delete', id]); return {}; } } },
      rpc: async (name, args) => { calls.push([name, args]); return { data: rpcError ? null : 'staff-id', error: rpcError }; },
      from: () => q({ data: linked ? { id: 'staff-id' } : null, error: reconcileError }),
    }; },
  });
  return { handler, calls };
}
const body = { action: 'create', name: 'Synthetic Admin', email: 'test@example.invalid', password: 'abcdef' };
const req = (payload = body, headers = { Authorization: 'Bearer test-token' }) => new Request('http://localhost', { method: 'POST', headers, body: JSON.stringify(payload) });

test('Admin API denies anonymous, ordinary Admin and unaffiliated users before privileged operations', async () => {
  for (const options of [{ authenticated: false }, { role: 'admin' }, { role: null }]) {
    const { handler, calls } = harness(options);
    assert.ok([401, 403].includes((await handler(req())).status)); assert.deepEqual(calls, []);
  }
  const { handler, calls } = harness();
  assert.equal((await handler(req(body, {}))).status, 401);
  assert.equal((await handler(req(body, { Authorization: 'Bearer test', Origin: 'https://untrusted.invalid' }))).status, 403);
  assert.deepEqual(calls, []);
});

test('Admin API allows six characters and fixes role to admin; rejects escalation and five characters', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(req({ ...body, password: 'abcde' }))).status, 400);
  assert.equal((await handler(req({ ...body, role: 'super_admin' }))).status, 400);
  assert.equal((await handler(req())).status, 201);
  assert.equal(calls.find(c => Array.isArray(c) && c[0] === 'provision_admin_staff')[1].actor_auth_id, 'owner');
  assert.ok(!JSON.stringify(calls.find(c => Array.isArray(c) && c[0] === 'provision_admin_staff')).includes('abcdef'));
});

test('failed provisioning compensates only a newly created and conclusively unlinked identity', async () => {
  for (const [options, expectedDelete, expectedStatus] of [
    [{ rpcError: {} }, true, 503],
    [{ rpcError: {}, linked: true }, false, 200],
    [{ rpcError: {}, reconcileError: {} }, false, 503],
  ]) {
    const { handler, calls } = harness(options);
    assert.equal((await handler(req())).status, expectedStatus);
    assert.equal(calls.some(c => Array.isArray(c) && c[0] === 'delete'), expectedDelete);
  }
});

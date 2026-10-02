import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAuth, AUTH_KEY } from '../src/prototype/localAuth.js';

const store = () => {
  const data = new Map();
  return { getItem:key => data.get(key) ?? null, setItem:(key, value) => data.set(key, value), removeItem:key => data.delete(key) };
};

test('local default login is hashed and preserves existing account identity and Admins', async () => {
  for (const existing of [false, true]) {
    const storage = store(), session = store();
    const old = createLocalAuth(storage, session);
    let owner, admin;
    if (existing) {
      owner = await old.setup({ username:'owner', display_name:'Owner', password:'previous-password' });
      admin = await old.createAdmin({ username:'reception', display_name:'Reception', password:'reception-password' });
    }
    const auth = createLocalAuth(storage, session, () => new Date(), true);
    assert.equal(auth.isConfigured(), true);
    assert.equal(auth.currentUser(), null);
    const user = await auth.login('admin@communityfitness.local', 'Admin@12345');
    assert.equal(user.role, 'super_admin');
    if (existing) {
      assert.equal(user.id, owner.id);
      assert.ok(auth.listAccounts().some(account => account.id === admin.id));
      await assert.rejects(old.login('owner', 'previous-password'), /incorrect/);
    }
    const saved = storage.getItem(AUTH_KEY);
    assert.equal(saved.includes('Admin@12345'), false);
    assert.equal(auth.isConfigured(), true);
    assert.equal(storage.getItem(AUTH_KEY), saved);
    await assert.rejects(auth.login('admin@communityfitness.local', 'wrong'), /incorrect/);
  }
});

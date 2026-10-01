import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceSync, isTransientFailure } from '../src/supabase/workspaceSync.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('focus/auth bursts coalesce and background refresh keeps existing screen data', async () => {
  let time = 1000, calls = 0, response = Promise.resolve({ version: 1 });
  const sync = createWorkspaceSync(() => { calls++; return response; }, () => {}, () => time);
  sync.identity('owner'); await sync.refresh();
  assert.equal(sync.identity('owner'), false);
  await sync.refresh(); assert.equal(calls, 1);
  time += 31000;
  const wait = deferred(); response = wait.promise;
  const first = sync.refresh(), second = sync.refresh();
  assert.equal(first, second);
  assert.equal(sync.current().snapshot.version, 1);
  assert.equal(sync.current().busy, true);
  wait.resolve({ version: 2 }); await first;
  assert.equal(calls, 2); assert.equal(sync.current().snapshot.version, 2);
});

test('short network failure retains verified data but prolonged failure clears it', async () => {
  let time = 1000, failing = false;
  const sync = createWorkspaceSync(async () => { if (failing) throw new TypeError('Failed to fetch'); return { version: 1 }; }, () => {}, () => time);
  sync.identity('owner'); await sync.refresh(); failing = true;
  time += 31000; await sync.refresh();
  assert.equal(sync.current().snapshot.version, 1);
  assert.match(sync.current().error, /last verified/);
  time += 300000; await sync.refresh(); assert.equal(sync.current().snapshot, null);
});

test('revocation clears data immediately and old in-flight results cannot restore signed-out data', async () => {
  let response = Promise.resolve({ version: 1 });
  const sync = createWorkspaceSync(() => response, () => {});
  sync.identity('owner'); await sync.refresh();
  response = Promise.reject(new Error('Staff access changed. Please sign in again.'));
  await sync.refresh({ force: true }); assert.equal(sync.current().snapshot, null);
  const wait = deferred(); response = wait.promise;
  const request = sync.refresh({ force: true });
  sync.identity(null); wait.resolve({ version: 2 }); await request;
  assert.equal(sync.current().snapshot, null); assert.equal(sync.current().owner, null);
});

test('account switching discards previous identity responses', async () => {
  const wait = deferred();
  const sync = createWorkspaceSync(owner => owner === 'first' ? wait.promise : Promise.resolve({ owner }), () => {});
  sync.identity('first'); const old = sync.refresh();
  sync.identity('second'); await sync.refresh();
  wait.resolve({ owner: 'first' }); await old;
  assert.equal(sync.current().snapshot.owner, 'second');
});

test('wrapped transport failures are retryable but auth and permission failures are not', () => {
  assert.equal(isTransientFailure(new Error('Load failed', { cause: { status: 503 } })), true);
  assert.equal(isTransientFailure({ status: 403, message: 'fetch forbidden' }), false);
  assert.equal(isTransientFailure(new Error('Unable to fetch records', { cause: { status: 403 } })), false);
  assert.equal(isTransientFailure(new Error('Your account does not have an enabled staff profile.')), false);
});

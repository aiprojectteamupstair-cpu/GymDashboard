import test from 'node:test';
import assert from 'node:assert/strict';
import { CONNECTION_ERROR, createSupabaseFetch } from '../src/supabase/transport.js';
import { isTransientFailure } from '../src/supabase/workspaceSync.js';

test('network failures provide a useful message and never retry credential submissions', async () => {
  let calls = 0;
  const fetcher = createSupabaseFetch(async () => { calls++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(fetcher('https://example.invalid', { method: 'POST', body: 'private' }), error => {
    assert.equal(error.message, CONNECTION_ERROR);
    assert.equal(error.message.includes('private'), false);
    assert.equal(isTransientFailure(error), true);
    return true;
  });
  assert.equal(calls, 1);
});

test('a stalled request is aborted and returns the connection message', async () => {
  const fetcher = createSupabaseFetch((_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), 10);
  await assert.rejects(fetcher('https://example.invalid'), { message: CONNECTION_ERROR });
});

test('HTTP authentication errors pass through unchanged', async () => {
  const response = new Response('{"error":"Invalid login credentials"}', { status: 400 });
  const fetcher = createSupabaseFetch(async () => response);
  assert.equal(await fetcher('https://example.invalid'), response);
});

test('caller cancellation is preserved instead of becoming a network outage', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = createSupabaseFetch(async (_input, { signal }) => { signal.throwIfAborted(); });
  await assert.rejects(fetcher('https://example.invalid', { signal: controller.signal }), { name: 'AbortError' });
});

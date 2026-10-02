import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseRouting } from '../config/supabase-routing.mjs';
import { normalizeEndpoint, isMissingApiKey } from '../scripts/supabase-network-utils.mjs';

test('network check targets REST without credentials and requires the expected gateway response',()=>{
  assert.equal(normalizeEndpoint('https://example.supabase.co').href,'https://example.supabase.co/rest/v1/');
  assert.equal(normalizeEndpoint('https://example.supabase.co/rest/v1/').pathname,'/rest/v1/');
  for (const url of ['http://example.com','https://user:secret@example.com','https://example.com/?apikey=secret','https://example.com/rest/v1/members']) assert.throws(()=>normalizeEndpoint(url));
  assert.equal(isMissingApiKey(401,'{"message":"No API key found in request"}'),true);
  assert.equal(isMissingApiKey(401,'{"message":"Invalid API key"}'),false);
  assert.equal(isMissingApiKey(200,'{"message":"No API key found in request"}'),false);
  assert.equal(isMissingApiKey(401,'<html>Proxy unauthorized</html>'),false);
});

test('local proxy routes only /supabase to the configured project and rejects hosted project mismatch',()=>{
  const env={VITE_SUPABASE_USE_SAME_ORIGIN_PROXY:'true',VITE_SUPABASE_URL:'https://example.supabase.co'};
  const config=supabaseRouting(env,'serve');
  const [pattern]=Object.keys(config), proxy=config[pattern];
  assert.equal(new RegExp(pattern).test('/supabase/rest/v1/'),true);
  assert.equal(new RegExp(pattern).test('/supabase-other/rest/v1/'),false);
  assert.equal(proxy.target,env.VITE_SUPABASE_URL);
  assert.equal(proxy.rewrite('/supabase/rest/v1/?select=id'),'/rest/v1/?select=id');
  assert.equal(proxy.secure,true);
  assert.throws(()=>supabaseRouting(env,'build',[{source:'/supabase/:path*',destination:'https://another.supabase.co/:path*'}]),/does not match/);
  assert.deepEqual(supabaseRouting(env,'build',[{source:'/supabase/:path*',destination:'https://example.supabase.co/:path*'}]),{});
  assert.deepEqual(supabaseRouting({VITE_SUPABASE_USE_SAME_ORIGIN_PROXY:'false'},'serve'),{});
  assert.throws(()=>supabaseRouting({VITE_SUPABASE_USE_SAME_ORIGIN_PROXY:'true'},'serve'),/requires/);
});

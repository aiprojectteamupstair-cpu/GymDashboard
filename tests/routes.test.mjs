import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_PATHS, memberPath, resolveRoute, isPlainNavigation } from '../src/routes.js';

test('workspace routes cover every tab, member profiles and invalid paths', () => {
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    assert.deepEqual(resolveRoute(path), {page, path, memberId:null});
    if (path !== '/') assert.equal(resolveRoute(path + '/').path, path);
  }
  const id='12345678-1234-1234-1234-123456789abc';
  assert.equal(resolveRoute(memberPath(id)).memberId,id);
  assert.equal(resolveRoute('/members/%61bc').path,'/members/abc');
  for (const path of ['/no-page','/members/a/b','/members/%2F','/members/%zz','/check in','/api/local/workspace']) assert.equal(resolveRoute(path).page,'not-found');
});

test('navigation preserves modifier keys and native new-tab link behavior', () => {
  assert.equal(isPlainNavigation({button:0}),true);
  for (const event of [{button:1},{button:2},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true},{button:0,defaultPrevented:true}]) assert.equal(isPlainNavigation(event),false);
});

test('Vercel serves frontend deep links without swallowing API, relay or asset requests', () => {
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.deepEqual(config.rewrites[0],{source:'/supabase/:__supabase_path*',destination:'/api/supabase?__supabase_path=:__supabase_path*'});
  const fallback=config.rewrites[1];
  assert.equal(fallback.destination,'/index.html');
  const matcher=new RegExp('^'+fallback.source+'$');
  for (const path of [...Object.values(PAGE_PATHS),memberPath('test-member'),'/members/test-member/','/unknown-page']) assert.ok(matcher.test(path),path);
  for (const path of ['/api','/api/supabase','/api/local/workspace','/supabase','/supabase/rest/v1/members','/assets','/assets/app.js','/community-fitness-logo.png','/favicon.svg']) assert.ok(!matcher.test(path),path);
});

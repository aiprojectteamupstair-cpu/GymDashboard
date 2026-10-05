import { lookup } from 'node:dns/promises';
import { loadEnv } from 'vite';
import { backendConfig, SUPABASE_PROJECT_REF } from '../config/backend.mjs';

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const config = backendConfig({ ...env, VITE_BACKEND: 'supabase' });
if (!process.argv[2]) throw new Error('Provide the dashboard URL: npm run check:supabase -- https://YOUR-DASHBOARD.vercel.app');
const origin = new URL(process.argv[2]);
if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) {
  throw new Error('Use an HTTPS dashboard origin or an HTTP localhost origin.');
}
console.log(`Dashboard: ${origin.origin}`);
console.log(`Expected project: ${SUPABASE_PROJECT_REF}`);
try {
  const addresses = await lookup(origin.hostname, { all: true });
  console.log(`DNS: ${addresses.map(entry => entry.address).join(', ')}`);
  const response = await fetch(`${origin.origin}/supabase/auth/v1/health`, {
    headers: { apikey: config.key }, signal: AbortSignal.timeout(12000), redirect: 'error',
  });
  console.log(`Proxied Auth HTTP: ${response.status}`);
  await response.arrayBuffer();
  const verified = response.ok && response.headers.get('x-tcf-project') === SUPABASE_PROJECT_REF &&
    response.headers.get('content-type')?.includes('application/json');
  console.log(verified ? 'PASS: dashboard relay reached the selected Auth service.' : 'FAIL: hosted connection is not ready or did not reach the selected Auth service.');
  if (!verified) process.exitCode = 1;
} catch (error) {
  console.error(`Connection failed before an HTTP response (${error.cause?.code || error.name}).`);
  console.error('Check the hosted dashboard deployment and relay configuration. No login credentials were sent.');
  process.exitCode = 1;
}

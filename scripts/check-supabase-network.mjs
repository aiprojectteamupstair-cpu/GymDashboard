import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

function loadLocalEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Defaults below are enough for a connectivity check.
  }
}

function tcpCheck(address, port = 443, timeout = 10000) {
  return new Promise(resolveCheck => {
    const socket = net.createConnection({ host: address, port });
    const finish = result => {
      socket.destroy();
      resolveCheck(result);
    };
    socket.setTimeout(timeout, () => finish({ ok: false, error: 'timeout' }));
    socket.on('connect', () => finish({ ok: true }));
    socket.on('error', error => finish({ ok: false, error: error.code || error.message }));
  });
}

async function fetchCheck(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: `${error.name}: ${error.message}`, cause: error.cause?.code };
  }
}

loadLocalEnv();

const baseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://axbfwmrrxsgzevvqshdu.supabase.co';
const host = new URL(baseUrl).host;
const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']
  .filter(name => process.env[name])
  .map(name => `${name}=${process.env[name]}`);

console.log(`Supabase API host: ${host}`);
if (proxyVars.length) console.log(`Proxy environment: ${proxyVars.join(' | ')}`);

const addresses = await lookup(host, { all: true });
console.log(`DNS: ${addresses.map(row => `${row.address}/${row.family}`).join(', ') || 'none'}`);

for (const address of addresses) {
  const result = await tcpCheck(address.address);
  console.log(`TCP ${address.address}:443 ${result.ok ? 'ok' : `failed (${result.error})`}`);
}

const health = await fetchCheck(`${baseUrl.replace(/\/$/, '')}/auth/v1/health`);
console.log(`Fetch auth health: ${health.ok ? `HTTP ${health.status}` : `failed (${health.error}${health.cause ? `; ${health.cause}` : ''})`}`);

const publicSite = await fetchCheck('https://supabase.com');
console.log(`Fetch supabase.com: ${publicSite.ok ? `HTTP ${publicSite.status}` : `failed (${publicSite.error}${publicSite.cause ? `; ${publicSite.cause}` : ''})`}`);

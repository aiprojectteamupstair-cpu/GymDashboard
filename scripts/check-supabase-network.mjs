import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import { normalizeEndpoint, isMissingApiKey } from './supabase-network-utils.mjs';

try {
  const env=parseEnv(readFileSync('.env.local','utf8'));
  for (const [key,value] of Object.entries(env)) if (!(key in process.env)) process.env[key]=value;
} catch (error) { if (error.code!=='ENOENT') throw error; }

function tcpCheck(address, port) {
  return new Promise(resolve => {
    const start=Date.now();
    const socket=net.createConnection({host:address,port});
    const finish=error=>{socket.destroy();resolve({address,ok:!error,error,ms:Date.now()-start});};
    socket.setTimeout(8000,()=>finish('timeout'));
    socket.once('connect',()=>finish(null));
    socket.once('error',error=>finish(error.code || error.message));
  });
}

function httpsCheck(url, accept='application/json') {
  return new Promise(resolve => {
    const start=Date.now();
    // Direct HTTPS, without proxy agents, credentials or cross-host redirects.
    const request=https.get(url,{agent:false,signal:AbortSignal.timeout(12000),headers:{Accept:accept}},response=>{
      let body='';
      response.setEncoding('utf8');
      response.on('data',chunk=>{if (body.length<4096) body+=chunk.slice(0,4096-body.length);});
      response.on('end',()=>resolve({ok:true,status:response.statusCode,body,ms:Date.now()-start}));
      response.on('error',error=>resolve({ok:false,error:error.code || error.message,ms:Date.now()-start}));
    });
    request.on('error',error=>resolve({ok:false,error:error.code || error.message,ms:Date.now()-start}));
  });
}

try {
  const endpoint=normalizeEndpoint(process.argv[2] || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  console.log(`Endpoint: ${endpoint.href}`);
  console.log('Direct connection; no API key, Authorization header, or proxy. Network/VPN settings are not modified.');
  const configured=['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY'].filter(name=>process.env[name]);
  if (configured.length) console.log(`Ignored proxy variables: ${configured.join(', ')} (values withheld)`);
  let addresses=[];
  try { addresses=await lookup(endpoint.hostname,{all:true}); console.log(`DNS: ${addresses.map(row=>row.address).join(', ')}`); }
  catch (error) { console.log(`DNS failed: ${error.code || error.message}`); }
  const [tcp,api,control]=await Promise.all([
    Promise.all(addresses.map(row=>tcpCheck(row.address,Number(endpoint.port)||443))),
    httpsCheck(endpoint), httpsCheck(new URL('https://supabase.com'), '*/*'),
  ]);
  for (const result of tcp) console.log(`TCP ${result.address}:${endpoint.port || 443}: ${result.ok?'OK':result.error} (${result.ms}ms)`);
  console.log(`REST without API key: ${api.ok?`HTTP ${api.status}`:api.error} (${api.ms}ms)`);
  if (api.ok && isMissingApiKey(api.status,api.body)) {
    console.log('PASS: Supabase returned HTTP 401 / No API key found in request. The public API is reachable on this route.');
  } else {
    process.exitCode=1;
    console.log(!addresses.length ? 'FAIL: DNS resolution failed.' : tcp.length && tcp.every(row=>!row.ok)
      ? 'FAIL: DNS resolved but TCP connections failed before HTTP. Check the network path/firewall; changing API keys cannot fix this result.'
      : 'FAIL: Expected HTTP 401 / No API key was not observed. Inspect TLS/HTTP routing or project availability.');
  }
  console.log(`Control supabase.com: ${control.ok?`HTTP ${control.status}`:control.error}`);
} catch (error) { console.error(error.message); process.exitCode=1; }

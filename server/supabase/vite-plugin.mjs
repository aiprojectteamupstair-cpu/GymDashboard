import { relayOrigin } from '../../config/backend.mjs';

export function supabaseRelayPlugin(env) {
  const origin = relayOrigin(env.SUPABASE_RELAY_ORIGIN);
  const proxy = origin ? { '/supabase': {
    target: origin, changeOrigin: true, secure: true, timeout: 15000, proxyTimeout: 12000,
  } } : undefined;
  const attach = server => {
    if (origin) return;
    server.middlewares.use('/supabase', (_request, response) => {
      response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ message: 'The hosted dashboard connection is not configured yet.' }));
    });
  };
  return {
    name: 'community-fitness-hosted-relay',
    config: () => ({ server: { proxy }, preview: { proxy } }),
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

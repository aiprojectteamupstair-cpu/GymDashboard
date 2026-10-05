import { Readable } from 'node:stream';
import { createSupabaseRelay } from './relay.mjs';

// Vite preview reuses the production handler without a deployed-site dependency.
export function supabaseRelayPlugin(relay = createSupabaseRelay()) {
  return {
    name: 'community-fitness-production-preview',
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/supabase/')) return next();
        try {
          const controller = new AbortController();
          res.once('close', () => controller.abort());
          const request = new Request(new URL(req.url, 'http://localhost'), {
            method: req.method, headers: req.headers, signal: controller.signal,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
          });
          const response = await relay(request);
          const body = Buffer.from(await response.arrayBuffer());
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(body);
        } catch {
          if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ message: 'The production preview could not reach the database.' }));
        }
      });
    },
  };
}

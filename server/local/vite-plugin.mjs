import { startDatabase } from './runtime.mjs';
import { createLocalApi } from './api.mjs';

export function localDatabasePlugin() {
  async function attach(server) {
    const pool=await startDatabase();
    server.middlewares.use(createLocalApi(pool));
    server.httpServer?.once('close',()=>{ void pool.end(); });
  }
  return {
    name:'community-fitness-local-database',
    configureServer:attach,
    configurePreviewServer:attach,
  };
}

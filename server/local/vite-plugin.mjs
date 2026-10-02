import { startDatabase } from './runtime.mjs';
import { createLocalApi } from './api.mjs';

export function localDatabasePlugin() {
  return {
    name:'community-fitness-local-database',
    async configureServer(server) {
      const pool=await startDatabase();
      server.middlewares.use(createLocalApi(pool));
      server.httpServer?.once('close',()=>{ void pool.end(); });
    },
  };
}

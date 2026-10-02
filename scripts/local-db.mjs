import { startDatabase, stopDatabase } from '../server/local/runtime.mjs';

if (process.argv[2]==='stop') {
  await stopDatabase();
  console.log('Local PostgreSQL stopped. Data retained.');
} else {
  const pool=await startDatabase();
  const { rows }=await pool.query('SELECT current_database() AS database, version()');
  console.log(`${rows[0].database}: ${rows[0].version}`);
  await pool.end();
}

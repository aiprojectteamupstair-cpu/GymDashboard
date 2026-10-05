import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { initializeDatabase } from './database.mjs';

const run = promisify(execFile);
// pg_ctl can pass inherited pipes to the background PostgreSQL process on
// Windows. Waiting for those pipes to close leaves startup pending indefinitely.
const controlDatabase = (file, args) => new Promise((resolveControl, reject) => {
  const child = spawn(file, args, { windowsHide: true, stdio: 'ignore' });
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error('PostgreSQL control timed out. Check .local-db/postgres.log.'));
  }, 40000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => {
    clearTimeout(timer);
    if (code === 0) resolveControl();
    else reject(new Error(`PostgreSQL control failed (${code}). Check .local-db/postgres.log.`));
  });
});
export const root = resolve('.local-db');
const directory = join(root,'postgres');
const configFile = join(root,'connection.json');
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const binaries = () => import(`@embedded-postgres/${platform}-${process.arch}`);
const exists = file => access(file).then(()=>true,()=>false);

export async function startDatabase() {
  await mkdir(root,{recursive:true});
  let config;
  if (await exists(configFile)) config=JSON.parse(await readFile(configFile,'utf8'));
  else {
    config={ host:'127.0.0.1', port:55432, user:'gym_local_owner', password:randomBytes(32).toString('hex'), database:'community_fitness_local' };
    await writeFile(configFile,JSON.stringify(config),{mode:0o600,flag:'wx'});
  }
  const { initdb, pg_ctl }=await binaries();
  if (!await exists(join(directory,'PG_VERSION'))) {
    const passwordFile=join(root,'init-password');
    await writeFile(passwordFile,config.password,{mode:0o600});
    try {
      await run(initdb,['-D',directory,'-U',config.user,'--auth=scram-sha-256',`--pwfile=${passwordFile}`,'--encoding=UTF8','--locale=C'],{windowsHide:true});
    } finally { await unlink(passwordFile); }
  }
  const running=await controlDatabase(pg_ctl,['status','-D',directory]).then(()=>true,()=>false);
  if (!running) await controlDatabase(pg_ctl,['start','-D',directory,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${Number(config.port)}`,'-w','-t','30']);
  const admin=new pg.Client({...config,database:'postgres',connectionTimeoutMillis:5000});
  await admin.connect();
  try {
    if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[config.database])).rowCount) {
      await admin.query('CREATE DATABASE community_fitness_local');
    }
  } finally { await admin.end(); }
  const pool=new pg.Pool({...config,max:5,connectionTimeoutMillis:5000});
  pool.on('error',()=>console.warn('Local PostgreSQL connection interrupted. Run npm run db:start to reconnect.'));
  try {
    await initializeDatabase(pool,{
      email:'admin@communityfitness.local',
      salt:'66c574c2880d4e2e9ac18c2ef69a79bf',
      hash:'7f8170fef39f48d7693a0bab3b0fe627ed17712f0d997ea3f5b52f509fe34391',
    });
  } catch (error) { await pool.end(); throw error; }
  return pool;
}

export async function stopDatabase() {
  if (!await exists(join(directory,'PG_VERSION'))) return;
  const { pg_ctl }=await binaries();
  await controlDatabase(pg_ctl,['stop','-D',directory,'-m','fast','-w','-t','30']);
}

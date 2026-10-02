import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { initializeDatabase } from './database.mjs';

const run = promisify(execFile);
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
  const running=await run(pg_ctl,['status','-D',directory],{windowsHide:true}).then(()=>true,()=>false);
  if (!running) await run(pg_ctl,['start','-D',directory,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${Number(config.port)}`,'-w','-t','30'],{windowsHide:true});
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
  await run(pg_ctl,['stop','-D',directory,'-m','fast','-w','-t','30'],{windowsHide:true});
}

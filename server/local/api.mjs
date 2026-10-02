import { createHash, randomBytes, pbkdf2 as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { transaction, loadSnapshot, runCommand } from './database.mjs';

const pbkdf2 = promisify(derive);
export const hashPassword = async (password, salt) => (await pbkdf2(password, Buffer.from(salt,'hex'), 210000, 32, 'sha256')).toString('hex');
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const publicAccount = row => ({ id:row.id, user_id:row.id, email:row.email, display_name:row.display_name, role_code:row.role_code, enabled:row.enabled });
const failure = (message, status=400) => Object.assign(new Error(message), { status });
const cookieName = 'community_fitness_local_session';

export function createLocalApi(pool) {
  const attempts = new Map();
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/local/')) return next?.();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type','application/json');
    try {
      const host = new URL(`http://${req.headers.host}`).hostname;
      if (!['localhost','127.0.0.1','[::1]'].includes(host)) throw failure('Local access only.',403);
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw failure('Origin rejected.',403);
      if (req.headers['sec-fetch-site'] === 'cross-site') throw failure('Origin rejected.',403);
      if (!['GET','POST'].includes(req.method)) throw failure('Method not allowed.',405);
      let body = {};
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) throw failure('JSON required.',415);
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if (size>262144) throw failure('Request too large.',413); chunks.push(chunk); }
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw failure('Invalid JSON.'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') throw failure('Invalid request.');
      }
      const token = req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${cookieName}=`))?.slice(cookieName.length+1) || '';
      const setCookie = (value, age) => res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api/local; Max-Age=${age}`);
      const result = await transaction(pool, async db => {
        const path = url.pathname.slice('/api/local/'.length);
        if (path === 'login' && req.method === 'POST') {
          const key = req.socket.remoteAddress;
          const now=Date.now(); const recent=(attempts.get(key)||[]).filter(time=>time>now-60000);
          if (recent.length>=10) throw failure('Too many attempts. Try again in a minute.',429);
          attempts.set(key,[...recent,now]);
          if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length>128) throw failure('Email or password is incorrect.',401);
          const row=(await db.query('SELECT * FROM gym_local.accounts WHERE email=$1 AND enabled', [body.email.trim().toLowerCase()])).rows[0];
          const actual=await hashPassword(body.password, row?.salt || '00000000000000000000000000000000');
          if (!row || !timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(row.password_hash,'hex'))) throw failure('Email or password is incorrect.',401);
          const value=randomBytes(32).toString('hex');
          await db.query('DELETE FROM gym_local.sessions WHERE expires_at<=now() OR token_hash=$1',[tokenHash(token)]);
          await db.query("INSERT INTO gym_local.sessions VALUES ($1,$2,now()+interval '8 hours')",[tokenHash(value),row.id]);
          attempts.delete(key);
          return { user:publicAccount(row), cookie:value };
        }
        if (path==='logout' && req.method==='POST') {
          await db.query('DELETE FROM gym_local.sessions WHERE token_hash=$1',[tokenHash(token)]);
          return { logout:true };
        }
        const actor=(await db.query(`SELECT a.* FROM gym_local.accounts a JOIN gym_local.sessions s ON a.id=s.account_id
          WHERE s.token_hash=$1 AND s.expires_at>now() AND a.enabled`,[tokenHash(token)])).rows[0];
        if (path==='session' && req.method==='GET') return { user:actor ? publicAccount(actor) : null };
        if (!actor) throw failure('Please sign in again.',401);
        if (path==='workspace' && req.method==='GET') return { data:await loadSnapshot(db), staff:publicAccount(actor) };
        if (path==='gym-commands' && req.method==='POST') {
          if (!body.payload || typeof body.payload!=='object' || Array.isArray(body.payload)) throw failure('Invalid command payload.');
          return { result:await runCommand(db,actor,body.command,body.payload,body.request_id) };
        }
        if (path==='admin-accounts' && req.method==='POST') {
          if (actor.role_code!=='super_admin') throw failure('Only Super Admin can manage accounts.',403);
          if (body.action==='list') return { accounts:(await db.query('SELECT * FROM gym_local.accounts ORDER BY created_at')).rows.map(publicAccount) };
          let account;
          if (body.action==='create') {
            const email=typeof body.email==='string' ? body.email.trim().toLowerCase() : '';
            const name=typeof body.name==='string' ? body.name.trim() : '';
            if (!name || name.length>120 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure('Enter a name and valid email.');
            if (typeof body.password!=='string' || body.password.length<6 || body.password.length>128) throw failure('Use a password of 6-128 characters.');
            const salt=randomBytes(16).toString('hex');
            const hash=await hashPassword(body.password,salt);
            account=(await db.query(`INSERT INTO gym_local.accounts(id,email,display_name,role_code,salt,password_hash)
              VALUES ($1,$2,$3,'admin',$4,$5) RETURNING *`,[crypto.randomUUID(),email,name,salt,hash])).rows[0];
          } else if (body.action==='delete') {
            account=(await db.query("DELETE FROM gym_local.accounts WHERE id=$1 AND role_code='admin' RETURNING *",[body.id])).rows[0];
            if (!account) throw failure('Admin account not found. Super Admin cannot be deleted.');
          } else throw failure('Unknown account action.');
          await db.query('INSERT INTO gym_local.account_audit(id,actor_id,action,account) VALUES ($1,$2,$3,$4)',[crypto.randomUUID(),actor.id,`account.${body.action}`,JSON.stringify(publicAccount(account))]);
          return { account:publicAccount(account) };
        }
        throw failure('Not found.',404);
      });
      if (result.cookie) { setCookie(result.cookie,28800); delete result.cookie; }
      if (result.logout) setCookie('',0);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode=error.status || (error.code==='23505' ? 409 : error.code && !/^(22|23)/.test(error.code) ? 503 : 400);
      res.end(JSON.stringify({ error:error.code==='23505' ? 'This record already exists.' : error.code ? 'Database operation failed.' : error.message }));
    }
  };
}

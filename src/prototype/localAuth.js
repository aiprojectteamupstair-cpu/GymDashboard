// Local-device workflow only. Browser storage is user-editable, not a security boundary.
// Replace with trusted Auth + server-side role checks before a shared/live deployment.
export const AUTH_KEY = 'community-fitness:local-accounts:v1';
export const SESSION_KEY = 'community-fitness:local-session:v1';
const ITERATIONS = 210000;
const publicUser = ({ id, username, display_name, role, created_at }) => ({ id, username, display_name, role, created_at });
const bytes = value => new Uint8Array(value.match(/../g).map(hex => parseInt(hex, 16)));
const hex = value => Array.from(new Uint8Array(value), n => n.toString(16).padStart(2, '0')).join('');

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name:'PBKDF2', salt:bytes(salt), iterations:ITERATIONS, hash:'SHA-256' }, key, 256));
}

export function createLocalAuth(storage = window.localStorage, session = window.sessionStorage, clock = () => new Date()) {
  function read() {
    const raw = storage.getItem(AUTH_KEY);
    if (!raw) return { version:1, accounts:[], audit:[] };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.accounts) || !Array.isArray(data.audit)) throw new Error('Local accounts could not be read. Saved accounts have not been replaced.');
    return data;
  }
  function currentUser() {
    const raw = session.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const row = read().accounts.find(a => a.id === saved.userId && a.session_version === saved.version);
    return row && saved.expiresAt > clock().getTime() ? publicUser(row) : null;
  }
  function requireUser(role) {
    const user = currentUser();
    if (!user) throw new Error('Please sign in again to continue.');
    if (role && user.role !== role) throw new Error('Only Super Admin can perform this action.');
    return user;
  }
  function startSession(row) {
    session.setItem(SESSION_KEY, JSON.stringify({ userId:row.id, version:row.session_version, expiresAt:clock().getTime()+8*60*60*1000 }));
    return publicUser(row);
  }
  async function create(input, initial = false) {
    if (initial && read().accounts.length > 0) throw new Error('Super Admin has already been set up.');
    if (!initial) requireUser('super_admin');
    const username = input.username?.trim().toLowerCase();
    const name = input.display_name?.trim();
    if (!name || !/^[a-z0-9._-]{3,60}$/.test(username || '')) throw new Error('Enter a name and a username of 3–60 letters, numbers, dots, underscores or hyphens.');
    const minimumLength = initial ? 12 : 6;
    if (typeof input.password !== 'string' || input.password.length < minimumLength || input.password.length > 128) throw new Error(`Use a password of ${minimumLength}–128 characters.`);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const password_hash = await passwordHash(input.password, salt);
    // Re-read after hashing so another tab's account changes are not overwritten.
    const actor = initial ? null : requireUser('super_admin');
    const data = read();
    if (initial && data.accounts.length) throw new Error('Super Admin has already been set up.');
    if (data.accounts.some(a => a.username === username)) throw new Error('This username is already in use.');
    const row = { id:crypto.randomUUID(), username, display_name:name, role:initial ? 'super_admin' : 'admin', salt, password_hash, session_version:crypto.randomUUID(), created_at:clock().toISOString() };
    data.accounts.push(row);
    data.audit.push({ action:'account.created', actor_id:actor?.id || row.id, account:publicUser(row), occurred_at:clock().toISOString() });
    storage.setItem(AUTH_KEY, JSON.stringify(data));
    return initial ? startSession(row) : publicUser(row);
  }
  return {
    isConfigured: () => read().accounts.length > 0,
    currentUser, requireUser,
    setup: input => create(input, true),
    createAdmin: input => create(input),
    async login(username, password) {
      const row = read().accounts.find(a => a.username === username.trim().toLowerCase());
      if (!row || await passwordHash(password, row.salt) !== row.password_hash) throw new Error('Username or password is incorrect.');
      const fresh = read().accounts.find(a => a.id === row.id && a.session_version === row.session_version);
      if (!fresh) throw new Error('This account is no longer available.');
      return startSession(fresh);
    },
    logout() { session.removeItem(SESSION_KEY); },
    listAccounts() { requireUser('super_admin'); return read().accounts.map(publicUser); },
    deleteAdmin(id) {
      const actor = requireUser('super_admin');
      const data = read();
      const row = data.accounts.find(a => a.id === id);
      if (!row || row.role !== 'admin') throw new Error('Only Admin accounts can be deleted. The Super Admin account is kept.');
      data.accounts = data.accounts.filter(a => a.id !== id);
      data.audit.push({ action:'account.deleted', actor_id:actor.id, account:publicUser(row), occurred_at:clock().toISOString() });
      storage.setItem(AUTH_KEY, JSON.stringify(data));
    },
  };
}

import { allowedOrigins } from '../_shared/origins.js';

export function createAdminHandler({ userClient, adminClient }) {
  return async request => {
    const origin = request.headers.get('origin');
    const origins = new Set(allowedOrigins());
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : 'http://127.0.0.1:3000',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, { error: 'Please sign in.' });
    try {
      const caller = userClient(authorization);
      const { data: identity, error: authError } = await caller.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      if (authError || !identity?.user) return reply(401, { error: 'Please sign in again.' });
      const { data: staff, error: staffError } = await caller.from('app_staff').select('id,role_code,enabled,deleted_at')
        .eq('user_id', identity.user.id).eq('enabled', true).is('deleted_at', null).maybeSingle();
      if (staffError || !staff || staff.role_code !== 'super_admin') return reply(403, { error: 'Super Admin access required.' });
      const raw = await request.text();
      if (raw.length > 4096) return reply(413, { error: 'Request too large.' });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid request.' }); }
      if (!body || !['list', 'create', 'delete'].includes(body.action)) return reply(400, { error: 'Unsupported action.' });
      if (body.action === 'create' && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120 ||
        typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
        typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128 ||
        (body.role && body.role !== 'admin'))) return reply(400, { error: 'Enter a name, valid email and a password of 6–128 characters. Only Admin accounts can be created.' });
      const admin = adminClient();
      if (body.action === 'delete') {
        if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) return reply(400, { error: 'Choose an Admin account.' });
        const disabled = await admin.rpc('disable_admin_account', { actor_auth_id: identity.user.id, target_staff_id: body.id });
        if (disabled.error) return reply(403, { error: 'Unable to remove this account. Only another Admin may be removed.' });
        const removal = disabled.data ? await admin.auth.admin.deleteUser(disabled.data) : { error: null };
        return reply(200, { deleted: true, warning: removal.error ? 'Access revoked. Auth cleanup needs review by the Super Admin.' : null });
      }
      if (body.action === 'list') {
        const accounts = [];
        for (let start = 0; ; start += 100) {
          const { data, error } = await admin.from('app_staff').select('id,user_id,display_name,role_code,enabled,deleted_at')
            .is('deleted_at', null).order('id').range(start, start + 99);
          if (error) return reply(503, { error: 'Unable to load Admin accounts.' });
          for (const row of data) {
            const identity = row.user_id ? await admin.auth.admin.getUserById(row.user_id) : null;
            accounts.push({ id: row.id, display_name: row.display_name, role_code: row.role_code, enabled: row.enabled, email: identity?.data?.user?.email || null });
          }
          if (data.length < 100) return reply(200, { accounts });
        }
      }
      const { data, error } = await admin.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true });
      if (error || !data?.user) return reply(400, { error: error?.code === 'email_exists' || error?.code === 'user_already_exists'
        ? 'This email already has an Auth account. Existing accounts are not changed automatically.'
        : 'Unable to create account. Check email availability and the project password policy.' });
      const userId = data.user.id;
      const result = await admin.rpc('provision_admin_staff', { actor_auth_id: identity.user.id, target_auth_id: userId, staff_name: body.name.trim() });
      if (result.error) {
        // A response can be lost after commit. Reconcile before any compensation.
        const check = await admin.from('app_staff').select('id').eq('user_id', userId).maybeSingle();
        if (check.data) return reply(200, { created: true });
        if (!check.error) {
          const cleanup = await admin.auth.admin.deleteUser(userId);
          if (!cleanup.error) return reply(503, { error: 'Staff setup failed. The newly created sign-in was rolled back. Please retry.' });
        }
        return reply(503, { error: 'Account setup could not be confirmed. Contact the Super Admin before retrying.' });
      }
      return reply(201, { created: true });
    } catch {
      // Never log request bodies, passwords, tokens or privileged keys.
      return reply(503, { error: 'Account service unavailable. Refresh the account list before retrying.' });
    }
  };
}

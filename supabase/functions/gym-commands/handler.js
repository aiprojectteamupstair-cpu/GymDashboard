import { allowedOrigins as configuredOrigins } from '../_shared/origins.js';

export function createCommandHandler({ userClient, adminClient, allowedOrigins = configuredOrigins() }) {
  const commands = new Set(['member.save', 'member.archive', 'membership.add', 'attendance.checkin', 'attendance.time', 'attendance.calendar', 'catalogue.save', 'catalogue.status']);
  return async request => {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, { error: 'Please sign in.' });
    try {
      const caller = userClient(authorization);
      const { data, error } = await caller.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      if (error || !data?.user) return reply(401, { error: 'Please sign in again.' });
      const profile = await caller.from('app_staff').select('id,role_code').eq('user_id', data.user.id).eq('enabled', true).is('deleted_at', null).maybeSingle();
      if (profile.error || !profile.data) return reply(403, { error: 'Enabled staff access required.' });
      const raw = await request.text();
      if (raw.length > 24000) return reply(413, { error: 'Request too large.' });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid request.' }); }
      if (!commands.has(body?.command) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.request_id || '') || !body.payload || Array.isArray(body.payload) || typeof body.payload !== 'object') return reply(400, { error: 'Invalid command.' });
      const calendar = body.command === 'attendance.calendar';
      if (calendar && profile.data.role_code !== 'super_admin') return reply(403, { error: 'Only Admin can edit the attendance calendar.' });
      const result = await adminClient().rpc(calendar ? 'gym_attendance_calendar' : 'gym_command', { actor_auth_id: data.user.id, request_id: body.request_id, ...(!calendar ? { command: body.command } : {}), payload: body.payload });
      if (result.error) return reply(result.error.code === '42501' ? 403 : 409, { error: result.error.message.replaceAll('Super Admin', 'Admin') });
      return reply(200, { result: result.data });
    } catch { return reply(503, { error: 'Save could not be confirmed. Keep this form open and retry the same values; do not create another record.' }); }
  };
}

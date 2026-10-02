import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');

function loadLocalEnv() {
  let raw;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    throw new Error(`Missing ${envPath}. Create it from .env.local.example and set the service-role key.`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('replace-with-')) throw new Error(`Set ${name} in .env.local before running this script.`);
  return value;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(user => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function upsertAuthUser(admin, { email, password, displayName }) {
  const existing = await findUserByEmail(admin, email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { name: displayName },
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName },
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

async function upsertStaffProfile(admin, { userId, staffId, displayName }) {
  const byUser = await admin.from('app_staff').select('id,user_id,role_code,enabled,deleted_at').eq('user_id', userId).maybeSingle();
  if (byUser.error) throw byUser.error;

  if (byUser.data) {
    const { error } = await admin.from('app_staff').update({
      display_name: displayName,
      role_code: 'super_admin',
      enabled: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', byUser.data.id);
    if (error) throw error;
    return { id: byUser.data.id, action: 'updated-linked' };
  }

  if (staffId) {
    const byId = await admin.from('app_staff').select('id').eq('id', staffId).maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) {
      const { error } = await admin.from('app_staff').update({
        user_id: userId,
        display_name: displayName,
        role_code: 'super_admin',
        enabled: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', staffId);
      if (error) throw error;
      return { id: staffId, action: 'relinked-configured-profile' };
    }
  }

  const { data, error } = await admin.from('app_staff').insert({
    user_id: userId,
    display_name: displayName,
    role_code: 'super_admin',
    enabled: true,
  }).select('id').single();
  if (error) throw error;
  return { id: data.id, action: 'created' };
}

async function recordAudit(admin, { staff, userId, email }) {
  const { error } = await admin.from('audit_events').insert({
    actor_user_id: null,
    actor_name: 'Local bootstrap',
    entity_type: 'app_staff',
    entity_id: staff.id,
    action: 'staff.super_admin_bootstrapped',
    changes: { user_id: userId, email, role_code: 'super_admin', staff_action: staff.action },
    reason: 'Local development Super Admin bootstrap from .env.local',
  });
  if (error) throw error;
}

loadLocalEnv();

const supabaseUrl = requireEnv('SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const email = requireEnv('SUPER_ADMIN_EMAIL').toLowerCase();
const password = requireEnv('SUPER_ADMIN_PASSWORD');
const displayName = process.env.SUPER_ADMIN_DISPLAY_NAME?.trim() || 'Super Admin';
const staffId = process.env.SUPER_ADMIN_STAFF_ID?.trim();

if (password.length < 12 || password.length > 128) {
  throw new Error('SUPER_ADMIN_PASSWORD must be 12-128 characters for the owner account.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const { user, created } = await upsertAuthUser(admin, { email, password, displayName });
  const staff = await upsertStaffProfile(admin, { userId: user.id, staffId, displayName });
  await recordAudit(admin, { staff, userId: user.id, email });
  console.log(`Super Admin Auth ${created ? 'created' : 'updated'}: ${email}`);
  console.log(`Staff profile ${staff.action}: ${staff.id}`);
  console.log('Sign in through the app with the configured email and password.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

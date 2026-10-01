import { createEmptyData } from '../prototype/dataLifecycle.js';

export const COLUMNS = {
  member_categories: 'id,code,label,prefix,digits,enabled',
  packages: 'id,code,label,access_notes,allows_training,enabled',
  membership_plans: 'id,label,duration_months,enabled',
  discounts: 'id,label,percentage,enabled',
  members: 'id,member_code,full_name,category_id,contact_phone,student_id,date_of_birth,remark,archived_at,created_at,updated_at,record_origin',
  member_codes: 'code,member_id,category_id,retired_at',
  memberships: 'id,member_id,package_id,package_snapshot,plan_id,plan_snapshot,discount_id,discount_snapshot,member_code_snapshot,member_category_snapshot,start_date,duration_months,calculated_end_date,source_end_date,override_end_date,override_reason,voucher_reference,remark,voided_at,created_at,record_origin,transaction_kind',
  training_purchases: 'id,member_id,membership_id,service_type,sessions,duration_months,start_date,end_date,remark,voided_at,created_at,record_origin',
  attendance: 'id,member_id,membership_id,attendance_date,checked_in_at,time_source,record_origin,member_code_snapshot,member_category_snapshot,voided_at',
  audit_events: 'id,actor_user_id,actor_name,entity_type,entity_id,action,reason,occurred_at',
};

export async function readAll(client, table, columns, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select(columns)
      .order(table === 'member_codes' ? 'code' : 'id').range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`, { cause: error });
    if (!Array.isArray(data)) throw new Error(`Incomplete response for ${table}.`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export function normalizeSnapshot(tables) {
  const result = { ...createEmptyData(), ...tables };
  const aliases = new Map();
  for (const row of tables.member_codes || []) {
    if (row.retired_at) aliases.set(row.member_id, [...(aliases.get(row.member_id) || []), row.code]);
  }
  result.members = result.members.map(m => ({ ...m, previous_codes: aliases.get(m.id) || [] }));
  delete result.member_codes;
  return result;
}

export async function loadLiveData(client, expectedUserId) {
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!identity.user || (expectedUserId && identity.user.id !== expectedUserId)) throw new Error('Please sign in again.');
  const { data: staff, error } = await client.from('app_staff').select('id,user_id,display_name,role_code,enabled,deleted_at')
    .eq('user_id', identity.user.id).eq('enabled', true).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!staff) throw new Error('Your account does not have an enabled staff profile. Contact the Super Admin.');
  const pairs = await Promise.all(Object.entries(COLUMNS).map(async ([table, columns]) => [table, await readAll(client, table, columns)]));
  // Check the role again after loading so a revoked profile cannot publish an in-flight result.
  const check = await client.from('app_staff').select('id').eq('id', staff.id).eq('enabled', true).is('deleted_at', null).maybeSingle();
  if (check.error) throw check.error;
  if (!check.data) throw new Error('Staff access changed. Please sign in again.');
  return { staff, data: normalizeSnapshot({ ...Object.fromEntries(pairs), app_staff: [staff] }) };
}

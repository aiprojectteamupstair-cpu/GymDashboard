import { createDemoData } from './demoData.js';
import { addMonths, categoryLabel, currentMembership, localDate, validDate } from './domain.js';

export const STORAGE_KEY = 'community-fitness:prototype:v1';
export const TABLE_NAMES = ['member_categories', 'members', 'packages', 'payment_methods', 'memberships', 'attendance', 'app_staff', 'audit_events'];

function checkShape(data) {
  if (!data || !TABLE_NAMES.every(name => Array.isArray(data[name]))) throw new Error('Saved prototype data could not be read. Your data has not been replaced.');
  return data;
}

// Local prototype adapter. A future Supabase adapter can implement these operations.
// Local roles/audit records are demonstrations, not production authorization.
export function createPrototypeRepository(storage = window.localStorage, clock = () => new Date()) {
  let data;
  let initialError = '';
  try {
    const raw = storage.getItem(STORAGE_KEY);
    data = raw ? checkShape(JSON.parse(raw)) : createDemoData(localDate(clock()), clock());
  } catch (error) {
    data = Object.fromEntries(TABLE_NAMES.map(name => [name, []]));
    initialError = error.message || 'Unable to read prototype storage.';
  }
  function latest() {
    if (initialError) throw new Error(initialError);
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? checkShape(JSON.parse(raw)) : data;
  }
  function transaction(action, operation) {
    const next = structuredClone(latest());
    const now = clock().toISOString();
    const result = operation(next, now);
    if (!result.unchanged) next.audit_events.unshift({ id: crypto.randomUUID(), actor_user_id: 'demo-admin', entity_type: result.entity_type,
      entity_id: result.entity_id, action, changes: result.changes || {}, reason: result.reason || '', occurred_at: now });
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    data = next;
    return result;
  }
  return {
    getSnapshot: () => data,
    getError: () => initialError,
    reload() { data = latest(); return data; },
    reset() {
      const next = createDemoData(localDate(clock()), clock());
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      data = next; initialError = '';
      return data;
    },
    saveMember(input, id = null) {
      return transaction(id ? 'member.updated' : 'member.created', (next, now) => {
        const name = input.full_name?.trim();
        if (!name) throw new Error('Please enter a member name.');
        if (!next.member_categories.some(c => c.id === input.category_id)) throw new Error('Choose a member category.');
        if (input.date_of_birth && (!validDate(input.date_of_birth) || input.date_of_birth > localDate(now))) throw new Error('Date of birth must be a valid date in the past.');
        const existing = id ? next.members.find(m => m.id === id) : null;
        if (id && !existing) throw new Error('Member no longer exists. Please refresh.');
        const changes = { full_name: name, category_id: input.category_id, contact_phone: input.contact_phone?.trim() || '', date_of_birth: input.date_of_birth || '', student_id: input.student_id?.trim() || '', remark: input.remark?.trim() || '' };
        const number = Math.max(0, ...next.members.map(m => Number(m.member_code.replace(/^TCF-/, '')) || 0)) + 1;
        const member = { ...(existing || { id: crypto.randomUUID(), member_code: `TCF-${String(number).padStart(4, '0')}`, created_at: now, archived_at: null }), ...changes, updated_at: now };
        if (existing) next.members = next.members.map(m => m.id === id ? member : m);
        else next.members.unshift(member);
        return { entity_type: 'members', entity_id: member.id, member, changes: { before: existing || null, after: member } };
      });
    },
    archiveMember(id, archive = true) {
      return transaction(archive ? 'member.archived' : 'member.restored', (next, now) => {
        const member = next.members.find(m => m.id === id);
        if (!member) throw new Error('Member not found.');
        member.archived_at = archive ? now : null; member.updated_at = now;
        return { entity_type: 'members', entity_id: id, changes: { archived_at: member.archived_at } };
      });
    },
    addMembership(input) {
      return transaction('membership.created', (next, now) => {
        const member = next.members.find(m => m.id === input.member_id && !m.archived_at);
        const pack = next.packages.find(p => p.id === input.package_id && p.enabled);
        if (!member || !pack) throw new Error('Choose an available member and package.');
        if (!validDate(input.start_date)) throw new Error('Choose a valid start date.');
        const calculated = addMonths(input.start_date, pack.duration_months);
        const override = input.override_end_date || null;
        if (override && (!validDate(override) || override < input.start_date)) throw new Error('The end date must be on or after the start date.');
        if (!calculated && !override) throw new Error('This package has no confirmed duration. Enter an explicit end date.');
        if (override && !input.override_reason?.trim()) throw new Error('Please record a reason for the manual end date.');
        const payment = next.payment_methods.find(p => p.id === input.payment_method_id);
        if (input.payment_method_id && !payment) throw new Error('Choose a valid payment method.');
        const membership = { id: crypto.randomUUID(), member_id: member.id, package_id: pack.id, package_snapshot: { ...pack },
          member_category_snapshot: categoryLabel(next, member), start_date: input.start_date,
          calculated_end_date: calculated, override_end_date: override, override_reason: override ? input.override_reason.trim() : '',
          overridden_by: override ? 'demo-admin' : null, overridden_at: override ? now : null,
          payment_method_id: payment?.id || null, payment_method_label_snapshot: payment?.label || null,
          voucher_reference: input.voucher_reference?.trim() || '', remark: input.remark?.trim() || '',
          created_at: now, created_by: 'demo-admin', voided_at: null };
        next.memberships.unshift(membership);
        return { entity_type: 'memberships', entity_id: membership.id, membership, reason: membership.override_reason, changes: { after: membership } };
      });
    },
    checkIn(memberId, acknowledged = false) {
      return transaction('attendance.created', (next, now) => {
        const member = next.members.find(m => m.id === memberId && !m.archived_at);
        if (!member) throw new Error('Member is unavailable or archived.');
        const today = localDate(now);
        const existing = next.attendance.find(a => a.member_id === memberId && a.attendance_date === today && !a.voided_at);
        if (existing) return { unchanged: true, attendance: existing, duplicate: true };
        if (!acknowledged) throw new Error('Confirm the member before checking in.');
        const membership = currentMembership(next, memberId, today);
        const row = { id: crypto.randomUUID(), member_id: memberId, membership_id: membership?.id || null,
          attendance_date: today, checked_in_at: now, checked_in_by: 'demo-admin', member_category_snapshot: categoryLabel(next, member), voided_at: null };
        next.attendance.unshift(row);
        return { entity_type: 'attendance', entity_id: row.id, attendance: row, duplicate: false, changes: { after: row }, reason: 'Confirmed sample check-in; access policy is still under review.' };
      });
    },
  };
}

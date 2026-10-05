import { createEmptyData, retireLocalFixtures } from './dataLifecycle.js';
import { categoryLabel, currentMembership, localDate, validDate } from './domain.js';
import { CATEGORIES, nextMemberCode, upgradeData } from './catalogue.js';
import { appendMembership } from './membershipService.js';
import { applyAttendanceCalendar } from './attendanceCalendarService.js';

export const STORAGE_KEY = 'community-fitness:prototype:v1';
export const RELEASE_BACKUP_KEY = `${STORAGE_KEY}:before-real-members-v1`;
const ORIGINAL_TABLES = ['member_categories', 'members', 'packages', 'payment_methods', 'memberships', 'attendance', 'app_staff', 'audit_events'];
export const TABLE_NAMES = [...ORIGINAL_TABLES, 'membership_plans', 'discounts', 'training_purchases'];

function checkShape(data) {
  if (!data || !ORIGINAL_TABLES.every(name => Array.isArray(data[name]))) throw new Error('Saved data could not be read. Your data has not been replaced.');
  const upgraded = upgradeData(data);
  if (!TABLE_NAMES.every(name => Array.isArray(upgraded[name]))) throw new Error('Saved records are incomplete.');
  return upgraded;
}

// Local prototype adapter. A future Supabase adapter can implement these operations.
// Local roles/audit records are demonstrations, not production authorization.
export function createPrototypeRepository(storage = window.localStorage, clock = () => new Date(), getActor = () => ({ id:'demo-admin', display_name:'Admin', role:'admin' })) {
  let data;
  let initialError = '';
  function readSaved() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return data || createEmptyData();
    const saved = checkShape(JSON.parse(raw));
    const prepared = retireLocalFixtures(saved);
    if (prepared !== saved) {
      // Fail closed if a backup or replacement cannot be persisted.
      if (!storage.getItem(RELEASE_BACKUP_KEY)) storage.setItem(RELEASE_BACKUP_KEY, raw);
      if (!JSON.parse(raw).schema_version && !storage.getItem(`${STORAGE_KEY}:before-concept-v2`)) storage.setItem(`${STORAGE_KEY}:before-concept-v2`, raw);
      storage.setItem(STORAGE_KEY, JSON.stringify(prepared));
    }
    return prepared;
  }
  try {
    data = readSaved();
  } catch (error) {
    data = Object.fromEntries(TABLE_NAMES.map(name => [name, []]));
    initialError = error.message || 'Unable to read saved records.';
  }
  function latest() {
    if (initialError) throw new Error(initialError);
    return readSaved();
  }
  function transaction(action, operation) {
    const actor = getActor();
    if (!actor) throw new Error('Please sign in again to continue.');
    const next = structuredClone(latest());
    const now = clock().toISOString();
    const result = operation(next, now);
    if (!result.unchanged) next.audit_events.unshift({ id: crypto.randomUUID(), actor_user_id: actor.id, actor_name: actor.display_name, entity_type: result.entity_type,
      entity_id: result.entity_id, action, changes: result.changes || {}, reason: result.reason || '', occurred_at: now });
    const previous = storage.getItem(STORAGE_KEY);
    if (previous && !JSON.parse(previous).schema_version && !storage.getItem(`${STORAGE_KEY}:before-concept-v2`)) storage.setItem(`${STORAGE_KEY}:before-concept-v2`, previous);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    data = next;
    return result;
  }
  return {
    getSnapshot: () => data,
    getError: () => initialError,
    reload() { data = latest(); return data; },
    reset() {
      const next = createEmptyData();
      const previous = storage.getItem(STORAGE_KEY);
      if (previous && !storage.getItem(RELEASE_BACKUP_KEY)) storage.setItem(RELEASE_BACKUP_KEY, previous);
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      data = next; initialError = '';
      return data;
    },
    saveMember(input, id = null) {
      return transaction(id ? 'member.updated' : 'member.created', (next, now) => {
        const name = input.full_name?.trim();
        if (!name) throw new Error('Please enter a member name.');
        if (!CATEGORIES.some(c => c.id === input.category_id) && !(id && next.members.find(m => m.id === id)?.category_id === input.category_id)) throw new Error('Choose a member category.');
        if (input.date_of_birth && (!validDate(input.date_of_birth) || input.date_of_birth > localDate(now))) throw new Error('Date of birth must be a valid date in the past.');
        const existing = id ? next.members.find(m => m.id === id) : null;
        if (id && !existing) throw new Error('Member no longer exists. Please refresh.');
        const changes = { full_name: name, category_id: input.category_id, contact_phone: input.contact_phone?.trim() || '', date_of_birth: input.date_of_birth || '', student_id: input.student_id?.trim() || '', remark: input.remark?.trim() || '' };
        const changedCategory = existing && existing.category_id !== input.category_id;
        if (changedCategory && input.category_id === 'guest') throw new Error('An existing member cannot be changed back to a trial guest.');
        if (existing?.category_id === 'guest' && changedCategory && !input.membership) throw new Error('Choose a package and plan to convert this guest.');
        if (input.category_id === 'guest' && input.membership) throw new Error('Guests do not need a package or plan.');
        const code = !existing || changedCategory ? nextMemberCode(next, input.category_id) : existing.member_code;
        const member = { ...(existing || { id: crypto.randomUUID(), created_at: now, archived_at: null }), ...changes, member_code: code,
          previous_codes: changedCategory ? [...new Set([...(existing.previous_codes || []), existing.member_code])] : (existing?.previous_codes || []), updated_at: now };
        if (existing) next.members = next.members.map(m => m.id === id ? member : m);
        else next.members.unshift(member);
        const subscription = input.membership ? appendMembership(next, { ...input.membership, member_id: member.id }, now, getActor().id) : null;
        return { entity_type: 'members', entity_id: member.id, member, changes: { before: existing || null, after: member, subscription } };
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
        const result = appendMembership(next, input, now, getActor().id);
        return { entity_type: 'memberships', entity_id: result.membership.id, ...result,
          reason: result.membership.override_reason, changes: { after: result.membership, training: result.trainingPurchase } };
      });
    },
    saveCatalogue(kind, input, id = null) {
      if (!['packages', 'discounts'].includes(kind)) throw new Error('Unknown catalogue.');
      if (id && getActor()?.role !== 'super_admin') throw new Error('Only Admin can edit saved catalogue details.');
      return transaction(`${kind}.${id ? 'updated' : 'created'}`, (next, now) => {
        const existing = id ? next[kind].find(row => row.id === id) : null;
        if (id && !existing) throw new Error('Record no longer exists.');
        if (existing?.legacy) throw new Error('Historical catalogue definitions are preserved.');
        if (existing && input.expected_updated_at !== existing.updated_at) throw new Error('This record changed. Close and reopen it before editing.');
        const label = input.label?.trim();
        if (!label) throw new Error('Enter a name.');
        if (next[kind].some(row => row.id !== id && row.label.toLowerCase() === label.toLowerCase())) throw new Error('This name already exists.');
        const percentage = Number(input.percentage);
        if (kind === 'discounts' && (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)) throw new Error('Discount must be greater than 0 and at most 100%.');
        const row = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), label, enabled: Boolean(input.enabled),
          ...(kind === 'packages' ? { access_notes: input.access_notes?.trim() || '', allows_training: Boolean(input.allows_training) } : { percentage }),
          created_at: existing?.created_at || now, updated_at: now };
        if (existing) next[kind] = next[kind].map(item => item.id === id ? row : item);
        else next[kind].push(row);
        return { entity_type: kind, entity_id: row.id, row, changes: { before:existing, after: row } };
      });
    },
    setCatalogueStatus(kind, id, enabled) {
      if (!['packages', 'discounts'].includes(kind)) throw new Error('Unknown catalogue.');
      return transaction(`${kind}.status_changed`, (next, now) => {
        const row = next[kind].find(item => item.id === id);
        if (!row) throw new Error('Record no longer exists.');
        if (row.legacy && enabled) throw new Error('Historical package definitions remain inactive.');
        const before = row.enabled;
        row.enabled = Boolean(enabled); row.updated_at = now;
        return { entity_type: kind, entity_id: id, row, changes: { before, enabled: row.enabled } };
      });
    },
    editAttendanceCalendar(input) {
      return transaction('attendance.calendar', (next, now) => applyAttendanceCalendar(next, input, getActor(), now));
    },
    updateAttendanceTime(id, input) {
      return transaction('attendance.time_corrected', (next, now) => {
        const row = next.attendance.find(a => a.id === id && !a.voided_at);
        if (!row) throw new Error('Attendance record no longer exists.');
        if (row.checked_in_at !== input.expected_checked_in_at) throw new Error('This record changed. Close and reopen it before editing.');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) throw new Error('Enter a valid check-in time.');
        const reason = input.reason?.trim();
        if (!reason) throw new Error('Explain why this time needs correcting.');
        const corrected = new Date(row.attendance_date + 'T' + input.time + ':00+06:30').toISOString();
        if (corrected > now) throw new Error('Check-in time cannot be in the future.');
        const before = row.checked_in_at;
        if (before === corrected) return { unchanged:true, attendance:row };
        row.original_checked_in_at ||= before;
        row.checked_in_at = corrected;
        row.updated_at = now;
        return { entity_type:'attendance', entity_id:id, attendance:row, reason,
          changes:{ before:{checked_in_at:before}, after:{checked_in_at:corrected}, attendance_date:row.attendance_date } };
      });
    },
    checkIn(memberId, acknowledged = false, manualTime = '') {
      return transaction('attendance.created', (next, now) => {
        const member = next.members.find(m => m.id === memberId && !m.archived_at);
        if (!member) throw new Error('Member is unavailable or archived.');
        const today = localDate(now);
        if (member.category_id === 'guest' && next.attendance.some(a => a.member_id === memberId && !a.voided_at && a.attendance_date !== today)) throw new Error('This guest has used their one-day trial. Convert them to a member to continue.');
        const existing = next.attendance.find(a => a.member_id === memberId && a.attendance_date === today && !a.voided_at);
        if (existing) return { unchanged: true, attendance: existing, duplicate: true };
        if (!acknowledged) throw new Error('Confirm the member before checking in.');
        let checkTime = now;
        if (manualTime) {
          if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(manualTime)) throw new Error('Enter a valid check-in time.');
          checkTime = new Date(today + 'T' + manualTime + ':00+06:30').toISOString();
          if (checkTime > now) throw new Error('Check-in time cannot be in the future.');
        }
        const membership = currentMembership(next, memberId, today);
        const row = { id: crypto.randomUUID(), member_id: memberId, membership_id: membership?.id || null,
          attendance_date: today, checked_in_at: checkTime, recorded_at: now, time_source: manualTime ? 'manual' : 'current', checked_in_by: getActor().id, member_category_snapshot: categoryLabel(next, member), member_code_snapshot: member.member_code, voided_at: null };
        next.attendance.unshift(row);
        return { entity_type: 'attendance', entity_id: row.id, attendance: row, duplicate: false, changes: { after: row }, reason: 'Member identity confirmed.' };
      });
    },
  };
}

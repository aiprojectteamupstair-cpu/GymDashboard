import { CATEGORIES, PACKAGES, PLANS, DISCOUNTS } from './catalogue.js';

export const DATA_RELEASE = 'real-members-2026-09';

// The browser remains local-only. Real member data belongs in Supabase, not a seed bundle.
export function createEmptyData() {
  return {
    schema_version: 2, data_release: DATA_RELEASE,
    member_categories: structuredClone(CATEGORIES), packages: structuredClone(PACKAGES),
    membership_plans: structuredClone(PLANS), discounts: structuredClone(DISCOUNTS),
    members: [], memberships: [], training_purchases: [], attendance: [],
    payment_methods: [], app_staff: [], audit_events: [],
  };
}

// A one-time migration; the repository must back up the original storage before saving it.
// Only known fixture person IDs are removed. User-created people and their history survive.
export function retireLocalFixtures(source) {
  if (source.data_release === DATA_RELEASE) return source;
  const data = structuredClone(source);
  const fixtureIds = new Set(Array.from({ length: 16 }, (_, i) => `demo-member-${i + 1}`));
  const removedIds = new Set(data.members.filter(m => fixtureIds.has(m.id)).map(m => m.id));
  data.members = data.members.filter(m => !fixtureIds.has(m.id));
  for (const table of ['memberships', 'training_purchases', 'attendance']) {
    for (const row of data[table]) if (fixtureIds.has(row.member_id)) removedIds.add(row.id);
    data[table] = data[table].filter(row => !fixtureIds.has(row.member_id));
  }
  data.audit_events = data.audit_events.filter(row => !removedIds.has(row.entity_id));
  data.app_staff = data.app_staff.filter(row => row.user_id !== 'demo-admin');

  // Catalogue removal never destroys a surviving person's historical definition.
  for (const row of data.memberships) {
    const pack = data.packages.find(p => p.id === row.package_id);
    if (pack && !row.package_snapshot) row.package_snapshot = structuredClone(pack);
  }
  data.packages = PACKAGES.map(pack => {
    const saved = data.packages.find(p => p.id === pack.id);
    return { ...structuredClone(pack), ...saved, label: pack.label, legacy: false };
  });
  data.member_categories = data.member_categories.map(c => c.id === 'guest' ? { ...c, digits: 3 } : c);

  const ownership = new Map();
  for (const member of data.members) {
    for (const code of [member.member_code, ...(member.previous_codes || [])]) {
      if (!code) continue;
      if (ownership.has(code) && ownership.get(code) !== member.id) throw new Error('Conflicting member IDs. Saved records have not been replaced.');
      ownership.set(code, member.id);
    }
  }
  for (const member of data.members) {
    const match = /^G(\d+)$/.exec(member.member_code);
    if (!match) continue;
    const code = `G${String(Number(match[1])).padStart(3, '0')}`;
    if (ownership.has(code) && ownership.get(code) !== member.id) throw new Error('Conflicting Guest IDs. Saved records have not been replaced.');
    ownership.set(code, member.id);
    if (code !== member.member_code) {
      member.previous_codes = [...new Set([...(member.previous_codes || []), member.member_code])];
      member.member_code = code;
    }
  }
  data.data_release = DATA_RELEASE;
  return data;
}

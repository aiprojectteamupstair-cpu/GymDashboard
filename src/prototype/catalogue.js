export const CATEGORIES = [
  { id: 'vip', code: 'vip', label: 'VIP Customer', prefix: 'VC', digits: 2, enabled: true },
  { id: 'customer', code: 'customer', label: 'Customer', prefix: 'C', digits: 3, enabled: true },
  { id: 'student', code: 'student', label: 'Student', prefix: 'S', digits: 3, enabled: true },
  { id: 'staff', code: 'staff', label: 'Staff/Employee', prefix: 'E', digits: 3, enabled: true },
  { id: 'guest', code: 'guest', label: 'Guest', prefix: 'G', digits: 3, enabled: true },
];
export const PACKAGES = [
  { id: 'gym', code: 'gym', label: 'Gym', access_notes: 'All Classes, Swimming Pool, Sauna', allows_training: true, enabled: true },
  { id: 'pool', code: 'pool', label: 'Swimming Pool Only', access_notes: 'Swimming Pool', allows_training: false, enabled: true },
];
export const PLANS = [1, 3, 6, 12].map(months => ({ id: `plan-${months}`, label: months === 12 ? '1 Year' : `${months} month${months > 1 ? 's' : ''}`, duration_months: months, enabled: true }));
export const DISCOUNTS = [
  { id: 'condo-50', label: 'Condo 50%', percentage: 50, enabled: true },
  { id: 'student-20', label: 'Student 20%', percentage: 20, enabled: true },
  { id: 'student-50', label: 'Student 50%', percentage: 50, enabled: true },
];
export const TRAINING_MONTHS = { 5: 1, 10: 1, 20: 2, 50: 5 };

export function nextMemberCode(data, categoryId) {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return null;
  const pattern = new RegExp(`^${category.prefix}(\\d+)$`);
  const codes = data.members.flatMap(m => [m.member_code, ...(m.previous_codes || [])]);
  const maximum = codes.reduce((max, code) => Math.max(max, Number(pattern.exec(code)?.[1]) || 0), 0);
  return `${category.prefix}${String(maximum + 1).padStart(category.digits, '0')}`;
}

// Upgrade the local shape without rewriting historical package/date snapshots.
export function upgradeData(source) {
  if (source.schema_version >= 2) return source;
  const data = structuredClone(source);
  data.member_categories = [...structuredClone(CATEGORIES), ...data.member_categories.filter(c => !CATEGORIES.some(n => n.id === c.id)).map(c => ({ ...c, enabled: false }))];
  data.packages = [...structuredClone(PACKAGES), ...data.packages.filter(p => !PACKAGES.some(n => n.id === p.id)).map(p => ({ ...p, enabled: false, legacy: true }))];
  data.membership_plans = structuredClone(PLANS);
  data.discounts = structuredClone(DISCOUNTS);
  data.training_purchases = [];
  for (const row of [...data.memberships, ...data.attendance]) {
    row.member_code_snapshot ||= data.members.find(m => m.id === row.member_id)?.member_code || '';
  }
  for (const member of data.members) {
    const category = CATEGORIES.find(c => c.id === member.category_id);
    if (category && !new RegExp(`^${category.prefix}\\d+$`).test(member.member_code)) {
      const next = nextMemberCode(data, category.id);
      member.previous_codes = [...new Set([...(member.previous_codes || []), member.member_code])];
      member.member_code = next;
    }
  }
  data.schema_version = 2;
  return data;
}

import { addMonths, localDate, shiftDays } from './domain.js';
import { CATEGORIES, PACKAGES, PLANS, DISCOUNTS, nextMemberCode } from './catalogue.js';

// Fictional development fixtures; never sourced from member workbooks.
export function createDemoData(today = localDate(), now = new Date()) {
  const data = {
    schema_version: 2, member_categories: structuredClone(CATEGORIES), packages: structuredClone(PACKAGES),
    membership_plans: structuredClone(PLANS), discounts: structuredClone(DISCOUNTS), training_purchases: [],
    members: [], memberships: [], attendance: [], audit_events: [],
    payment_methods: [{ id: 'cash', label: 'Cash', enabled: true }, { id: 'kpay', label: 'KBZPay', enabled: true }, { id: 'bank', label: 'Bank transfer', enabled: true }],
    app_staff: [{ user_id: 'demo-admin', display_name: 'Admin', role_code: 'admin', enabled: true }],
  };
  const names = ['Alex Morgan', 'Jamie Chen', 'Sam Rivera', 'Taylor Brooks', 'Jordan Lee', 'Riley Park', 'Casey Wilson', 'Avery Kim', 'Robin Ellis', 'Drew Harper', 'Cameron Reed', 'Charlie Lane', 'Skyler Quinn', 'Morgan Vale', 'Frankie Bell', 'Emery Stone'];
  const categories = ['vip', 'student', 'customer', 'staff', 'student', 'customer', 'staff', 'student', 'vip', 'customer', 'student', 'staff', 'customer', 'student', 'guest', 'guest'];
  names.forEach((name, i) => {
    const member = { id: `demo-member-${i + 1}`, member_code: nextMemberCode(data, categories[i]), previous_codes: [], full_name: name,
      category_id: categories[i], contact_phone: '', date_of_birth: i % 3 === 0 ? `${1994 + i}-04-12` : '',
      student_id: categories[i] === 'student' ? `SCHOOL-${100 + i}` : '', remark: '',
      archived_at: null, created_at: `${shiftDays(today, -90)}T03:00:00Z`, updated_at: now.toISOString() };
    data.members.push(member);
    if (member.category_id === 'guest') return;
    const pack = data.packages[i % 4 === 0 ? 1 : 0];
    const plan = data.membership_plans[i % 3 === 0 ? 0 : 1];
    const start = shiftDays(today, i === 13 ? 5 : -15 - i);
    const override = i === 10 ? shiftDays(today, -8) : i === 12 ? today : [4, 11].includes(i) ? shiftDays(today, 5) : null;
    const discount = member.category_id === 'student' ? data.discounts[1] : i === 8 ? data.discounts[0] : null;
    data.memberships.push({ id: `demo-membership-${i + 1}`, member_id: member.id, member_code_snapshot: member.member_code,
      package_id: pack.id, package_snapshot: { ...pack }, plan_id: plan.id, plan_snapshot: { ...plan },
      discount_id: discount?.id || null, discount_snapshot: discount ? { ...discount } : null,
      member_category_snapshot: data.member_categories.find(c => c.id === member.category_id).label,
      start_date: start, calculated_end_date: addMonths(start, plan.duration_months), override_end_date: override,
      override_reason: override ? 'Reviewed end date' : '', overridden_by: override ? 'demo-admin' : null, overridden_at: override ? now.toISOString() : null,
      payment_method_id: i % 4 === 0 ? null : data.payment_methods[i % 3].id, payment_method_label_snapshot: i % 4 === 0 ? null : data.payment_methods[i % 3].label,
      voucher_reference: '', remark: '', voided_at: null, created_at: `${start}T03:00:00Z`, created_by: 'demo-admin' });
  });
  for (let day = -40; day <= 0; day++) {
    const date = shiftDays(today, day);
    data.members.forEach((member, i) => {
      if (member.category_id === 'guest') return;
      if (day === 0 ? ![0, 1, 3, 5, 7].includes(i) : (i * 3 + Math.abs(day) * 7) % 11 > 4) return;
      const stamp = day === 0 ? new Date(now.getTime() - (i + 1) * 45000).toISOString() : `${date}T${String(1 + i % 11).padStart(2, '0')}:15:00.000Z`;
      if (localDate(stamp) !== date) return;
      data.attendance.push({ id: `demo-attendance-${day}-${i}`, member_id: member.id, membership_id: data.memberships.find(m => m.member_id === member.id)?.id || null,
        attendance_date: date, checked_in_at: stamp, checked_in_by: 'demo-admin', member_code_snapshot: member.member_code,
        member_category_snapshot: data.member_categories.find(c => c.id === member.category_id).label, voided_at: null });
    });
  }
  return data;
}

import { addMonths, localDate, shiftDays } from './domain.js';

// Entirely fictional fixtures. No source-workbook personal information is used.
export function createDemoData(today = localDate(), now = new Date()) {
  const member_categories = [
    { id: 'customer', code: 'customer', label: 'Customer', enabled: true },
    { id: 'student', code: 'student', label: 'Student', enabled: true },
    { id: 'staff', code: 'staff', label: 'Staff', enabled: true },
    { id: 'unknown', code: 'unknown', label: 'Unknown', enabled: true },
  ];
  const packages = [
    { id: 'september', code: 'sept', label: 'Sept Package', duration_months: 3, access_notes: 'Three calendar months', enabled: true },
    { id: 'august', code: 'aug', label: 'Aug Package', duration_months: 3, access_notes: 'Three calendar months', enabled: true },
    { id: 'july', code: 'jul', label: 'Jul Package', duration_months: 3, access_notes: 'Three calendar months', enabled: true },
    { id: 'student-day', code: 'student-day', label: 'Student (6–4)', duration_months: null, access_start: '06:00', access_end: '16:00', access_notes: 'Student access · 06:00–16:00', enabled: true },
    { id: 'student-full', code: 'student-full', label: 'Student (6–9)', duration_months: null, access_start: '06:00', access_end: '21:00', access_notes: 'Student access · 06:00–21:00', enabled: true },
    { id: 'off-peak', code: 'off-peak', label: 'Staff Off-peak', duration_months: null, access_notes: 'Staff access hours to be confirmed', enabled: true },
    { id: 'condo', code: 'condo', label: 'Condo Package 50%', duration_months: null, access_notes: 'Condominium resident benefit', enabled: true },
  ];
  const payment_methods = [
    { id: 'cash', code: 'cash', label: 'Cash', enabled: true },
    { id: 'kpay', code: 'kpay', label: 'KBZPay', enabled: true },
    { id: 'bank', code: 'bank', label: 'Bank transfer', enabled: true },
  ];
  const names = ['Alex Morgan', 'Jamie Chen', 'Sam Rivera', 'Taylor Brooks', 'Jordan Lee', 'Riley Park', 'Casey Wilson', 'Avery Kim', 'Robin Ellis', 'Drew Harper', 'Cameron Reed', 'Charlie Lane', 'Skyler Quinn', 'Morgan Vale', 'Frankie Bell', 'Emery Stone'];
  const categories = ['customer', 'student', 'customer', 'staff', 'student', 'customer', 'staff', 'student', 'customer', 'customer', 'student', 'staff', 'customer', 'student', 'customer', 'unknown'];
  const members = names.map((name, i) => ({
    id: `demo-member-${i + 1}`, member_code: `TCF-${String(i + 1).padStart(4, '0')}`, full_name: name,
    category_id: categories[i], contact_phone: '', date_of_birth: i % 3 === 0 ? `${1994 + i}-04-12` : '',
    student_id: categories[i] === 'student' ? `DEMO-S${100 + i}` : '', remark: 'Fictional member for UI review.',
    archived_at: null, created_at: `${shiftDays(today, -90)}T03:00:00Z`, updated_at: now.toISOString(),
  }));
  const memberships = members.slice(0, 15).map((member, i) => {
    const packageId = member.category_id === 'student' ? (i % 2 ? 'student-day' : 'student-full') : member.category_id === 'staff' ? 'off-peak' : i === 8 ? 'condo' : 'september';
    const pack = packages.find(p => p.id === packageId);
    const start = shiftDays(today, i === 13 ? 5 : -35 - i);
    const manualEnd = shiftDays(today, i === 10 ? -8 : i === 12 ? 0 : [4, 11].includes(i) ? 5 : 20 + i);
    const calculated = pack.duration_months ? addMonths(start, pack.duration_months) : null;
    const override = !calculated || [10, 12].includes(i) ? manualEnd : null;
    return {
      id: `demo-membership-${i + 1}`, member_id: member.id, package_id: pack.id, package_snapshot: { ...pack },
      member_category_snapshot: member_categories.find(c => c.id === member.category_id).label,
      start_date: start, calculated_end_date: calculated, override_end_date: override,
      override_reason: override ? 'Explicit example expiry for this fictional membership.' : '',
      overridden_by: override ? 'demo-admin' : null, overridden_at: override ? now.toISOString() : null,
      payment_method_id: i % 4 === 0 ? null : payment_methods[i % 3].id,
      payment_method_label_snapshot: i % 4 === 0 ? null : payment_methods[i % 3].label,
      voucher_reference: `DEMO-V${String(100 + i)}`, remark: 'Sample membership', voided_at: null,
      created_at: `${start}T03:00:00Z`, created_by: 'demo-admin',
    };
  });
  const attendance = [];
  for (let day = -40; day <= 0; day++) {
    const date = shiftDays(today, day);
    for (let i = 0; i < members.length; i++) {
      if (day === 0 ? ![0, 1, 3, 5, 7].includes(i) : (i * 3 + Math.abs(day) * 7) % 11 > 4) continue;
      const stamp = day === 0 ? new Date(now.getTime() - (i + 1) * 45000).toISOString() : `${date}T${String(1 + i % 11).padStart(2, '0')}:15:00.000Z`;
      if (localDate(stamp) !== date) continue;
      const membership = memberships.find(m => m.member_id === members[i].id);
      attendance.push({ id: `demo-attendance-${day}-${i}`, member_id: members[i].id, membership_id: membership?.id || null,
        attendance_date: date, checked_in_at: stamp, checked_in_by: 'demo-admin',
        member_category_snapshot: member_categories.find(c => c.id === members[i].category_id).label, voided_at: null });
    }
  }
  return {
    member_categories, members, packages, payment_methods, memberships, attendance,
    app_staff: [{ user_id: 'demo-admin', display_name: 'Demo Admin', role_code: 'admin', enabled: true }],
    audit_events: [],
  };
}

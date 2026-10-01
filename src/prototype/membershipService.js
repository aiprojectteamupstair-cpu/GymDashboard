import { addMonths, categoryLabel, validDate } from './domain.js';
import { TRAINING_MONTHS } from './catalogue.js';

export function appendMembership(data, input, now, actorId = 'demo-admin') {
  const member = data.members.find(m => m.id === input.member_id && !m.archived_at);
  const pack = data.packages.find(p => p.id === input.package_id && p.enabled);
  const plan = data.membership_plans.find(p => p.id === input.plan_id && p.enabled);
  const discount = input.discount_id ? data.discounts.find(d => d.id === input.discount_id && d.enabled) : null;
  if (!member || member.category_id === 'guest') throw new Error('Convert the guest to a member before adding a package.');
  if (!pack) throw new Error('Choose an active package.');
  if (!plan) throw new Error('Choose an active membership plan.');
  if (input.discount_id && !discount) throw new Error('Choose an active discount.');
  if (!validDate(input.start_date)) throw new Error('Choose a valid start date.');
  const calculated = addMonths(input.start_date, plan.duration_months);
  const override = input.override_end_date || null;
  if (override && (!validDate(override) || override < input.start_date)) throw new Error('The end date must be on or after the start date.');
  if (override && !input.override_reason?.trim()) throw new Error('Please record a reason for the manual end date.');
  const training = input.training_type && input.training_type !== 'none';
  const sessions = Number(input.training_sessions);
  if (training && (!pack.allows_training || !['pt', 'rehab'].includes(input.training_type) || !TRAINING_MONTHS[sessions])) throw new Error('Choose PT and 5, 10, 20 or 50 sessions for an eligible Gym package.');
  const membership = {
    id: crypto.randomUUID(), transaction_kind: data.memberships.some(m => m.member_id === member.id && !m.voided_at) ? 'Renew' : 'New', member_id: member.id, member_code_snapshot: member.member_code,
    package_id: pack.id, package_snapshot: { ...pack }, plan_id: plan.id, plan_snapshot: { ...plan },
    discount_id: discount?.id || null, discount_snapshot: discount ? { ...discount } : null,
    member_category_snapshot: categoryLabel(data, member), start_date: input.start_date,
    calculated_end_date: calculated, override_end_date: override,
    override_reason: override ? input.override_reason.trim() : '', overridden_by: override ? actorId : null,
    overridden_at: override ? now : null, voucher_reference: input.voucher_reference?.trim() || '',
    remark: input.remark?.trim() || '', created_at: now, created_by: actorId, voided_at: null,
  };
  data.memberships.unshift(membership);
  let trainingPurchase = null;
  if (training) {
    trainingPurchase = { id: crypto.randomUUID(), member_id: member.id, membership_id: membership.id,
      service_type: 'pt', sessions, duration_months: TRAINING_MONTHS[sessions],
      start_date: input.start_date, end_date: addMonths(input.start_date, TRAINING_MONTHS[sessions]),
      created_at: now, created_by: actorId, voided_at: null };
    data.training_purchases.unshift(trainingPurchase);
  }
  return { membership, trainingPurchase };
}

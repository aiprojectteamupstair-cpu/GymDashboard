import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceInsights } from '../src/prototype/insights.js';
import { formatAttendanceTime } from '../src/prototype/domain.js';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';

test('imported assumed and unknown times count as visits but never as arrival-hour evidence', () => {
  const data = createEmptyData();
  data.attendance = [
    { id: 'a', member_id: 'a', attendance_date: '2026-07-01', checked_in_at: '2026-07-01T18:00:00+06:30', time_source: 'import_assumed' },
    { id: 'b', member_id: 'b', attendance_date: '2026-07-01', checked_in_at: null, time_source: 'import_date_only' },
    { id: 'c', member_id: 'c', attendance_date: '2026-07-01', checked_in_at: '2026-07-01T09:00:00+06:30', time_source: 'manual' },
  ];
  const summary = attendanceInsights(data, '2026-07-01', '2026-07-01');
  assert.equal(summary.visits, 3); assert.equal(summary.unknownTimeVisits, 2);
  assert.equal(summary.hours.reduce((sum, h) => sum + h.visits, 0), 1);
  assert.match(formatAttendanceTime(data.attendance[0]), /assumed/);
  assert.equal(formatAttendanceTime(data.attendance[1]), 'Time not recorded');
});

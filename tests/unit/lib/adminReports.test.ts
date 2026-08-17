// Reports' three charts and its utilization list (src/lib/adminReports.ts),
// pure over a date-bounded array of visits — see adminDashboard.test.ts for
// the fixture-builder pattern this file reuses.
import { describe, it, expect } from 'vitest';
import {
  dateKeysInRange, axisLabelFor, visitorsByDay, checkinTimeTrend,
  formatSeconds, defaultReportRange,
} from '../../../src/lib/adminReports';
import type { Visit } from '../../../src/types/index';

function v(over: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'VIS-1',
    visitor_id: 'visitor-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'checked_in',
    checked_in_at: '2026-08-14T09:00:00Z',
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    qr_token: 'tok',
    qr_expires_at: null,
    created_at: '2026-08-14T02:00:00Z',
    ...over,
  } as unknown as Visit;
}

describe('dateKeysInRange', () => {
  it('is inclusive of both ends', () => {
    expect(dateKeysInRange('2026-08-01', '2026-08-03')).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('produces one key for a single-day range', () => {
    expect(dateKeysInRange('2026-08-14', '2026-08-14')).toEqual(['2026-08-14']);
  });
});

describe('axisLabelFor', () => {
  it('reads a weekday name for a range of a week or less', () => {
    // 2026-08-14 is a Thursday.
    expect(axisLabelFor('2026-08-14', 7)).toBe('Thu');
  });

  it('reads MM-DD once the range is longer than a week, since weekdays repeat', () => {
    expect(axisLabelFor('2026-08-14', 30)).toBe('08-14');
  });
});

describe('visitorsByDay', () => {
  it('carries a day with no arrivals at value 0 rather than omitting it', () => {
    const rows = visitorsByDay([], '2026-08-13', '2026-08-15');
    expect(rows.map((r) => r.value)).toEqual([0, 0, 0]);
  });

  it('counts an arrival on its IST day, not its UTC one', () => {
    // 2026-08-13T20:00:00Z is 01:30 IST on the 14th.
    const rows = visitorsByDay([v({ checked_in_at: '2026-08-13T20:00:00Z' })], '2026-08-13', '2026-08-15');
    const byKey = new Map(rows.map((r) => [r.dateKey, r.value]));
    expect(byKey.get('2026-08-14')).toBe(1);
    expect(byKey.get('2026-08-13')).toBe(0);
  });

  it('ignores a visit outside the requested range', () => {
    const rows = visitorsByDay([v({ checked_in_at: '2026-09-01T09:00:00Z' })], '2026-08-13', '2026-08-15');
    expect(rows.every((r) => r.value === 0)).toBe(true);
  });
});

describe('checkinTimeTrend', () => {
  it('DROPS a day with no measured check-in — never plots it as zero', () => {
    const visits = [
      v({ checked_in_at: '2026-08-13T09:00:00Z', checkin_duration_seconds: 30 }),
      v({ checked_in_at: '2026-08-14T09:00:00Z', checkin_duration_seconds: null }),
    ];
    const rows = checkinTimeTrend(visits, '2026-08-13', '2026-08-15');
    // Only the 13th had a measured sample; the 14th (measured but null) and the
    // 15th (no visits at all) are both absent, not present at 0.
    expect(rows.map((r) => r.dateKey)).toEqual(['2026-08-13']);
  });

  it('averages only the measured samples for that day', () => {
    const visits = [
      v({ id: 'a', checked_in_at: '2026-08-13T09:00:00Z', checkin_duration_seconds: 20 }),
      v({ id: 'b', checked_in_at: '2026-08-13T10:00:00Z', checkin_duration_seconds: 40 }),
    ];
    const rows = checkinTimeTrend(visits, '2026-08-13', '2026-08-13');
    // 2026-08-13 is a Wednesday (the 14th, checked above, is Thursday).
    expect(rows).toEqual([{ dateKey: '2026-08-13', label: 'Wed', value: 30 }]);
  });
});

// THERE IS NO `entryPointUsage` TEST because there is no `entryPointUsage`
// (removed 2026-08-17, client instruction, with the Entry Point Utilization
// panel it fed). Nothing writes `visits.entry_point_id`, so the function could
// only ever report every arrival as unrecorded. Migration 084's table stays —
// do not re-derive a chart from it until a check-in path records a door.

describe('formatSeconds', () => {
  it('reads sub-minute durations in seconds', () => {
    expect(formatSeconds(38)).toBe('38s');
  });

  it('reads minute-plus durations as m + zero-padded s', () => {
    expect(formatSeconds(125)).toBe('2m 05s');
  });
});

describe('defaultReportRange', () => {
  it('spans the IST week ending today, inclusive', () => {
    const range = defaultReportRange(new Date('2026-08-14T12:00:00Z'));
    expect(range).toEqual({ from: '2026-08-08', to: '2026-08-14' });
    expect(dateKeysInRange(range.from, range.to)).toHaveLength(7);
  });
});

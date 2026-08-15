// The Pre-Registered board holds EVERY visitor ever pre-registered, so the
// chips have to say "today" out loud rather than inherit it from the fetch,
// and a pill has to be read off the STATUS before the clock.
import { describe, it, expect } from 'vitest';
import { chipCounts, chipVisits, preRegisteredPill } from '../../../src/lib/preRegisteredBoard';
import type { ReportVisit } from '../../../src/lib/reportRow';

// 2026-08-14 09:30 IST = 04:00Z.
const NOW = new Date('2026-08-14T04:00:00Z');

const v = (over: Partial<ReportVisit>): ReportVisit =>
  ({
    id: Math.random().toString(36),
    status: 'approved',
    checked_in_at: null,
    created_at: '2026-08-14T02:00:00Z',
    scheduled_for: '2026-08-14T05:00:00Z', // 10:30 IST — still ahead
    purpose: 'meeting',
    ...over,
  }) as unknown as ReportVisit;

describe('preRegisteredPill', () => {
  it('reads a closed status before it reads the clock', () => {
    // A no-show swept last month has a slot far in the past. A clock-first rule
    // called it LATE, which claims the visitor is still expected.
    const old = v({ status: 'no_show', scheduled_for: '2026-07-01T05:00:00Z' });
    expect(preRegisteredPill(old, NOW).label).toBe('NO-SHOW');
  });

  it('labels an HOD rejection DECLINED, never denied entry', () => {
    expect(preRegisteredPill(v({ status: 'rejected' }), NOW).label).toBe('DECLINED');
  });

  it.each([
    ['checked_in', 'ARRIVED'],
    ['checked_out', 'DEPARTED'],
    ['expired', 'EXPIRED'],
    ['cancelled', 'CANCELLED'],
  ])('labels %s as %s', (status, label) => {
    expect(preRegisteredPill(v({ status: status as never }), NOW).label).toBe(label);
  });

  it('is EXPECTED while the slot is still ahead', () => {
    expect(preRegisteredPill(v({}), NOW).label).toBe('EXPECTED');
  });

  it('is MISSED just past the slot and LATE beyond 30 minutes', () => {
    expect(preRegisteredPill(v({ scheduled_for: '2026-08-14T03:50:00Z' }), NOW).label).toBe('MISSED');
    expect(preRegisteredPill(v({ scheduled_for: '2026-08-14T03:00:00Z' }), NOW).label).toBe('LATE');
  });
});

describe('chip filters', () => {
  const todayAhead = v({ id: 'a' } as never);
  const todayMissed = v({ id: 'b', scheduled_for: '2026-08-14T03:50:00Z' } as never);
  const todayLate = v({ id: 'c', scheduled_for: '2026-08-14T03:00:00Z' } as never);
  const todayArrived = v({ id: 'd', status: 'checked_in', checked_in_at: '2026-08-14T03:30:00Z' } as never);
  const lastWeek = v({ id: 'e', status: 'checked_out', scheduled_for: '2026-08-07T05:00:00Z', checked_in_at: '2026-08-07T05:10:00Z' } as never);
  const all = [todayAhead, todayMissed, todayLate, todayArrived, lastWeek];

  it('All is the whole record, history included', () => {
    expect(chipVisits('all', all, NOW)).toHaveLength(5);
  });

  it('the four dated chips are today only', () => {
    const counts = chipCounts(all, NOW);
    expect(counts).toEqual({ all: 5, arriving: 1, arrived: 1, missed: 1, late: 1 });
  });

  it('never counts last week in Arrived, however it ended', () => {
    expect(chipVisits('arrived', all, NOW).map((x) => x.id)).toEqual(['d']);
  });

  it('a chip count is the length of the list it opens', () => {
    const counts = chipCounts(all, NOW);
    for (const chip of ['all', 'arriving', 'arrived', 'missed', 'late'] as const) {
      expect(chipVisits(chip, all, NOW)).toHaveLength(counts[chip]);
    }
  });
});

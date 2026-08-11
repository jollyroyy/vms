import { describe, it, expect } from 'vitest';
import {
  istDayStart, visitMoment, isVisitExpired, isDueToday, isOverdue, isOverstaying,
  OVERSTAY_HOURS, OVERDUE_GRACE_MINUTES,
} from '../../../src/lib/visitExpiry';
import type { Visit } from '../../../src/types/index';

// Helper: a visit is only ever three fields as far as this module cares.
const visit = (over: Partial<Visit>): Visit => ({
  scheduled_for: null,
  created_at: '2026-08-11T04:00:00Z',
  checked_in_at: null,
  status: 'approved',
  ...over,
} as Visit);

const at = (iso: string) => new Date(iso);

describe('istDayStart', () => {
  it('returns midnight IST as a UTC instant (18:30 the previous UTC day)', () => {
    // 2026-08-11 09:00 IST == 03:30Z. The IST day began at 2026-08-10T18:30Z.
    expect(istDayStart(at('2026-08-11T03:30:00Z')).toISOString()).toBe('2026-08-10T18:30:00.000Z');
  });

  it('has not rolled over yet at 23:00 IST', () => {
    // 2026-08-11 23:00 IST == 17:30Z, still the same IST day.
    expect(istDayStart(at('2026-08-11T17:30:00Z')).toISOString()).toBe('2026-08-10T18:30:00.000Z');
  });

  it('rolls over exactly at midnight IST', () => {
    expect(istDayStart(at('2026-08-11T18:30:00Z')).toISOString()).toBe('2026-08-11T18:30:00.000Z');
  });

  // The bug this guards: todayIso() used the UTC date, so between 00:00 and
  // 05:30 IST the app thought "today" was yesterday, and a visit booked for
  // 01:00 IST was filed under the previous day. Both ends of the day were wrong.
  it('treats 01:00 IST as belonging to the new IST day, not the old UTC one', () => {
    const earlyHours = at('2026-08-11T20:00:00Z'); // 2026-08-12 01:30 IST
    expect(istDayStart(earlyHours).toISOString()).toBe('2026-08-11T18:30:00.000Z');
  });
});

describe('visitMoment', () => {
  it('is the scheduled time when there is one', () => {
    const v = visit({ scheduled_for: '2026-08-11T10:00:00Z' });
    expect(visitMoment(v)).toBe('2026-08-11T10:00:00Z');
  });

  // Every walk-in lands here: WalkInRequest never sets scheduled_for, so the
  // approval's own creation is the only moment it has.
  it('falls back to created_at when no appointment was made', () => {
    expect(visitMoment(visit({ created_at: '2026-08-11T04:00:00Z' }))).toBe('2026-08-11T04:00:00Z');
  });
});

describe('isVisitExpired — end of day, never a grace period', () => {
  // THE REGRESSION GUARD. CheckInPanel used "more than 30 minutes past the
  // slot", which turned a visitor stuck in traffic away at the gate. Migration
  // 061 replaced that rule in the database; this keeps the client agreeing.
  it('does NOT expire a visit 45 minutes past its slot', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' }); // 09:30 IST
    expect(isVisitExpired(v, at('2026-08-11T04:45:00Z'))).toBe(false);
  });

  it('does NOT expire a visit three hours past its slot', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    expect(isVisitExpired(v, at('2026-08-11T07:00:00Z'))).toBe(false);
  });

  it('does NOT expire a visit late on its own evening', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    // 2026-08-11 23:45 IST — same IST day, still valid.
    expect(isVisitExpired(v, at('2026-08-11T18:15:00Z'))).toBe(false);
  });

  it('expires it once the IST day has ended', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    // 2026-08-12 00:15 IST.
    expect(isVisitExpired(v, at('2026-08-11T18:45:00Z'))).toBe(true);
  });

  it('never expires a future booking', () => {
    const v = visit({ scheduled_for: '2026-08-26T20:05:00Z' });
    expect(isVisitExpired(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });

  // The seven live rows this whole change was written for.
  it('expires a walk-in approved on a previous day', () => {
    const v = visit({ scheduled_for: null, created_at: '2026-08-09T19:12:19Z', status: 'walkin_approved' });
    expect(isVisitExpired(v, at('2026-08-11T04:00:00Z'))).toBe(true);
  });

  it('does NOT expire a walk-in approved earlier the same IST day', () => {
    const v = visit({ scheduled_for: null, created_at: '2026-08-11T02:00:00Z', status: 'walkin_approved' });
    expect(isVisitExpired(v, at('2026-08-11T10:00:00Z'))).toBe(false);
  });

  // Mirrors close_stale_approvals' `checked_in_at is null` guard: a visit that
  // was attended must never be reachable by an expiry rule, whatever its status.
  it('never expires a visit that was actually attended', () => {
    const v = visit({ scheduled_for: '2026-08-01T04:00:00Z', checked_in_at: '2026-08-01T04:30:00Z' });
    expect(isVisitExpired(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });
});

describe('isDueToday', () => {
  // THE BUG: CheckInPanel filtered on created_at being today, so the ordinary
  // case — booked yesterday, arriving today — was missing from the guard's list.
  it('includes a pre-approval booked yesterday for today', () => {
    const v = visit({ created_at: '2026-08-10T12:25:31Z', scheduled_for: '2026-08-11T10:55:00Z' });
    expect(isDueToday(v, at('2026-08-11T04:00:00Z'))).toBe(true);
  });

  it('includes one booked last week for today', () => {
    const v = visit({ created_at: '2026-08-04T09:30:29Z', scheduled_for: '2026-08-11T10:55:00Z' });
    expect(isDueToday(v, at('2026-08-11T04:00:00Z'))).toBe(true);
  });

  // A booking for next month reads at the gate exactly like one due now.
  it('excludes a future booking', () => {
    const v = visit({ created_at: '2026-08-04T09:30:29Z', scheduled_for: '2026-08-26T20:05:00Z' });
    expect(isDueToday(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });

  it('excludes an expired one', () => {
    const v = visit({ scheduled_for: '2026-08-09T10:00:00Z' });
    expect(isDueToday(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });

  it('includes a walk-in approved earlier today', () => {
    const v = visit({ status: 'walkin_approved', created_at: '2026-08-11T02:00:00Z' });
    expect(isDueToday(v, at('2026-08-11T10:00:00Z'))).toBe(true);
  });

  it('excludes someone already checked in', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z', checked_in_at: '2026-08-11T04:10:00Z' });
    expect(isDueToday(v, at('2026-08-11T05:00:00Z'))).toBe(false);
  });
});

describe('isOverdue — soft, and never terminal', () => {
  it('is false before the grace period is up', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    expect(isOverdue(v, at('2026-08-11T04:30:00Z'))).toBe(false);
  });

  it('is true once the grace period has passed', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    const past = new Date(at('2026-08-11T04:00:00Z').getTime() + (OVERDUE_GRACE_MINUTES + 1) * 60_000);
    expect(isOverdue(v, past)).toBe(true);
  });

  // Overdue is a nudge, not a status. The visit must still be checkable in.
  it('coexists with a visit that has NOT expired', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z' });
    const later = at('2026-08-11T08:00:00Z');
    expect(isOverdue(v, later)).toBe(true);
    expect(isVisitExpired(v, later)).toBe(false);
  });

  it('is false for a visit with no appointment to be late for', () => {
    expect(isOverdue(visit({ scheduled_for: null }), at('2026-08-11T23:00:00Z'))).toBe(false);
  });

  it('is false once the visitor has arrived', () => {
    const v = visit({ scheduled_for: '2026-08-11T04:00:00Z', checked_in_at: '2026-08-11T09:00:00Z' });
    expect(isOverdue(v, at('2026-08-11T10:00:00Z'))).toBe(false);
  });
});

describe('isOverstaying', () => {
  it('is false for someone who arrived an hour ago', () => {
    const v = visit({ status: 'checked_in', checked_in_at: '2026-08-11T03:00:00Z' });
    expect(isOverstaying(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });

  // The genuine overnight case: in at 21:00 IST, out at 08:00 IST is 11 hours
  // and must not trip the alarm, or the feature cries wolf every morning.
  it('is false for a normal overnight stay of eleven hours', () => {
    const v = visit({ status: 'checked_in', checked_in_at: '2026-08-10T15:30:00Z' }); // 21:00 IST
    expect(isOverstaying(v, at('2026-08-11T02:30:00Z'))).toBe(false); // 08:00 IST
  });

  it('is true past the threshold', () => {
    const inAt = at('2026-08-10T07:35:00Z');
    const now = new Date(inAt.getTime() + (OVERSTAY_HOURS + 1) * 3_600_000);
    expect(isOverstaying(visit({ status: 'checked_in', checked_in_at: inAt.toISOString() }), now)).toBe(true);
  });

  it('ignores anyone not currently inside', () => {
    const v = visit({ status: 'checked_out', checked_in_at: '2026-08-01T07:35:00Z' });
    expect(isOverstaying(v, at('2026-08-11T04:00:00Z'))).toBe(false);
  });

  it('is false when there is no check-in time to measure from', () => {
    expect(isOverstaying(visit({ status: 'checked_in', checked_in_at: null }), at('2026-08-11T04:00:00Z'))).toBe(false);
  });
});

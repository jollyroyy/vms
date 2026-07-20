// CHECK for goal.md S1/S2a (🎯) and S8 (🏭) — FR ref: PRD §3.2 flow, FR-VIS-08
import { describe, it, expect } from 'vitest';
import { canTransition, autoCloseAtDayEnd, type Visit } from '../../src/lib/visitLifecycle';

describe('S1/S2a: visit lifecycle', () => {
  it('follows the happy path: pending → approved → checked_in → checked_out', () => {
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'checked_out')).toBe(true);
  });

  it('a visitor cannot be checked in before approval', () => {
    expect(canTransition('pending_approval', 'checked_in')).toBe(false);
  });

  it('rejection is terminal', () => {
    expect(canTransition('pending_approval', 'rejected')).toBe(true);
    expect(canTransition('rejected', 'checked_in')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
  });

  it('a checked-out visit cannot be reopened', () => {
    expect(canTransition('checked_out', 'checked_in')).toBe(false);
  });
});

describe('S8/FR-VIS-08: auto-checkout at day close', () => {
  const openVisit: Visit = {
    id: 'v1',
    status: 'checked_in',
    checkedInAt: '2026-07-20T14:00:00Z',
    checkedOutAt: null,
    exitVerified: null,
  };

  it('closes still-inside visits and flags them as not verified', () => {
    const closed = autoCloseAtDayEnd(openVisit, '2026-07-20T22:00:00Z');
    expect(closed.status).toBe('checked_out');
    expect(closed.exitVerified).toBe(false);
    expect(closed.checkedOutAt).toBe('2026-07-20T22:00:00Z');
  });

  it('leaves properly checked-out visits untouched (guard-verified exit stays verified)', () => {
    const done: Visit = { ...openVisit, status: 'checked_out', checkedOutAt: '2026-07-20T16:00:00Z', exitVerified: true };
    const after = autoCloseAtDayEnd(done, '2026-07-20T22:00:00Z');
    expect(after).toEqual(done);
  });
});

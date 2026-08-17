// CHECK for goal.md S1/S2a (🎯), S8 (🏭), and HOD pre-approval — FR ref: PRD §3.2 flow, FR-VIS-08
import { describe, it, expect } from 'vitest';
import { canTransition, validatePreApproval, autoCloseAtDayEnd, type Visit } from '../../src/lib/visitLifecycle';

describe('S1/S2a: visit lifecycle', () => {
  it('follows the happy path: pending → approved → checked_in → checked_out', () => {
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('pending_approval', 'walkin_approved')).toBe(true);
    expect(canTransition('approved', 'checked_in')).toBe(true);
    expect(canTransition('walkin_approved', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'checked_out')).toBe(true);
  });

  // Migration 083 (2026-08-17) reverses 080: the approver CLEARS the walk-in,
  // the guard admits them. The edge is illegal again, and the reason is the
  // visitor card — the guard's check-in is the only step that collects one, and
  // 080's shortcut skipped it, leaving the card-return gate with nothing to
  // demand back at check-out. The host's yes has to land in `walkin_approved`
  // and wait for the gate.
  it('the approver cannot admit a walk-in — only clear it for the gate', () => {
    expect(canTransition('pending_approval', 'checked_in')).toBe(false);
    expect(canTransition('pending_approval', 'walkin_approved')).toBe(true);
    expect(canTransition('walkin_approved', 'checked_in')).toBe(true);
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

describe('HOD pre-approval', () => {
  it('accepts valid pre-approval input', () => {
    expect(validatePreApproval({ department_id: 'dept-1', purpose: 'meeting', scheduled_for: '2026-08-05T10:00' })).toBeNull();
  });

  it('rejects missing department_id', () => {
    expect(validatePreApproval({ department_id: '', purpose: 'meeting', scheduled_for: '2026-08-05T10:00' })).toBe('Department is required');
  });

  it('rejects missing purpose', () => {
    expect(validatePreApproval({ department_id: 'dept-1', purpose: '', scheduled_for: '2026-08-05T10:00' })).toBe('Purpose is required');
  });

  it('rejects null department_id', () => {
    expect(validatePreApproval({ department_id: null as unknown as string, purpose: 'meeting', scheduled_for: '2026-08-05T10:00' })).toBe('Department is required');
  });

  it('rejects missing scheduled_for', () => {
    expect(validatePreApproval({ department_id: 'dept-1', purpose: 'meeting', scheduled_for: '' })).toBe('Scheduled date and time is required');
  });

  it('department and purpose checks still run before the schedule check', () => {
    expect(validatePreApproval({ department_id: '', purpose: '', scheduled_for: '' })).toBe('Department is required');
    expect(validatePreApproval({ department_id: 'dept-1', purpose: '', scheduled_for: '' })).toBe('Purpose is required');
  });

  // expected_departure is what makes a multi-day contractor distinguishable
  // from a check-out somebody forgot — see migration 073.
  const base = { department_id: 'dept-1', purpose: 'meeting', scheduled_for: '2026-08-05T10:00' };

  it('accepts a pre-approval with no expected departure — it is optional', () => {
    expect(validatePreApproval(base)).toBeNull();
    expect(validatePreApproval({ ...base, expected_departure: '' })).toBeNull();
  });

  it('accepts a departure after the arrival, including days later', () => {
    expect(validatePreApproval({ ...base, expected_departure: '2026-08-05T17:00' })).toBeNull();
    expect(validatePreApproval({ ...base, expected_departure: '2026-08-08T17:00' })).toBeNull();
  });

  // Mirrors the visits_departure_after_arrival CHECK. A departure before the
  // arrival is not a long visit, it is a typo.
  it('rejects a departure before the arrival', () => {
    expect(validatePreApproval({ ...base, expected_departure: '2026-08-05T09:00' }))
      .toBe('Expected departure must be after the scheduled arrival');
  });

  it('rejects a departure equal to the arrival', () => {
    expect(validatePreApproval({ ...base, expected_departure: '2026-08-05T10:00' }))
      .toBe('Expected departure must be after the scheduled arrival');
  });
});

describe('M2-VISIT: edge cases', () => {
  it('approved → rejected is NOT a valid transition (must check-in or stay approved)', () => {
    expect(canTransition('approved', 'rejected')).toBe(false);
  });

  // "Skip approval not allowed", restored. It briefly became legal as 080's
  // approver shortcut and migration 083 removed it again — see the note on the
  // same edge above. The rule: an UNDECIDED visit can never reach the gate.
  it('pending → checked_in is NOT valid — nobody has cleared them yet', () => {
    expect(canTransition('pending_approval', 'checked_in')).toBe(false);
  });

  it('rejected → rejected (same state) is NOT valid — no no-op transitions', () => {
    expect(canTransition('rejected', 'rejected')).toBe(false);
  });

  it('unknown source state returns false (not crash)', () => {
    expect(canTransition('bogus' as any, 'approved')).toBe(false);
  });

  it('auto-close on a rejected visit leaves it untouched', () => {
    const rejected: Visit = { id: 'v1', status: 'rejected', checkedInAt: null, checkedOutAt: null, exitVerified: null };
    expect(autoCloseAtDayEnd(rejected, '2026-07-20T22:00:00Z')).toEqual(rejected);
  });

  it('auto-close on a checked-out visit with unverified exit leaves it untouched', () => {
    const done: Visit = { id: 'v1', status: 'checked_out', checkedInAt: '2026-07-20T10:00:00Z', checkedOutAt: '2026-07-20T16:00:00Z', exitVerified: false };
    expect(autoCloseAtDayEnd(done, '2026-07-20T22:00:00Z')).toEqual(done);
  });
});

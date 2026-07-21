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

describe('HOD pre-approval', () => {
  it('accepts valid pre-approval input', () => {
    expect(validatePreApproval({ department_id: 'dept-1', host_id: 'host-1', purpose: 'meeting' })).toBeNull();
  });

  it('rejects missing department_id', () => {
    expect(validatePreApproval({ department_id: '', host_id: 'host-1', purpose: 'meeting' })).toBe('Department is required');
  });

  it('rejects missing host_id', () => {
    expect(validatePreApproval({ department_id: 'dept-1', host_id: '', purpose: 'meeting' })).toBe('Host is required');
  });

  it('rejects missing purpose', () => {
    expect(validatePreApproval({ department_id: 'dept-1', host_id: 'host-1', purpose: '' })).toBe('Purpose is required');
  });

  it('rejects null department_id', () => {
    expect(validatePreApproval({ department_id: null as unknown as string, host_id: 'host-1', purpose: 'meeting' })).toBe('Department is required');
  });
});

describe('M2-VISIT: edge cases', () => {
  it('approved → rejected is NOT a valid transition (must check-in or stay approved)', () => {
    expect(canTransition('approved', 'rejected')).toBe(false);
  });

  it('pending → checked_in is NOT valid (skip approval not allowed)', () => {
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

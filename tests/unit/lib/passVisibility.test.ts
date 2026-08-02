// The pass used to be gated on `status === 'approved'` alone, so it vanished
// the instant a guard checked the visitor in — exactly when an HOD is most
// likely to need to reprint it. These lock in which statuses keep it.
import { describe, it, expect } from 'vitest';
import { canRoleShowPass, canShowPass } from '../../../src/lib/passVisibility';
import type { UserRole, VisitStatus } from '../../../src/types/index';

describe('L-PASS-VIS: canShowPass', () => {
  it('shows the pass for a pre-approved visit', () => {
    expect(canShowPass('approved')).toBe(true);
  });

  it('shows the pass for an approved walk-in', () => {
    expect(canShowPass('walkin_approved')).toBe(true);
  });

  it('keeps the pass reachable after the visitor is checked in', () => {
    expect(canShowPass('checked_in')).toBe(true);
  });

  it('hides the pass before anyone has approved the visit', () => {
    expect(canShowPass('pending_approval')).toBe(false);
  });

  it.each<VisitStatus>(['checked_out', 'rejected', 'cancelled', 'no_show'])(
    'hides the pass for a visit that is over (%s)',
    (status) => {
      expect(canShowPass(status)).toBe(false);
    },
  );

  it('returns a boolean for every known status', () => {
    const all: VisitStatus[] = [
      'pending_approval', 'approved', 'walkin_approved', 'checked_in',
      'checked_out', 'rejected', 'cancelled', 'no_show',
    ];
    all.forEach((status) => expect(typeof canShowPass(status)).toBe('boolean'));
  });
});

// A pass a guard can open, print or download is a pass that can be issued
// without the visitor ever standing at the gate. The status gate above says
// nothing about who is looking, so this is a second, independent gate.
describe('L-PASS-VIS: canRoleShowPass', () => {
  it('never shows the pass to a guard', () => {
    expect(canRoleShowPass('guard')).toBe(false);
  });

  it.each<UserRole>(['hod', 'staff', 'admin'])(
    'still shows the pass to %s',
    (role) => {
      expect(canRoleShowPass(role)).toBe(true);
    },
  );

  // Fails closed: a caller that forgets the prop must hide the pass, not leak
  // it, and a role that has not loaded yet must not flash the pass on screen.
  it('hides the pass when the role is unknown', () => {
    expect(canRoleShowPass(null)).toBe(false);
    expect(canRoleShowPass(undefined)).toBe(false);
  });
});

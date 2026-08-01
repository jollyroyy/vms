// The pass used to be gated on `status === 'approved'` alone, so it vanished
// the instant a guard checked the visitor in — exactly when an HOD is most
// likely to need to reprint it. These lock in which statuses keep it.
import { describe, it, expect } from 'vitest';
import { canShowPass } from '../../../src/lib/passVisibility';
import type { VisitStatus } from '../../../src/types/index';

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

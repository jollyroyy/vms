import { describe, it, expect } from 'vitest';
import { visitOrigin, visitOriginLabel, statusProvesOrigin } from '../../../src/lib/visitOrigin';
import type { Visit } from '../../../src/types/index';

function visit(over: Partial<Visit>): Visit {
  return { id: 'v1', status: 'checked_in', scheduled_for: null, ...over } as unknown as Visit;
}

describe('visitOrigin', () => {
  // The states that PROVE an origin on their own. A walk-in is the only visit
  // that ever passes through pending_approval / walkin_approved, and a
  // pre-approval is the only one INSERTed already `approved`.
  it('reads pending_approval as a walk-in, whatever else the row says', () => {
    expect(visitOrigin(visit({ status: 'pending_approval' }))).toBe('walk_in');
  });

  it('reads walkin_approved as a walk-in', () => {
    expect(visitOrigin(visit({ status: 'walkin_approved' }))).toBe('walk_in');
  });

  it('reads approved as pre-approved', () => {
    expect(visitOrigin(visit({ status: 'approved' }))).toBe('pre_approved');
  });

  // Once a visitor is inside, status is `checked_in` for both routes and the
  // proof above is gone. scheduled_for is what is left: the walk-in path never
  // sets it, and validatePreApproval makes it mandatory on a pre-approval.
  it('falls back to scheduled_for once the visit is checked in', () => {
    expect(visitOrigin(visit({ status: 'checked_in', scheduled_for: '2026-08-13T04:00:00Z' })))
      .toBe('pre_approved');
    expect(visitOrigin(visit({ status: 'checked_in', scheduled_for: null }))).toBe('walk_in');
  });

  it('applies the same fallback to a visit that has already left', () => {
    expect(visitOrigin(visit({ status: 'checked_out', scheduled_for: '2026-08-13T04:00:00Z' })))
      .toBe('pre_approved');
    expect(visitOrigin(visit({ status: 'checked_out', scheduled_for: null }))).toBe('walk_in');
  });

  it('the definitive status wins over a contradictory scheduled_for', () => {
    // A walk-in should never carry a scheduled_for, but if one ever did, the
    // status is the stronger evidence and must not be overridden by the guess.
    expect(visitOrigin(visit({ status: 'walkin_approved', scheduled_for: '2026-08-13T04:00:00Z' })))
      .toBe('walk_in');
  });
});

// A card that already carries a status badge must not print the origin twice.
// `STATUS_STYLES.approved` reads "Pre-approved" in so many words, so this is
// what tells VisitorGridCard when its own origin chip would be a duplicate.
describe('statusProvesOrigin', () => {
  it.each(['pending_approval', 'walkin_approved', 'approved'] as const)(
    'is true for %s — the badge already says which desk it came through',
    (status) => {
      expect(statusProvesOrigin(status)).toBe(true);
    },
  );

  it.each(['checked_in', 'checked_out', 'no_show', 'expired', 'cancelled', 'rejected'] as const)(
    'is false for %s — both routes converge here and the badge stops saying',
    (status) => {
      expect(statusProvesOrigin(status)).toBe(false);
    },
  );
});

describe('visitOriginLabel', () => {
  it('spells each origin the way the gate says it out loud', () => {
    expect(visitOriginLabel('pre_approved')).toBe('Pre-approved');
    expect(visitOriginLabel('walk_in')).toBe('Walk-in');
  });
});

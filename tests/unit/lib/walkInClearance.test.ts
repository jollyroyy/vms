// The clearance lanes, after migration 080.
//
// 080 made the approver's click admit the visitor outright: a walk-in goes
// `pending_approval -> checked_in` and never rests in `walkin_approved`. Every
// lane that asked "which walk-ins did a host approve?" was keyed on that
// holding status, so all three emptied themselves the moment the shortcut
// shipped — the guard's tile, the /visitors/approved segment and the HOD's own
// board. This file pins the replacement rule: the lane follows the CLEARANCE,
// not the holding state, so an approved walk-in is listed whether it is still
// at the gate or already inside.
import { describe, it, expect } from 'vitest';
import { isApprovedWalkIn, isGivenPreApproval } from '../../../src/lib/visitOrigin';
import { SEGMENT_FILTER } from '../../../src/lib/visitorSegments';
import { TILE_FILTER, tileVisits } from '../../../src/lib/guardTiles';
import { hodTileVisits } from '../../../src/lib/hodTiles';
import { canTransition } from '../../../src/lib/visitLifecycle';
import type { Visit, VisitStatus } from '../../../src/types/index';

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'walkin_approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-16T04:00:00Z',
    ...overrides,
  } as Visit;
}

/** A walk-in has no slot — that is what distinguishes it from a pre-approval
 *  once both have converged on `checked_in`. See the caveat in visitOrigin.ts. */
const walkIn = (status: VisitStatus, extra: Partial<Visit> = {}) =>
  visit({ status, scheduled_for: null, ...extra });

const preApproval = (status: VisitStatus, extra: Partial<Visit> = {}) =>
  visit({ status, scheduled_for: '2026-08-16T09:00:00Z', ...extra });

describe('isApprovedWalkIn', () => {
  it('is true for a walk-in still waiting at the gate', () => {
    expect(isApprovedWalkIn(walkIn('walkin_approved'))).toBe(true);
  });

  // The regression this whole change exists for: the approver admitted them in
  // the same click, so the row is `checked_in` seconds after the decision.
  it('stays true once the approved walk-in has been let in', () => {
    expect(isApprovedWalkIn(walkIn('checked_in', { checked_in_at: '2026-08-16T05:00:00Z' }))).toBe(true);
  });

  it('stays true after they leave — the host still approved them', () => {
    expect(isApprovedWalkIn(walkIn('checked_out', {
      checked_in_at: '2026-08-16T05:00:00Z', checked_out_at: '2026-08-16T07:00:00Z',
    }))).toBe(true);
  });

  it('is false while nobody has decided yet', () => {
    expect(isApprovedWalkIn(walkIn('pending_approval'))).toBe(false);
  });

  it('is false when the host said no', () => {
    expect(isApprovedWalkIn(walkIn('rejected'))).toBe(false);
  });

  // A clearance that lapsed unused is not somebody to look for on this lane.
  it.each<VisitStatus>(['no_show', 'expired', 'cancelled'])('is false for %s', (status) => {
    expect(isApprovedWalkIn(walkIn(status))).toBe(false);
  });

  it('is false for a pre-approval, however far along it is', () => {
    expect(isApprovedWalkIn(preApproval('approved'))).toBe(false);
    expect(isApprovedWalkIn(preApproval('checked_in', { checked_in_at: '2026-08-16T05:00:00Z' }))).toBe(false);
  });
});

describe('isGivenPreApproval', () => {
  it('counts a pass that has been issued and one that has been used', () => {
    expect(isGivenPreApproval(preApproval('approved'))).toBe(true);
    expect(isGivenPreApproval(preApproval('checked_in', { checked_in_at: '2026-08-16T05:00:00Z' }))).toBe(true);
  });

  it('never counts a walk-in', () => {
    expect(isGivenPreApproval(walkIn('walkin_approved'))).toBe(false);
    expect(isGivenPreApproval(walkIn('checked_in', { checked_in_at: '2026-08-16T05:00:00Z' }))).toBe(false);
  });

  // The two lanes are complementary, never overlapping: one visit is one desk.
  it('is mutually exclusive with isApprovedWalkIn', () => {
    const rows = [
      walkIn('walkin_approved'), walkIn('checked_in'), walkIn('checked_out'),
      preApproval('approved'), preApproval('checked_in'), preApproval('checked_out'),
    ];
    rows.forEach((v) => expect(isApprovedWalkIn(v) && isGivenPreApproval(v)).toBe(false));
  });
});

describe('the three lanes answer with one rule', () => {
  const admitted = walkIn('checked_in', { id: 'admitted', checked_in_at: '2026-08-16T05:00:00Z' });
  const waiting = walkIn('walkin_approved', { id: 'waiting' });

  it('the /visitors segment lists an admitted walk-in alongside a waiting one', () => {
    expect(SEGMENT_FILTER.walkinApproved(admitted)).toBe(true);
    expect(SEGMENT_FILTER.walkinApproved(waiting)).toBe(true);
  });

  it('the guard tile counts it too', () => {
    expect(TILE_FILTER.walkinApproved(admitted)).toBe(true);
  });

  it('the HOD tile counts it too', () => {
    const tiles = hodTileVisits({ day: [admitted, waiting], onSite: [], walkIns: [] });
    expect(tiles.walkInApprovedToday.map((v) => v.id)).toEqual(['admitted', 'waiting']);
  });

  // The client's actual complaint: after approval the visitor must appear in
  // BOTH places, not move from one to the other.
  it('an admitted walk-in is in Checked In AND Approved Walk-ins at once', () => {
    const tiles = tileVisits([admitted], new Date('2026-08-16T06:00:00Z'));
    expect(tiles.checked.map((v) => v.id)).toEqual(['admitted']);
    expect(tiles.walkinApproved.map((v) => v.id)).toEqual(['admitted']);
    expect(tiles.inside.map((v) => v.id)).toEqual(['admitted']);
  });
});

describe('the client state machine mirrors migration 080', () => {
  it('allows the approver to admit a walk-in in one act', () => {
    expect(canTransition('pending_approval', 'checked_in')).toBe(true);
  });

  // 080 explicitly does NOT retire the holding state — live rows sit in it and
  // /visitors/approved still admits them.
  it('still allows the two-step route through walkin_approved', () => {
    expect(canTransition('pending_approval', 'walkin_approved')).toBe(true);
    expect(canTransition('walkin_approved', 'checked_in')).toBe(true);
  });

  it('does not let a pre-approval skip the gate', () => {
    expect(canTransition('approved', 'checked_out')).toBe(false);
  });
});

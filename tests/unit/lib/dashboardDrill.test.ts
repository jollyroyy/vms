import { describe, it, expect } from 'vitest';
import { DRILL_KEYS, DRILL_COPY, drillVisits } from '../../../src/lib/dashboardDrill';
import type { Visit } from '../../../src/types/index';

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-03T04:00:00Z',
    ...overrides,
  } as Visit;
}

const approved = visit({ id: 'approved', status: 'approved' });
const walkinApproved = visit({ id: 'walkinApproved', status: 'walkin_approved' });
const inside = visit({ id: 'inside', status: 'checked_in', checked_in_at: '2026-08-03T05:00:00Z' });
const left = visit({
  id: 'left', status: 'checked_out',
  checked_in_at: '2026-08-03T03:00:00Z', checked_out_at: '2026-08-03T06:00:00Z',
});
const declined = visit({ id: 'declined', status: 'rejected' });
const pending = visit({ id: 'pending', status: 'pending_approval' });

const ALL = [approved, walkinApproved, inside, left, declined, pending];

describe('dashboardDrill', () => {
  it('every key has copy, so no tile can expand into an untitled panel', () => {
    DRILL_KEYS.forEach((k) => {
      expect(DRILL_COPY[k].title).toBeTruthy();
      expect(DRILL_COPY[k].empty).toBeTruthy();
    });
  });

  it('"expected" covers both approved and walkin_approved', () => {
    expect(drillVisits(ALL, 'expected').map((v) => v.id)).toEqual(
      expect.arrayContaining(['approved', 'walkinApproved']),
    );
    expect(drillVisits(ALL, 'expected')).toHaveLength(2);
  });

  it('"inside" is live occupancy only — a visitor who left is not inside', () => {
    expect(drillVisits(ALL, 'inside').map((v) => v.id)).toEqual(['inside']);
  });

  // The bug the dashboard rebuild fixed: `entered` is cumulative and derived
  // from checked_in_at, so it must include the visitor who has since left.
  it('"entered" is cumulative and includes visitors who already checked out', () => {
    expect(drillVisits(ALL, 'entered').map((v) => v.id).sort()).toEqual(['inside', 'left']);
  });

  it('holds the entered === inside + checkedOut invariant', () => {
    expect(drillVisits(ALL, 'entered')).toHaveLength(
      drillVisits(ALL, 'inside').length + drillVisits(ALL, 'checkedOut').length,
    );
  });

  it('"declined" is HOD rejection, not a pending request', () => {
    expect(drillVisits(ALL, 'declined').map((v) => v.id)).toEqual(['declined']);
  });

  it('sorts by the most recent event first', () => {
    const rows = drillVisits([inside, left], 'entered');
    expect(rows.map((v) => v.id)).toEqual(['left', 'inside']);
  });

  it('returns an empty array rather than throwing when nothing matches', () => {
    expect(drillVisits([], 'inside')).toEqual([]);
    expect(drillVisits([pending], 'checkedOut')).toEqual([]);
  });

  it('does not mutate the array it is given', () => {
    const input = [inside, left];
    drillVisits(input, 'entered');
    expect(input.map((v) => v.id)).toEqual(['inside', 'left']);
  });
});

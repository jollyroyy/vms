// The three pure slicers over the removal queue — no hook rendering, no
// supabase mock needed. The live hook (fetch + subscribe) is exercised only
// through the pages that use it.
import { describe, it, expect } from 'vitest';
import { pendingRemovals, decidedRemovals, hasOpenRemoval } from '../../../src/lib/useBlacklistRemovals';
import type { BlacklistRemovalRequest } from '../../../src/types/index';

function request(over: Partial<BlacklistRemovalRequest> = {}): BlacklistRemovalRequest {
  return {
    id: 'r1',
    visitor_id: 'v1',
    requested_by: 'admin1',
    justification: 'A justification of adequate length.',
    blacklist_reason: 'Repeated policy violation',
    status: 'pending',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_at: '2026-08-17T08:00:00Z',
    ...over,
  };
}

describe('pendingRemovals', () => {
  it('returns only rows still awaiting a decision', () => {
    const rows = [
      request({ id: 'a', status: 'pending' }),
      request({ id: 'b', status: 'approved', decided_at: '2026-08-17T09:00:00Z' }),
      request({ id: 'c', status: 'rejected', decided_at: '2026-08-17T09:00:00Z' }),
    ];
    expect(pendingRemovals(rows).map((r) => r.id)).toEqual(['a']);
  });

  // A queue is worked forwards — the longest-waiting request is the one that
  // needs deciding, so it must sort to the front, not the back.
  it('sorts the pending queue oldest first', () => {
    const rows = [
      request({ id: 'newest', created_at: '2026-08-17T10:00:00Z' }),
      request({ id: 'oldest', created_at: '2026-08-15T06:00:00Z' }),
      request({ id: 'middle', created_at: '2026-08-16T12:00:00Z' }),
    ];
    expect(pendingRemovals(rows).map((r) => r.id)).toEqual(['oldest', 'middle', 'newest']);
  });
});

describe('decidedRemovals', () => {
  it('returns only rows that have been decided', () => {
    const rows = [
      request({ id: 'a', status: 'pending' }),
      request({ id: 'b', status: 'approved', decided_at: '2026-08-17T09:00:00Z' }),
    ];
    expect(decidedRemovals(rows).map((r) => r.id)).toEqual(['b']);
  });

  // The decided list is a history looked at to check what just happened, so
  // it sorts the opposite way from the pending queue: most recent first.
  it('sorts decided rows most-recent decision first', () => {
    const rows = [
      request({ id: 'old', status: 'approved', decided_at: '2026-08-10T09:00:00Z' }),
      request({ id: 'new', status: 'rejected', decided_at: '2026-08-17T09:00:00Z' }),
    ];
    expect(decidedRemovals(rows).map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('hasOpenRemoval', () => {
  it('is true when the visitor has a pending request', () => {
    const rows = [request({ id: 'a', visitor_id: 'v1', status: 'pending' })];
    expect(hasOpenRemoval(rows, 'v1')).toBe(true);
  });

  it('is false when the visitor has no request at all', () => {
    expect(hasOpenRemoval([], 'v1')).toBe(false);
  });

  // A visitor may legitimately be re-flagged and asked about again — a past
  // decision must never be mistaken for an open one, or a genuinely new
  // request could never be filed for them.
  it('is false for a visitor whose only request was already decided', () => {
    const rows = [
      request({ id: 'a', visitor_id: 'v1', status: 'approved', decided_at: '2026-08-16T09:00:00Z' }),
      request({ id: 'b', visitor_id: 'v1', status: 'rejected', decided_at: '2026-08-17T09:00:00Z' }),
    ];
    expect(hasOpenRemoval(rows, 'v1')).toBe(false);
  });

  it('does not confuse a pending request on a different visitor', () => {
    const rows = [request({ id: 'a', visitor_id: 'other-visitor', status: 'pending' })];
    expect(hasOpenRemoval(rows, 'v1')).toBe(false);
  });
});

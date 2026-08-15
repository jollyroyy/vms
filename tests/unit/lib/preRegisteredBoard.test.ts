// The Pre-Registered board is TODAY'S PRE-APPROVALS WHO HAVE NOT ARRIVED YET
// (client instruction, 2026-08-15). Both constraints are tested here, because
// each one removes a whole class of row that used to be on the board: yesterday
// turned it into an archive, and a checked-in visitor put the same person on
// two tabs at once with nothing saying which was authoritative.
import { describe, it, expect } from 'vitest';
import {
  chipCounts,
  chipVisits,
  isPreRegisteredArrival,
  preRegisteredPill,
} from '../../../src/lib/preRegisteredBoard';
import type { ReportVisit } from '../../../src/lib/reportRow';

// 2026-08-14 09:30 IST = 04:00Z.
const NOW = new Date('2026-08-14T04:00:00Z');

const v = (over: Partial<ReportVisit>): ReportVisit =>
  ({
    id: Math.random().toString(36),
    status: 'approved',
    checked_in_at: null,
    created_at: '2026-08-14T02:00:00Z',
    scheduled_for: '2026-08-14T05:00:00Z', // 10:30 IST — still ahead
    purpose: 'meeting',
    ...over,
  }) as unknown as ReportVisit;

describe('isPreRegisteredArrival — who belongs on the board', () => {
  it('accepts an approved visitor booked for today who has not arrived', () => {
    expect(isPreRegisteredArrival(v({}), NOW)).toBe(true);
  });

  it('rejects a visitor who has already checked in', () => {
    // They are on Entry & Exit now. Listing them here too is one visitor on two
    // boards, and the guard has to work out which one is authoritative.
    expect(isPreRegisteredArrival(v({ status: 'checked_in', checked_in_at: '2026-08-14T03:30:00Z' }), NOW)).toBe(false);
  });

  it('rejects a visitor who has already checked out', () => {
    expect(isPreRegisteredArrival(v({ status: 'checked_out', checked_in_at: '2026-08-14T03:00:00Z' }), NOW)).toBe(false);
  });

  it('rejects yesterday, however it ended', () => {
    expect(isPreRegisteredArrival(v({ scheduled_for: '2026-08-13T05:00:00Z' }), NOW)).toBe(false);
    expect(isPreRegisteredArrival(v({ status: 'no_show', scheduled_for: '2026-08-13T05:00:00Z' }), NOW)).toBe(false);
  });

  it('rejects a walk-in — walkin_approved is never a pre-approval', () => {
    expect(isPreRegisteredArrival(v({ status: 'walkin_approved' }), NOW)).toBe(false);
  });

  it.each(['no_show', 'expired', 'cancelled', 'rejected'])('rejects a closed %s row', (status) => {
    expect(isPreRegisteredArrival(v({ status: status as never }), NOW)).toBe(false);
  });
});

describe('preRegisteredPill', () => {
  it('is EXPECTED while the slot is still ahead', () => {
    expect(preRegisteredPill(v({}), NOW).label).toBe('EXPECTED');
  });

  it('is MISSED just past the slot and LATE beyond 30 minutes', () => {
    expect(preRegisteredPill(v({ scheduled_for: '2026-08-14T03:50:00Z' }), NOW).label).toBe('MISSED');
    expect(preRegisteredPill(v({ scheduled_for: '2026-08-14T03:00:00Z' }), NOW).label).toBe('LATE');
  });
});

describe('chip filters', () => {
  const ahead = v({ id: 'a' } as never);
  const missed = v({ id: 'b', scheduled_for: '2026-08-14T03:50:00Z' } as never);
  const late = v({ id: 'c', scheduled_for: '2026-08-14T03:00:00Z' } as never);
  const board = [ahead, missed, late];

  it('slices a board that already excludes arrivals and other days', () => {
    expect(chipCounts(board, NOW)).toEqual({ all: 3, arriving: 1, missed: 1, late: 1 });
  });

  it('a chip count is the length of the list it opens', () => {
    const counts = chipCounts(board, NOW);
    for (const chip of ['all', 'arriving', 'missed', 'late'] as const) {
      expect(chipVisits(chip, board, NOW)).toHaveLength(counts[chip]);
    }
  });

  it('has no Arrived chip — an arrived visitor is not on this board at all', () => {
    expect(Object.keys(chipCounts(board, NOW))).not.toContain('arrived');
  });
});

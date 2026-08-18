import { describe, it, expect } from 'vitest';

import { gateChips } from '../../../src/lib/visitGateChips';
import type { ReportVisit } from '../../../src/lib/reportRow';

// The presence chip is the Status cell on the guard dashboard's panel AND on
// the Entry & Exit table, so its wording is read at the exact moment a guard
// has pressed a tile. Client instruction, 2026-08-16: pressing Checked In must
// open onto rows that say "Checked in" — the board contradicted itself when the
// tile's own population reported as "Still inside" or "Approved walk-in".

const now = new Date('2026-08-16T10:00:00Z');

const visit = (over: Partial<ReportVisit>): ReportVisit =>
  ({
    id: 'v1',
    purpose: 'meeting',
    status: 'checked_in',
    scheduled_for: null,
    checked_in_at: '2026-08-16T09:30:00Z',
    checked_out_at: null,
    created_at: '2026-08-16T09:00:00Z',
    ...over,
  } as unknown as ReportVisit);

const presence = (v: ReportVisit) => gateChips(v, now).find((c) => c.key === 'presence')!;

describe('gateChips — presence', () => {
  it('says Checked in for a visitor on site', () => {
    expect(presence(visit({ status: 'checked_in' })).label).toBe('Checked in');
  });

  // Migration 083 (2026-08-17). This read "Checked in" for the one day 080's
  // shortcut made the approver's click the admission. The admission is the
  // guard's again, so a cleared walk-in is a visitor the host said yes to who
  // is still outside — and must never be toned as inside, because that tone is
  // what the fire-marshal list is read off.
  it('says Awaiting gate check-in for a host-cleared walk-in still at the gate', () => {
    const chip = presence(visit({ status: 'walkin_approved', checked_in_at: null }));
    expect(chip.label).toBe('Awaiting gate check-in');
    expect(chip.tone).not.toBe('inside');
  });

  // The one distinction that survives: a visitor who has left is not on site,
  // and the Entry & Exit tab's two lanes are built on exactly that difference.
  it('still says Checked out for a visitor who has left', () => {
    expect(presence(visit({ status: 'checked_out', checked_out_at: '2026-08-16T09:50:00Z' })).label)
      .toBe('Checked out');
  });

  it('leaves the undecided and the un-arrived alone', () => {
    expect(presence(visit({ status: 'pending_approval', checked_in_at: null })).label)
      .toBe('Awaiting approval');
    expect(presence(visit({ status: 'approved', checked_in_at: null })).label)
      .toBe('Pre-registered');
    expect(presence(visit({ status: 'no_show', checked_in_at: null })).label)
      .toBe('Not arrived');
  });
});

// A SLOT THAT PREDATES ITS OWN BOOKING IS NOT AN APPOINTMENT (client report,
// 2026-08-18: "his scheduled time was 12 am and he checked in around 11 am —
// how is he late here?").
//
// The live row: raised at 10:08 IST on 18 August, for 00:10 IST the SAME
// morning — a picker left on AM — and checked in at 11:22. The subtraction was
// right and the conclusion was nonsense, because nobody could have arrived on
// time for a slot that was ten hours gone when the pass was made. The chip now
// says nothing rather than something untrue; `validatePreApproval` stops any
// more of these being created, and this covers the ones already stored.
describe('gateChips — late arrival', () => {
  const late = (v: ReportVisit) => gateChips(v, now).find((c) => c.key === 'late');

  it('does not call a visitor late against a slot booked after it had passed', () => {
    expect(late(visit({
      status: 'checked_in',
      created_at: '2026-08-18T04:38:00Z',      // 10:08 IST
      scheduled_for: '2026-08-17T18:40:00Z',   // 00:10 IST, ten hours earlier
      checked_in_at: '2026-08-18T05:52:00Z',   // 11:22 IST
    }))).toBeUndefined();
  });

  // The rule must not swallow the case it exists to report. Same visitor, same
  // arrival, but the slot was booked BEFORE it came round.
  it('still calls a visitor late when the slot was a real appointment', () => {
    const chip = late(visit({
      status: 'checked_in',
      created_at: '2026-08-17T18:00:00Z',      // booked the night before
      scheduled_for: '2026-08-17T18:40:00Z',   // 00:10 IST
      checked_in_at: '2026-08-18T05:52:00Z',   // 11:22 IST
    }));
    expect(chip?.label).toMatch(/^Late by /);
  });

  // A pass raised for a visitor already standing at the desk is ordinary, and
  // the few minutes between typing "now" and the row landing must not disqualify
  // the slot.
  it('accepts a slot a handful of minutes behind its booking', () => {
    const chip = late(visit({
      status: 'checked_in',
      created_at: '2026-08-16T04:05:00Z',
      scheduled_for: '2026-08-16T04:00:00Z',   // five minutes back
      checked_in_at: '2026-08-16T09:00:00Z',   // ~5h later
    }));
    expect(chip?.label).toMatch(/^Late by /);
  });
});

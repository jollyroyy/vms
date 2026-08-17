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
  it('says Awaiting entry for a host-cleared walk-in still at the gate', () => {
    const chip = presence(visit({ status: 'walkin_approved', checked_in_at: null }));
    expect(chip.label).toBe('Awaiting entry');
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

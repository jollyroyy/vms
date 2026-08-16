import { describe, it, expect } from 'vitest';

import { PANEL_SPEC } from '../../../src/lib/dashboardColumns';
import type { ReportVisit } from '../../../src/lib/reportRow';

// The guard dashboard's stacked panel must say WHAT KIND of ID proof was taken
// off a visitor who is through the gate (client instruction, 2026-08-15). The
// document type is the half a guard is later asked to account for, and until
// now it was only reachable by opening a row's popup.

const base = {
  id: 'v1',
  ref_number: 'VIS-20260815-0001',
  purpose: 'meeting',
  status: 'checked_in',
  scheduled_for: '2026-08-15T04:00:00Z',
  checked_in_at: '2026-08-15T04:05:00Z',
  checked_out_at: null,
  created_at: '2026-08-15T03:00:00Z',
  host: { id: 'h1', full_name: 'Jane Smith' },
  department: { id: 'd1', name: 'Engineering' },
} as unknown as ReportVisit;

const withId = (id_type: string | null, id_last4: string | null): ReportVisit =>
  ({ ...base, visitor: { full_name: 'Alice Johnson', id_type, id_last4 } } as unknown as ReportVisit);

const idColumn = (key: keyof typeof PANEL_SPEC) =>
  PANEL_SPEC[key].columns.find((c) => c.key === 'idProof');

const now = new Date('2026-08-15T05:00:00Z');

describe('PANEL_SPEC — ID proof column', () => {
  // Every lane whose rows have been through a check-in: the ID is taken at the
  // gate, so these are exactly the rows that can have one.
  it.each(['checked', 'inside', 'overstaying', 'all'] as const)(
    'the %s panel carries an ID Proof column',
    (key) => {
      expect(idColumn(key)?.header).toBe('ID Proof');
    },
  );

  // Nobody in these lanes has reached a camera or a document check, so the
  // column would be "Not recorded" on every row — a column that says nothing.
  it.each(['expected', 'pending', 'walkinApproved'] as const)(
    'the %s panel does not carry one',
    (key) => {
      expect(idColumn(key)).toBeUndefined();
    },
  );

  it('names the document type and masks the number', () => {
    expect(idColumn('checked')!.value(withId('Aadhaar', '123456'), now)).toBe('Aadhaar ••••56');
  });

  // The TYPE is the answer to the question this column was added for, so it is
  // printed even when the digits were never captured.
  it('still names the type when no digits are on record', () => {
    expect(idColumn('inside')!.value(withId('Driving Licence', null), now)).toBe('Driving Licence');
  });

  // "Not recorded", never a dash: a dash reads as a document with no name,
  // and the honest answer is that nothing was taken off this visitor.
  it('says nothing was recorded rather than printing a dash', () => {
    expect(idColumn('all')!.value(withId(null, null), now)).toBe('Not recorded');
    expect(idColumn('all')!.value(withId(null, '123456'), now)).toBe('Not recorded');
  });
});

// Client instruction, 2026-08-16: "always everybody should be able to see who
// is walk-in and who is pre-approved". Every route converges on `checked_in`,
// so from the gate onwards the status says nothing about which desk a visitor
// came through — and these are exactly the lanes that hold both kinds at once.
describe('PANEL_SPEC — visit type column', () => {
  const originColumn = (key: keyof typeof PANEL_SPEC) =>
    PANEL_SPEC[key].columns.find((c) => c.key === 'origin');

  it.each(['checked', 'inside', 'all', 'overstaying', 'declinedByHost', 'refusedByGuard'] as const)(
    'the %s panel says whether each row was booked ahead or walked in',
    (key) => {
      expect(originColumn(key)?.header).toBe('Type of Visitor');
    },
  );

  // Every row in these lanes is fixed by the lane's own membership rule —
  // `pending_approval` and `walkin_approved` are only ever reached from the
  // gate's register, and `expected` is `approved` with no entry stamp, which
  // only a pre-approval can be. The column would print one word on every line,
  // and the heading has already said it.
  it.each(['pending', 'walkinApproved', 'expected'] as const)(
    'the %s panel does not carry one — its whole lane is one kind',
    (key) => {
      expect(originColumn(key)).toBeUndefined();
    },
  );

  it('reads the origin off the status where the status proves it', () => {
    const column = originColumn('all')!;
    expect(column.value({ ...base, status: 'walkin_approved' } as ReportVisit, now)).toBe('Walk-in');
    expect(column.value({ ...base, status: 'approved' } as ReportVisit, now)).toBe('Pre-approved');
  });

  // Once a visit is `checked_in` both routes have converged and only the slot
  // is left to infer from — the walk-in path never sets one.
  it('falls back to the slot once the routes have converged', () => {
    const column = originColumn('inside')!;
    expect(column.value(base, now)).toBe('Pre-approved');
    expect(column.value({ ...base, scheduled_for: null } as ReportVisit, now)).toBe('Walk-in');
  });
});

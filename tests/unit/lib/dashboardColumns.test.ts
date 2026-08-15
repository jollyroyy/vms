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

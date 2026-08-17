// The four standing Reports downloads (src/lib/reportBundles.ts), pure over
// the rows already on screen — see adminDashboard.test.ts for the fixture
// pattern. Each `build` returns Record<string,string>[], the exportToCsv shape.
import { describe, it, expect } from 'vitest';
import { REPORT_BUNDLES } from '../../../src/lib/reportBundles';
import type { ReportVisit } from '../../../src/lib/reportRow';

function v(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260814-0001',
    visitor_id: 'visitor-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'checked_in',
    checked_in_at: '2026-08-14T09:00:00Z',
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: '2026-08-14T04:00:00Z',
    qr_token: 'tok',
    qr_expires_at: null,
    created_at: '2026-08-14T02:00:00Z',
    visitor: { id: 'visitor-1', phone: '9876543210', full_name: 'Ramesh Kumar', vendor_name: 'Acme', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '' },
    ...over,
  } as unknown as ReportVisit;
}

// The fixed clock every clock-dependent assertion below is measured against.
const NOW = new Date('2026-08-14T21:00:00Z');

function bundle(key: string) {
  const b = REPORT_BUNDLES.find((r) => r.key === key);
  if (!b) throw new Error(`no bundle ${key}`);
  return b;
}

// `ReportBundle.build` takes a fourth `now` argument, threaded through purely
// so the overstay boundary can be pinned here. Only this bundle reads it —
// every other figure on the Reports screen is a fact about the range, not about
// the current instant — but a builder that closes over `new Date()` makes the
// one clock-dependent number in the file untestable through the public
// interface, which is how a boundary bug survives a green suite.

describe('monthly summary', () => {
  it('splits each day’s arrivals by route in', () => {
    const visits = [
      v({ id: 'a', scheduled_for: '2026-08-14T04:00:00Z' }), // pre-approved
      v({ id: 'b', scheduled_for: null }), // walk-in
    ];
    const rows = bundle('monthly').build(visits, '2026-08-14', '2026-08-14');
    expect(rows).toEqual([{ Date: '2026-08-14', Visitors: '2', 'Pre-approved': '1', 'Walk-in': '1', 'Still inside': '2' }]);
  });

  it('carries a day with zero arrivals as a zero row, not a missing one', () => {
    const rows = bundle('monthly').build([], '2026-08-14', '2026-08-14');
    expect(rows).toEqual([{ Date: '2026-08-14', Visitors: '0', 'Pre-approved': '0', 'Walk-in': '0', 'Still inside': '0' }]);
  });
});

describe('host activity', () => {
  it('names a host who never joined rather than dropping the visitor', () => {
    const rows = bundle('hosts').build([v({ host: undefined })], '2026-08-14', '2026-08-14');
    expect(rows).toEqual([{ Host: 'Unassigned host', Department: 'Not recorded', 'Visitors received': '1', 'Still on site': '1' }]);
  });

  it('ranks hosts by total received, descending', () => {
    const visits = [
      v({ id: 'a', host_id: 'h1', host: { id: 'h1', full_name: 'Low' } }),
      v({ id: 'b', host_id: 'h2', host: { id: 'h2', full_name: 'High' } }),
      v({ id: 'c', host_id: 'h2', host: { id: 'h2', full_name: 'High' } }),
    ];
    const rows = bundle('hosts').build(visits, '2026-08-14', '2026-08-14');
    expect(rows.map((r) => r.Host)).toEqual(['High', 'Low']);
  });

  it('excludes a visit that never checked in — arrivals only', () => {
    const rows = bundle('hosts').build([v({ checked_in_at: null })], '2026-08-14', '2026-08-14');
    expect(rows).toEqual([]);
  });
});

describe('peak hours', () => {
  it('reads "Not measured" for an hour with no timed sample, never "0s"', () => {
    const rows = bundle('peak').build([v({ checkin_duration_seconds: null })], '2026-08-14', '2026-08-14');
    const hourRow = rows.find((r) => r.Hour === '14:00 IST'); // 09:00Z = 14:30 IST
    expect(hourRow?.['Avg check-in time']).toBe('Not measured');
  });

  it('appends entry-point usage as trailing rows, including an unrecorded one', () => {
    const rows = bundle('peak').build([v({ entry_point: undefined })], '2026-08-14', '2026-08-14');
    expect(rows.some((r) => r.Hour === 'Entry point — not recorded' && r.Arrivals === '1')).toBe(true);
  });
});

describe('no-show & overstay — the three closed-without-arriving outcomes stay distinct', () => {
  it('produces three DIFFERENT outcome strings for no_show, expired and lapsed', () => {
    const visits = [
      v({ id: 'a', status: 'no_show', checked_in_at: null }),
      v({ id: 'b', status: 'expired', checked_in_at: null }),
      v({ id: 'c', status: 'lapsed', checked_in_at: null, scheduled_for: null }),
    ];
    const rows = bundle('noshow').build(visits, '2026-08-14', '2026-08-14');
    const outcomes = new Set(rows.map((r) => r.Outcome));
    // Distinct strings, never merged: a missed appointment, an unused approval
    // and a request nobody ever answered are different failures with
    // different people to chase.
    expect(outcomes.size).toBe(3);
    expect([...outcomes].some((o) => o.startsWith('No-show'))).toBe(true);
    expect([...outcomes].some((o) => o.startsWith('Expired'))).toBe(true);
    expect([...outcomes].some((o) => o.startsWith('Lapsed'))).toBe(true);
  });

  // OVERSTAY_HOURS is 12 from check-in when the approver set no expected
  // departure, so 13 hours before the fixed NOW is over the line and 1 hour is
  // not. Both boundaries are asserted against an injected clock, never the
  // wall clock — a test that reads `new Date()` passes today and fails at
  // whatever hour the boundary happens to land on.
  it('includes an overstaying visitor as a fourth outcome', () => {
    const thirteenHoursAgo = new Date(NOW.getTime() - 13 * 3600_000).toISOString();
    const rows = bundle('noshow').build(
      [v({ id: 'd', status: 'checked_in', checked_in_at: thirteenHoursAgo })],
      '2026-08-14', '2026-08-14', NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].Outcome).toContain('Overstaying');
  });

  it('excludes an ordinary checked-in visitor who is not overstaying', () => {
    const anHourAgo = new Date(NOW.getTime() - 3600_000).toISOString();
    const rows = bundle('noshow').build(
      [v({ id: 'e', status: 'checked_in', checked_in_at: anHourAgo })],
      '2026-08-14', '2026-08-14', NOW,
    );
    expect(rows).toEqual([]);
  });

  it('excludes a closed-and-departed visit — it did not end badly', () => {
    const rows = bundle('noshow').build(
      [v({ id: 'f', status: 'checked_out', checked_in_at: '2026-08-14T09:00:00Z', checked_out_at: '2026-08-14T10:00:00Z' })],
      '2026-08-14', '2026-08-14',
    );
    expect(rows).toEqual([]);
  });
});

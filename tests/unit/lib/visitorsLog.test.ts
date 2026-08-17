// The Visitors Log's filtering (src/lib/visitorsLog.ts), pure over the
// register's own rows — see adminDashboard.test.ts for the fixture pattern.
import { describe, it, expect } from 'vitest';
import {
  matchesLogQuery, filterLog, statusesPresent, DEFAULT_LOG_FILTERS, type LogFilters,
} from '../../../src/lib/visitorsLog';
import { ALL_DEPTS } from '../../../src/lib/reportsDeptFilter';
import type { ReportVisit } from '../../../src/lib/reportRow';
import type { Visit } from '../../../src/types/index';

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
    status: 'approved',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: '2026-08-14T04:00:00Z',
    qr_token: 'tok',
    qr_expires_at: null,
    created_at: '2026-08-14T02:00:00Z',
    visitor: { id: 'visitor-1', phone: '+919876543210', full_name: 'Ramesh Kumar', vendor_name: 'Acme Corp', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '' },
    ...over,
  } as unknown as ReportVisit;
}

describe('matchesLogQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matchesLogQuery(v(), '')).toBe(true);
    expect(matchesLogQuery(v(), '   ')).toBe(true);
  });

  it('matches the visitor name, case-insensitively', () => {
    expect(matchesLogQuery(v(), 'ramesh')).toBe(true);
    expect(matchesLogQuery(v(), 'RAMESH')).toBe(true);
  });

  it('matches the vendor name', () => {
    expect(matchesLogQuery(v(), 'acme')).toBe(true);
  });

  it('matches the reference number', () => {
    expect(matchesLogQuery(v(), '20260814-0001')).toBe(true);
  });

  it('matches a phone number by digits only, ignoring spacing and country code', () => {
    // Stored as "+91 98765 43210", typed as "9876 543210" — the same rule
    // checkInMatches.ts uses, so the two must not disagree about a match.
    expect(matchesLogQuery(v({ visitor: { ...v().visitor, phone: '+91 98765 43210' } as Visit['visitor'] }), '9876 543210')).toBe(true);
  });

  it('does NOT match a phone fragment shorter than three digits', () => {
    // "91" is a substring of the stored number but is noise as a query — an
    // admin typing two digits did not mean to search every phone in the log.
    expect(matchesLogQuery(v(), '91')).toBe(false);
  });

  it('does not match an unrelated name', () => {
    expect(matchesLogQuery(v(), 'someone else entirely')).toBe(false);
  });
});

describe('filterLog', () => {
  it('narrows by status', () => {
    const rows = [v({ id: 'a', status: 'approved' }), v({ id: 'b', status: 'checked_in' })];
    expect(filterLog(rows, { ...DEFAULT_LOG_FILTERS, status: 'checked_in' }).map((r) => r.id)).toEqual(['b']);
  });

  it('narrows by origin', () => {
    const preApproved = v({ id: 'a', status: 'approved', scheduled_for: '2026-08-14T04:00:00Z' });
    const walkIn = v({ id: 'b', status: 'pending_approval', scheduled_for: null });
    expect(filterLog([preApproved, walkIn], { ...DEFAULT_LOG_FILTERS, origin: 'walk_in' }).map((r) => r.id)).toEqual(['b']);
  });

  it('combines status, origin and query — all three must pass', () => {
    const rows = [
      v({ id: 'a', status: 'approved', scheduled_for: '2026-08-14T04:00:00Z' }),
      v({ id: 'b', status: 'approved', scheduled_for: '2026-08-14T04:00:00Z', visitor: { ...v().visitor, full_name: 'Someone Else' } as Visit['visitor'] }),
    ];
    const filtered = filterLog(rows, { query: 'ramesh', status: 'approved', origin: 'pre_approved', department: ALL_DEPTS });
    expect(filtered.map((r) => r.id)).toEqual(['a']);
  });

  // Client instruction, 2026-08-17: the log needed Reports' department filter,
  // and it had to reach the printout and the CSV as well — which is why it lives
  // in this one pipeline rather than being applied again at the table.
  it('narrows to one department, matching on department_id and not on the joined name', () => {
    const rows = [
      v({ id: 'a', department_id: 'd1' }),
      // The department join is dropped when the row is unreadable. Filtering on a
      // label would silently lose exactly this visit.
      v({ id: 'b', department_id: 'd2', department: undefined }),
    ];
    expect(filterLog(rows, { ...DEFAULT_LOG_FILTERS, department: 'd2' }).map((r) => r.id)).toEqual(['b']);
    expect(filterLog(rows, { ...DEFAULT_LOG_FILTERS, department: 'd1' }).map((r) => r.id)).toEqual(['a']);
  });

  // An absent key means "no department filter", never "match nothing": a partial
  // filter object would otherwise blank the whole register, which reads as an
  // empty window rather than as a bug.
  it('treats a missing department key as no filter at all', () => {
    const rows = [v({ id: 'a', department_id: 'd1' })];
    const partial = { query: '', status: 'all', origin: 'all' } as LogFilters;
    expect(filterLog(rows, partial).map((r) => r.id)).toEqual(['a']);
  });
});

describe('statusesPresent', () => {
  it('lists only statuses actually in the rows, sorted, deduped', () => {
    const rows = [v({ status: 'checked_in' }), v({ status: 'approved' }), v({ status: 'checked_in' })];
    expect(statusesPresent(rows)).toEqual(['approved', 'checked_in']);
  });

  it('is empty for an empty log', () => {
    expect(statusesPresent([])).toEqual([]);
  });
});

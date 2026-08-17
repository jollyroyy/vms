import { describe, it, expect } from 'vitest';
import {
  blacklistedVisitors, blacklistedCount, deniedEntries, deniedEntriesCount,
  securityAlerts,
} from '../../../src/lib/adminSecurity';
import type { Visit, Visitor } from '../../../src/types/index';

const NOW = new Date('2026-08-17T10:00:00Z');
const TODAY = '2026-08-17T08:00:00Z';
const YESTERDAY = '2026-08-16T08:00:00Z';
const SIXTY_DAYS_AGO = '2026-06-18T08:00:00Z';

function visitor(over: Partial<Visitor> = {}): Visitor {
  return {
    id: 'p1', phone: '9876543210', full_name: 'Priya Nair', vendor_name: null,
    id_type: null, id_last4: null, vehicle_number: null,
    is_blacklisted: false, blacklist_reason: null, created_at: TODAY,
    ...over,
  };
}

function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null,
    status: 'checked_in', checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, scheduled_for: null,
    qr_token: 'tok', qr_expires_at: null, created_at: TODAY,
    visitor: visitor(),
    host: { id: 'h1', full_name: 'S. Verma' },
    ...over,
  } as Visit;
}

describe('blacklistedVisitors / blacklistedCount', () => {
  it('keeps only flagged visitors', () => {
    const visitors = [visitor({ id: 'a', is_blacklisted: true }), visitor({ id: 'b', is_blacklisted: false })];
    expect(blacklistedVisitors(visitors).map((v) => v.id)).toEqual(['a']);
    expect(blacklistedCount(visitors)).toBe(1);
  });

  it('is zero when nobody is flagged', () => {
    expect(blacklistedCount([visitor({ is_blacklisted: false })])).toBe(0);
  });
});

// `deniedEntries` no longer takes a `now` or re-filters on a date at all —
// the caller (`useAdminVisits({ kind: 'range', ... })`) has already narrowed
// `visits` to the chosen window, so these tests feed it rows from several
// different days and assert it keeps every rejected one regardless. A
// same-day-only assertion would no longer prove anything: the function does
// not look at dates any more.
describe('deniedEntries / deniedEntriesCount', () => {
  it('keeps every rejected visit it is given, whichever day it fell on', () => {
    const visits = [
      visit({ id: 'a', status: 'rejected', created_at: TODAY }),
      visit({ id: 'b', status: 'rejected', created_at: SIXTY_DAYS_AGO }),
      visit({ id: 'c', status: 'checked_in', created_at: TODAY }),
    ];
    expect(deniedEntries(visits).map((v) => v.id)).toEqual(['a', 'b']);
    expect(deniedEntriesCount(visits)).toBe(2);
  });

  it('is zero when nothing in the window was refused', () => {
    expect(deniedEntriesCount([visit({ status: 'checked_in' })])).toBe(0);
  });
});

describe('securityAlerts', () => {
  it('includes a blacklisted visitor on any visit it is given, not just today\'s', () => {
    const visits = [visit({
      id: 'a', visitor: visitor({ is_blacklisted: true, blacklist_reason: 'Theft' }), created_at: SIXTY_DAYS_AGO,
    })];
    const alerts = securityAlerts(visits, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('blacklist');
    expect(alerts[0].detail).toBe('Theft');
  });

  it('includes an overstaying visit regardless of the range the caller narrowed visits to', () => {
    // The overstay half is LIVE — it must never be date-tested inside the
    // function itself. This row's checked_in_at is well outside a typical
    // ranged window and it must still surface, because whether the caller
    // happened to include it is the caller's concern (see
    // AdminSecurity.tsx), not this function's.
    const visits = [visit({
      id: 'b', status: 'checked_in', checked_in_at: '2026-08-16T20:00:00Z',
      visitor: visitor({ is_blacklisted: false }),
    })];
    const alerts = securityAlerts(visits, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('overstay');
  });

  it('never treats a checked-in, non-overstaying visitor as a blacklist alert', () => {
    expect(securityAlerts([visit({ status: 'checked_in', checked_in_at: TODAY })], NOW)).toHaveLength(0);
  });

  it('sums both kinds, most recent first, and is empty when nothing needs attention', () => {
    const overstay = visit({
      id: 'o', status: 'checked_in', checked_in_at: '2026-08-16T20:00:00Z',
      visitor: visitor({ id: 'v-o', is_blacklisted: false }), created_at: '2026-08-16T20:00:00Z',
    });
    const blacklist = visit({
      id: 'bl', status: 'checked_in', checked_in_at: null,
      visitor: visitor({ id: 'v-bl', is_blacklisted: true }), created_at: '2026-08-17T09:30:00Z',
    });
    const alerts = securityAlerts([overstay, blacklist], NOW);
    expect(alerts.map((a) => a.kind)).toEqual(['blacklist', 'overstay']);

    expect(securityAlerts([visit({ status: 'checked_in', checked_in_at: TODAY })], NOW)).toHaveLength(0);
  });
});

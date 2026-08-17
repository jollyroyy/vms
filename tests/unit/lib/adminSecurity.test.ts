import { describe, it, expect } from 'vitest';
import {
  blacklistedVisitors, blacklistedCount, deniedEntriesToday, deniedEntriesTodayCount,
  securityAlertsToday,
} from '../../../src/lib/adminSecurity';
import type { Visit, Visitor } from '../../../src/types/index';

const NOW = new Date('2026-08-17T10:00:00Z');
const TODAY = '2026-08-17T08:00:00Z';
const YESTERDAY = '2026-08-16T08:00:00Z';

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

describe('deniedEntriesToday / deniedEntriesTodayCount', () => {
  it('keeps rejected visits created today, regardless of who refused', () => {
    const visits = [
      visit({ id: 'a', status: 'rejected', created_at: TODAY }),
      visit({ id: 'b', status: 'rejected', created_at: YESTERDAY }),
      visit({ id: 'c', status: 'checked_in', created_at: TODAY }),
    ];
    expect(deniedEntriesToday(visits, NOW).map((v) => v.id)).toEqual(['a']);
    expect(deniedEntriesTodayCount(visits, NOW)).toBe(1);
  });

  it('is zero on a day with no refusals', () => {
    expect(deniedEntriesTodayCount([visit({ status: 'checked_in' })], NOW)).toBe(0);
  });
});

describe('securityAlertsToday', () => {
  it('includes a blacklisted visitor on a visit created today', () => {
    const visits = [visit({ id: 'a', visitor: visitor({ is_blacklisted: true, blacklist_reason: 'Theft' }), created_at: TODAY })];
    const alerts = securityAlertsToday(visits, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('blacklist');
    expect(alerts[0].detail).toBe('Theft');
  });

  it('excludes a blacklisted visitor whose visit was created yesterday', () => {
    const visits = [visit({ visitor: visitor({ is_blacklisted: true }), created_at: YESTERDAY })];
    expect(securityAlertsToday(visits, NOW)).toHaveLength(0);
  });

  it('includes an overstaying visit', () => {
    const visits = [visit({
      id: 'b', status: 'checked_in', checked_in_at: '2026-08-16T20:00:00Z',
      visitor: visitor({ is_blacklisted: false }),
    })];
    const alerts = securityAlertsToday(visits, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('overstay');
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
    const alerts = securityAlertsToday([overstay, blacklist], NOW);
    expect(alerts.map((a) => a.kind)).toEqual(['blacklist', 'overstay']);

    expect(securityAlertsToday([visit({ status: 'checked_in', checked_in_at: TODAY })], NOW)).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  arrivedThisWeek, weekArrivals, distinctHostIds, hostKpis, hostDirectory, departmentSummary,
} from '../../../src/lib/adminHosts';
import type { Visit, Profile, Department } from '../../../src/types/index';

// now anchored mid-week so "last 7 IST days" has an unambiguous window.
const NOW = new Date('2026-08-17T10:00:00Z'); // Mon 15:30 IST

function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'checked_in',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 'tok', qr_expires_at: null,
    created_at: '2026-08-15T08:00:00Z',
    ...over,
  } as Visit;
}

function hod(over: Partial<Profile> = {}): Profile {
  return {
    id: 'h1', email: 'h1@x.com', full_name: 'Asha Rao', role: 'hod', department_id: 'd1',
    delegate_id: null, avatar_url: null, created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function dept(over: Partial<Department> = {}): Department {
  return { id: 'd1', name: 'HR', code: 'HR', created_at: '2026-01-01T00:00:00Z', ...over };
}

describe('arrivedThisWeek / weekArrivals', () => {
  it('is false for a visit that never checked in', () => {
    expect(arrivedThisWeek(visit({ checked_in_at: null }), NOW)).toBe(false);
  });

  it('is true for an arrival today and false for one 8 days ago', () => {
    expect(arrivedThisWeek(visit({ checked_in_at: '2026-08-17T09:00:00Z' }), NOW)).toBe(true);
    expect(arrivedThisWeek(visit({ checked_in_at: '2026-08-09T09:00:00Z' }), NOW)).toBe(false);
  });

  it('weekArrivals keeps only this week\'s arrivals out of a mixed list', () => {
    const rows = [
      visit({ id: 'a', checked_in_at: '2026-08-17T09:00:00Z' }),
      visit({ id: 'b', checked_in_at: '2026-08-09T09:00:00Z' }),
      visit({ id: 'c', checked_in_at: null }),
    ];
    expect(weekArrivals(rows, NOW).map((v) => v.id)).toEqual(['a']);
  });
});

describe('distinctHostIds', () => {
  it('unions HODs with any host_id seen on a visit, deduped', () => {
    const hods = [hod({ id: 'h1' })];
    const visits = [visit({ host_id: 'h1' }), visit({ host_id: 'h2' })];
    expect(distinctHostIds(hods, visits).sort()).toEqual(['h1', 'h2']);
  });

  it('is empty when there are no HODs and no visits', () => {
    expect(distinctHostIds([], [])).toEqual([]);
  });
});

describe('hostKpis', () => {
  it('reads "No hosts" rather than 0.0 or NaN when there are zero hosts', () => {
    const kpis = hostKpis([], [], NOW);
    expect(kpis.totalHosts).toBe(0);
    expect(kpis.visitorsThisWeek).toBe(0);
    expect(kpis.avgPerHost).toBe('No hosts');
  });

  it('divides this week\'s arrivals across every distinct host, to one decimal', () => {
    const hods = [hod({ id: 'h1' }), hod({ id: 'h2', full_name: 'Ben Roy' })];
    const visits = [
      visit({ id: 'a', host_id: 'h1', checked_in_at: '2026-08-17T09:00:00Z' }),
      visit({ id: 'b', host_id: 'h1', checked_in_at: '2026-08-16T09:00:00Z' }),
      visit({ id: 'c', host_id: 'h2', checked_in_at: '2026-08-15T09:00:00Z' }),
      // outside the 7-day window — must not inflate the count.
      visit({ id: 'd', host_id: 'h1', checked_in_at: '2026-08-01T09:00:00Z' }),
    ];
    const kpis = hostKpis(hods, visits, NOW);
    expect(kpis.totalHosts).toBe(2);
    expect(kpis.visitorsThisWeek).toBe(3);
    expect(kpis.avgPerHost).toBe('1.5');
  });
});

describe('hostDirectory', () => {
  it('ranks hosts by this week\'s visits, descending, using HOD name and department', () => {
    const hods = [hod({ id: 'h1', full_name: 'Asha Rao', department_id: 'd1' })];
    const departments = [dept({ id: 'd1', name: 'HR' })];
    const visits = [
      visit({ id: 'a', host_id: 'h1', checked_in_at: '2026-08-17T09:00:00Z' }),
      visit({ id: 'b', host_id: 'h1', checked_in_at: '2026-08-16T09:00:00Z' }),
    ];
    const rows = hostDirectory(hods, departments, visits, NOW);
    expect(rows).toEqual([
      { hostId: 'h1', name: 'Asha Rao', departmentName: 'HR', visitsThisWeek: 2 },
    ]);
  });

  it('falls back to the visit\'s own host/department join for a non-HOD host', () => {
    const visits = [
      visit({
        id: 'a', host_id: 'h9', checked_in_at: '2026-08-17T09:00:00Z',
        host: { id: 'h9', full_name: 'Staff Member' },
        department: dept({ id: 'd2', name: 'Facilities' }),
      } as Partial<Visit>),
    ];
    const rows = hostDirectory([], [], visits, NOW);
    expect(rows).toEqual([
      { hostId: 'h9', name: 'Staff Member', departmentName: 'Facilities', visitsThisWeek: 1 },
    ]);
  });

  it('includes a host with zero visits this week rather than dropping them', () => {
    const hods = [hod({ id: 'h1' })];
    const rows = hostDirectory(hods, [dept()], [], NOW);
    expect(rows).toEqual([{ hostId: 'h1', name: 'Asha Rao', departmentName: 'HR', visitsThisWeek: 0 }]);
  });

  it('is empty for no hosts and no visits', () => {
    expect(hostDirectory([], [], [], NOW)).toEqual([]);
  });
});

describe('departmentSummary', () => {
  it('groups this week\'s arrivals by department, largest first', () => {
    const visits = [
      visit({ id: 'a', checked_in_at: '2026-08-17T09:00:00Z', department: dept({ name: 'HR' }) } as Partial<Visit>),
      visit({ id: 'b', checked_in_at: '2026-08-17T09:00:00Z', department: dept({ name: 'HR' }) } as Partial<Visit>),
      visit({ id: 'c', checked_in_at: '2026-08-16T09:00:00Z', department: dept({ id: 'd2', name: 'IT' }) } as Partial<Visit>),
    ];
    expect(departmentSummary(visits, NOW)).toEqual([
      { label: 'HR', value: 2 },
      { label: 'IT', value: 1 },
    ]);
  });

  it('is empty when nobody arrived this week', () => {
    expect(departmentSummary([], NOW)).toEqual([]);
  });
});

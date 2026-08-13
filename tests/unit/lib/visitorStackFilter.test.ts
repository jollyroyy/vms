import { describe, it, expect } from 'vitest';
import {
  sortVisits, SORT_LABELS, SORT_OPTIONS,
} from '../../../src/lib/visitorStackFilter';
import type { Visit, Visitor } from '../../../src/types/index';

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-20260811-0001', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-11T04:00:00Z',
    ...overrides,
  } as Visit;
}

function visitor(overrides: Partial<Visitor> = {}): Visitor {
  return {
    id: 'p1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme Corp',
    id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false,
    blacklist_reason: null, created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('sortVisits', () => {
  const a = visit({ id: 'a', visitor: visitor({ full_name: 'Zara' }) });
  const b = visit({ id: 'b', visitor: visitor({ full_name: 'Anil' }) });
  const c = visit({ id: 'c', visitor: visitor({ full_name: 'Meera' }) });
  const input = [a, b, c];

  it('null is the identity — returns the very same array reference', () => {
    expect(sortVisits(input, null)).toBe(input);
  });

  it('null does not reorder — the segment slicer already ordered it', () => {
    expect(sortVisits(input, null).map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });

  it('"name" sorts visitor full_name A-Z', () => {
    expect(sortVisits(input, 'name').map((v) => v.id)).toEqual(['b', 'c', 'a']);
  });

  it('"name" does not mutate the input array', () => {
    const copy = [...input];
    sortVisits(input, 'name');
    expect(input).toEqual(copy);
  });

  describe('"time" sorts by scheduled_for ascending, with unscheduled rows last', () => {
    it('orders scheduled visits earliest-first', () => {
      const early = visit({ id: 'early', scheduled_for: '2026-08-11T02:00:00Z' });
      const late = visit({ id: 'late', scheduled_for: '2026-08-11T10:00:00Z' });
      expect(sortVisits([late, early], 'time').map((v) => v.id)).toEqual(['early', 'late']);
    });

    // A walk-in has no expected time; floating it to the top of a time-ordered
    // list would read as noise, not as "earliest".
    it('places a row with no scheduled_for at the end, not the start', () => {
      const scheduled = visit({ id: 'scheduled', scheduled_for: '2026-08-11T02:00:00Z' });
      const walkin = visit({ id: 'walkin', scheduled_for: null });
      expect(sortVisits([walkin, scheduled], 'time').map((v) => v.id)).toEqual(['scheduled', 'walkin']);
    });

    it('keeps multiple unscheduled rows at the end, relative order preserved by a stable sort', () => {
      const scheduled = visit({ id: 'scheduled', scheduled_for: '2026-08-11T02:00:00Z' });
      const walkin1 = visit({ id: 'walkin1', scheduled_for: null });
      const walkin2 = visit({ id: 'walkin2', scheduled_for: null });
      const result = sortVisits([walkin1, walkin2, scheduled], 'time').map((v) => v.id);
      expect(result[0]).toBe('scheduled');
      expect(result.slice(1)).toEqual(['walkin1', 'walkin2']);
    });

    it('does not mutate the input array', () => {
      const early = visit({ id: 'early', scheduled_for: '2026-08-11T02:00:00Z' });
      const late = visit({ id: 'late', scheduled_for: '2026-08-11T10:00:00Z' });
      const arr = [late, early];
      const copy = [...arr];
      sortVisits(arr, 'time');
      expect(arr).toEqual(copy);
    });
  });
});

describe('SORT_OPTIONS / SORT_LABELS — every sort has a label', () => {
  it('every option in SORT_OPTIONS has a corresponding label', () => {
    SORT_OPTIONS.forEach((opt) => {
      expect(SORT_LABELS[opt]).toBeTruthy();
    });
  });

  it('SORT_OPTIONS is exactly name, time', () => {
    expect(SORT_OPTIONS).toEqual(['name', 'time']);
  });

  // Client instruction, 2026-08-13. It was never a sort: the segment slicer
  // already returns rows newest-activity-first, so the option restated the
  // order the guard was already looking at. That order is still the default —
  // it just stopped being one of the choices.
  it('offers no "Latest activity" option', () => {
    expect(Object.values(SORT_LABELS)).not.toContain('Latest activity');
    expect(SORT_OPTIONS).not.toContain('recent' as never);
  });
});

import { describe, it, expect } from 'vitest';
import {
  matchesQuery, sortVisits, SORT_LABELS, SORT_OPTIONS,
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

describe('matchesQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matchesQuery(visit({ visitor: visitor() }), '')).toBe(true);
  });

  it('matches everything on a whitespace-only query', () => {
    expect(matchesQuery(visit({ visitor: visitor() }), '   ')).toBe(true);
  });

  describe('digits-only query matches phone digits-only', () => {
    const v = visit({ visitor: visitor({ phone: '9876543210' }) });

    it('matches a bare digit string', () => {
      expect(matchesQuery(v, '9876543210')).toBe(true);
    });

    it('matches the same number typed with a space', () => {
      expect(matchesQuery(v, '98765 43210')).toBe(true);
    });

    // SOURCE BUG (reported, not fixed here): the doc comment on matchesQuery
    // claims "+919876543210" finds the same visitor as the bare 10-digit
    // number, but the code checks `digits(phone).includes(qDigits)` — phone is
    // stored normalized to 10 digits (see lib/blacklist.ts normalizePhone), so
    // a query carrying the +91 prefix produces a 12-digit qDigits that can
    // never be a substring of a 10-digit haystack. This assertion documents
    // the actual (broken) behavior; see the report for the intended fix.
    it('does NOT match a +91-prefixed query against a normalized 10-digit phone (documents a source bug)', () => {
      expect(matchesQuery(v, '+919876543210')).toBe(false);
    });

    it('matches a partial phone number of at least 3 digits', () => {
      expect(matchesQuery(v, '98765')).toBe(true);
    });

    // Guarded so a single stray digit does not match every phone in the list.
    it('does NOT match on fewer than 3 digits', () => {
      expect(matchesQuery(v, '98')).toBe(false);
      expect(matchesQuery(v, '9')).toBe(false);
    });

    it('does not match an unrelated phone number', () => {
      expect(matchesQuery(v, '1112223334')).toBe(false);
    });
  });

  describe('text query matches across fields, case-insensitively', () => {
    const v = visit({
      visitor: visitor({ full_name: 'Asha Rao', vendor_name: 'Acme Corp' }),
      ref_number: 'VIS-20260811-0007',
      host: { id: 'h1', full_name: 'Rahul Sen' },
      department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
      purpose: 'vendor',
    });

    it('matches the visitor name', () => {
      expect(matchesQuery(v, 'asha')).toBe(true);
      expect(matchesQuery(v, 'ASHA')).toBe(true);
    });

    it('matches the vendor name', () => {
      expect(matchesQuery(v, 'acme')).toBe(true);
    });

    it('matches the reference number', () => {
      expect(matchesQuery(v, 'vis-20260811-0007')).toBe(true);
    });

    it('matches the host name', () => {
      expect(matchesQuery(v, 'rahul')).toBe(true);
    });

    it('matches the department name', () => {
      expect(matchesQuery(v, 'engineering')).toBe(true);
    });

    it('matches the purpose', () => {
      expect(matchesQuery(v, 'vendor')).toBe(true);
    });

    it('does not match unrelated text', () => {
      expect(matchesQuery(v, 'zzz-not-present')).toBe(false);
    });
  });

  it('tolerates missing joined fields without throwing', () => {
    const bare = visit({ visitor: undefined, host: undefined, department: undefined });
    expect(() => matchesQuery(bare, 'anything')).not.toThrow();
    expect(matchesQuery(bare, 'anything')).toBe(false);
  });
});

describe('sortVisits', () => {
  const a = visit({ id: 'a', visitor: visitor({ full_name: 'Zara' }) });
  const b = visit({ id: 'b', visitor: visitor({ full_name: 'Anil' }) });
  const c = visit({ id: 'c', visitor: visitor({ full_name: 'Meera' }) });
  const input = [a, b, c];

  it('"recent" is the identity — returns the very same array reference', () => {
    expect(sortVisits(input, 'recent')).toBe(input);
  });

  it('"recent" does not reorder — the segment slicer already ordered it', () => {
    expect(sortVisits(input, 'recent').map((v) => v.id)).toEqual(['a', 'b', 'c']);
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

  it('SORT_OPTIONS is exactly recent, name, time', () => {
    expect(SORT_OPTIONS).toEqual(['recent', 'name', 'time']);
  });
});

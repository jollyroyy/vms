import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable builder mock, keyed by table, following the pattern in
// tests/unit/lib/activeVisit.test.ts. `visits` supports .ilike (ref search),
// .in (visitor-id search) and .gte().ilike() (the visitor-card search, which
// has a file of its own — searchVisitsCard.test.ts); `visitors`
// supports .ilike (name/phone search). Each terminal call resolves through its
// own vi.fn so a test can script per-column responses.
const mockVisitsIlike = vi.hoisted(() => vi.fn());
const mockCardIlike = vi.hoisted(() => vi.fn());
const mockVisitsIn = vi.hoisted(() => vi.fn());
const mockVisitorsIlike = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => ({
  visitsIlike: [] as [string, string][],
  cardIlike: [] as [string, string][],
  visitsGte: [] as [string, string][],
  visitsIn: [] as [string, string[]][],
  visitorsIlike: [] as [string, string][],
}));

vi.mock('../../../src/supabaseClient', () => {
  // `.gte(...)` returns a DIFFERENT builder, so a card lookup's terminal
  // `.ilike` cannot be mistaken for the ref lookup's — the two hit the same
  // table and the same method name, and one shared spy would make the tests
  // unable to tell which leg ran.
  const cardBuilder: any = {};
  cardBuilder.ilike = (col: string, pattern: string) => {
    calls.cardIlike.push([col, pattern]);
    return mockCardIlike(col, pattern);
  };

  const visitsBuilder: any = {};
  visitsBuilder.select = () => visitsBuilder;
  visitsBuilder.gte = (col: string, value: string) => {
    calls.visitsGte.push([col, value]);
    return cardBuilder;
  };
  visitsBuilder.ilike = (col: string, pattern: string) => {
    calls.visitsIlike.push([col, pattern]);
    return mockVisitsIlike(col, pattern);
  };
  visitsBuilder.in = (col: string, ids: string[]) => {
    calls.visitsIn.push([col, ids]);
    return mockVisitsIn(col, ids);
  };

  const visitorsBuilder: any = {};
  visitorsBuilder.select = () => visitorsBuilder;
  visitorsBuilder.ilike = (col: string, pattern: string) => {
    calls.visitorsIlike.push([col, pattern]);
    return mockVisitorsIlike(col, pattern);
  };

  return {
    supabase: {
      from: (table: string) => (table === 'visits' ? visitsBuilder : visitorsBuilder),
      // attachHostNames short-circuits when no row carries a host_id, which
      // every fixture below deliberately omits — so rpc is never reached,
      // but stub it so an accidental call fails loudly instead of hanging.
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  };
});

import { searchAllVisits, VISIT_SEARCH_LIMIT } from '../../../src/lib/searchVisits';

function makeVisit(overrides: Record<string, unknown>) {
  return {
    id: 'visit-default',
    ref_number: 'VIS-20260801-0001',
    visitor_id: 'visitor-1',
    department_id: 'dept-1',
    status: 'approved',
    created_at: '2026-08-01T00:00:00Z',
    visitor: { full_name: 'Someone', phone: '9876543210' },
    ...overrides,
  };
}

beforeEach(() => {
  calls.visitsIlike = [];
  calls.cardIlike = [];
  calls.visitsGte = [];
  calls.visitsIn = [];
  calls.visitorsIlike = [];
  mockVisitsIlike.mockReset().mockResolvedValue({ data: [], error: null });
  mockCardIlike.mockReset().mockResolvedValue({ data: [], error: null });
  mockVisitsIn.mockReset().mockResolvedValue({ data: [], error: null });
  mockVisitorsIlike.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('searchAllVisits — short query', () => {
  it('returns [] for a query under 2 characters and issues no query at all', async () => {
    const result = await searchAllVisits('a');
    expect(result).toEqual([]);
    expect(mockVisitsIlike).not.toHaveBeenCalled();
    expect(mockCardIlike).not.toHaveBeenCalled();
    expect(mockVisitorsIlike).not.toHaveBeenCalled();
    expect(mockVisitsIn).not.toHaveBeenCalled();
  });

  it('treats an empty/whitespace query the same way', async () => {
    expect(await searchAllVisits('   ')).toEqual([]);
  });
});

describe('searchAllVisits — matching', () => {
  it('finds a visit by a ref-number substring', async () => {
    const visit = makeVisit({ id: 'v-ref', ref_number: 'VIS-20260804-0023' });
    mockVisitsIlike.mockResolvedValue({ data: [visit], error: null });

    const result = await searchAllVisits('20260804');
    expect(result.map((v) => v.id)).toContain('v-ref');
  });

  it('finds a visit by a visitor name substring', async () => {
    mockVisitorsIlike.mockImplementation((col: string) =>
      col === 'full_name'
        ? Promise.resolve({ data: [{ id: 'visitor-9' }], error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    const visit = makeVisit({ id: 'v-name', visitor_id: 'visitor-9' });
    mockVisitsIn.mockResolvedValue({ data: [visit], error: null });

    const result = await searchAllVisits('Priya');
    expect(result.map((v) => v.id)).toContain('v-name');
    expect(calls.visitsIn[0][1]).toEqual(['visitor-9']);
  });

  it('finds a visit by a phone-number substring (query with 4+ digits)', async () => {
    mockVisitorsIlike.mockImplementation((col: string) =>
      col === 'phone'
        ? Promise.resolve({ data: [{ id: 'visitor-7' }], error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    const visit = makeVisit({ id: 'v-phone', visitor_id: 'visitor-7' });
    mockVisitsIn.mockResolvedValue({ data: [visit], error: null });

    const result = await searchAllVisits('98765');
    expect(result.map((v) => v.id)).toContain('v-phone');
  });

  // THE PHONE LEG ONLY FIRES ON SOMETHING PHONE-SHAPED (client report,
  // 2026-08-18: searching a card number returned yesterday's visitor instead of
  // today's). It used to fire on any query carrying two or more digits, which
  // is a SUBSTRING match against every visitor's mobile — so a card number was
  // reduced to its digits and matched a stranger whose number happened to
  // contain them. Two conditions, both about what was typed: no letters, and at
  // least four digits.
  it('does not run a phone lookup when the query has fewer than 4 digits', async () => {
    await searchAllVisits('123');
    expect(calls.visitorsIlike.some(([col]) => col === 'phone')).toBe(false);
  });

  // The live case that reported this: "C-V12" is a card number. Reduced to
  // "12" it matched Biswajit's 9078612345 — a visitor who had checked in the
  // previous day — and put him at the top of a card search for a card he had
  // never held.
  it('does not run a phone lookup for a card number that contains digits', async () => {
    await searchAllVisits('C-V12');
    expect(calls.visitorsIlike.some(([col]) => col === 'phone')).toBe(false);
  });

  it('does not run a phone lookup for a ref number', async () => {
    await searchAllVisits('VIS-20260818-0001');
    expect(calls.visitorsIlike.some(([col]) => col === 'phone')).toBe(false);
  });

  // Separators are still welcome — what disqualifies a query is letters, not
  // punctuation, so the number as it is written on a form still searches.
  it('runs the phone lookup on a formatted number, stripped to its digits', async () => {
    await searchAllVisits('+91 90786 12345');
    const phoneCall = calls.visitorsIlike.find(([col]) => col === 'phone');
    expect(phoneCall?.[1]).toBe('%919078612345%');
  });

  it('dedupes a visit matched by BOTH ref and name — appears exactly once', async () => {
    const visit = makeVisit({ id: 'v-both', ref_number: 'VIS-20260805-0099', visitor_id: 'visitor-5' });
    mockVisitsIlike.mockResolvedValue({ data: [visit], error: null });
    mockVisitorsIlike.mockImplementation((col: string) =>
      col === 'full_name'
        ? Promise.resolve({ data: [{ id: 'visitor-5' }], error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    mockVisitsIn.mockResolvedValue({ data: [visit], error: null });

    const result = await searchAllVisits('Nair');
    expect(result.filter((v) => v.id === 'v-both')).toHaveLength(1);
  });

  it('returns results ordered most-recent-first', async () => {
    const older = makeVisit({ id: 'v-old', created_at: '2026-08-01T00:00:00Z' });
    const newer = makeVisit({ id: 'v-new', created_at: '2026-08-10T00:00:00Z' });
    mockVisitsIlike.mockResolvedValue({ data: [older, newer], error: null });

    const result = await searchAllVisits('VIS');
    expect(result.map((v) => v.id)).toEqual(['v-new', 'v-old']);
  });

  it.each(['checked_out', 'rejected'])(
    'returns a CLOSED visit with status %s — the whole point of the change',
    async (status) => {
      const visit = makeVisit({ id: `v-${status}`, status });
      mockVisitsIlike.mockResolvedValue({ data: [visit], error: null });

      const result = await searchAllVisits('VIS');
      expect(result.some((v) => v.id === `v-${status}` && v.status === status)).toBe(true);
    },
  );

  it('honours a custom limit', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeVisit({ id: `v-${i}`, created_at: `2026-08-0${i + 1}T00:00:00Z` }),
    );
    mockVisitsIlike.mockResolvedValue({ data: rows, error: null });

    const result = await searchAllVisits('VIS', 2);
    expect(result).toHaveLength(2);
  });

  it('defaults to VISIT_SEARCH_LIMIT when no limit is given', async () => {
    const rows = Array.from({ length: VISIT_SEARCH_LIMIT + 10 }, (_, i) =>
      makeVisit({ id: `v-${i}`, created_at: `2026-08-01T00:00:${String(i).padStart(2, '0')}Z` }),
    );
    mockVisitsIlike.mockResolvedValue({ data: rows, error: null });

    const result = await searchAllVisits('VIS');
    expect(result).toHaveLength(VISIT_SEARCH_LIMIT);
  });
});

describe('searchAllVisits — resilience', () => {
  it('returns [] rather than throwing when the ref lookup errors', async () => {
    mockVisitsIlike.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchAllVisits('VIS');
    expect(result).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still returns matches from other legs when one leg errors', async () => {
    mockVisitsIlike.mockResolvedValue({ data: null, error: { message: 'boom' } });
    mockVisitorsIlike.mockImplementation((col: string) =>
      col === 'full_name'
        ? Promise.resolve({ data: [{ id: 'visitor-3' }], error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    const visit = makeVisit({ id: 'v-survives', visitor_id: 'visitor-3' });
    mockVisitsIn.mockResolvedValue({ data: [visit], error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchAllVisits('Nair');
    expect(result.map((v) => v.id)).toContain('v-survives');
  });
});

describe('searchAllVisits — ILIKE wildcard escaping', () => {
  it('escapes a literal % so it does not become a match-everything wildcard', async () => {
    await searchAllVisits('50%off');
    const [, pattern] = calls.visitsIlike[0];
    expect(pattern).toBe('%50\\%off%');
  });

  it('escapes a literal _ the same way', async () => {
    await searchAllVisits('a_b');
    const [, pattern] = calls.visitsIlike[0];
    expect(pattern).toBe('%a\\_b%');
  });
});

// The visitor-card leg has its own file — `searchVisitsCard.test.ts`. It is a
// different question ("who is carrying this number today?"), it is the only leg
// with a date window and an order of its own, and keeping it here put this file
// over the 300-line cap.

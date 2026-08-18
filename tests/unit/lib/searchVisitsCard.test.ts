import { describe, it, expect, vi, beforeEach } from 'vitest';

// THE PHYSICAL VISITOR CARD — the one leg of `searchAllVisits` with a window
// and an order of its own, which is why it has a file of its own. The other
// legs are in `searchVisits.test.ts`.
//
// A card number is the one identifier a visitor is holding in their hand, so it
// is the fastest thing a guard can ask for at the gate (client instruction,
// 2026-08-17).
//
// TODAY ONLY, LATEST FIRST (client instruction, 2026-08-18). The scope used to
// be `status = 'checked_in'` — the single live holder — which answered half the
// question: a card handed back at 11am and reissued at noon has had two holders
// today, and the guard needs the current one on top with the earlier one
// visible under it. What is genuinely NOT meant is last week's holder, because
// the card is reissued daily and those rows are strangers wearing the same
// label.
//
// The chain under test is `.select().gte('checked_in_at', …).ilike(…)`. `.gte`
// returns a DIFFERENT builder from the mock below, so this leg's terminal
// `.ilike` can never be mistaken for the ref lookup's — the two hit the same
// table and the same method name, and one shared spy could not tell them apart.
const mockVisitsIlike = vi.hoisted(() => vi.fn());
const mockCardIlike = vi.hoisted(() => vi.fn());
const mockVisitsIn = vi.hoisted(() => vi.fn());
const mockVisitorsIlike = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => ({
  visitsIlike: [] as [string, string][],
  cardIlike: [] as [string, string][],
  visitsGte: [] as [string, string][],
}));

vi.mock('../../../src/supabaseClient', () => {
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
  visitsBuilder.in = (col: string, ids: string[]) => mockVisitsIn(col, ids);

  const visitorsBuilder: any = {};
  visitorsBuilder.select = () => visitorsBuilder;
  visitorsBuilder.ilike = (col: string, pattern: string) => mockVisitorsIlike(col, pattern);

  return {
    supabase: {
      from: (table: string) => (table === 'visits' ? visitsBuilder : visitorsBuilder),
      // Every fixture omits host_id, so attachHostNames short-circuits and this
      // is never reached — stubbed so an accidental call fails loudly.
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  };
});

import { searchAllVisits } from '../../../src/lib/searchVisits';
import { istDayStart } from '../../../src/lib/visitExpiry';

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
  mockVisitsIlike.mockReset().mockResolvedValue({ data: [], error: null });
  mockCardIlike.mockReset().mockResolvedValue({ data: [], error: null });
  mockVisitsIn.mockReset().mockResolvedValue({ data: [], error: null });
  mockVisitorsIlike.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('searchAllVisits — by visitor card number', () => {
  it("bounds the card lookup on TODAY's arrivals, not on the checked-in status", async () => {
    await searchAllVisits('C-104');
    const gte = calls.visitsGte.find(([col]) => col === 'checked_in_at');
    expect(gte).toBeDefined();
    expect(new Date(gte![1]).getTime()).toBe(istDayStart().getTime());
    // The status test is gone: it dropped a visitor the instant they walked
    // out, which is exactly the row that explains where the card went.
    expect(calls.visitsGte.some(([col]) => col === 'status')).toBe(false);
    expect(calls.cardIlike).toEqual([['visitor_card_number', 'C-104']]);
  });

  // EXACT, not a substring. The guard is quoting an identifier here, not
  // groping for a person: `%10%` would return C-104, C-1042 and B-210 at once.
  it('does not wrap the card number in wildcards', async () => {
    await searchAllVisits('104');
    expect(calls.cardIlike[0]?.[1]).toBe('104');
    expect(calls.cardIlike[0]?.[1]).not.toContain('%');
  });

  // The number is read off a printed card and typed by hand, so ILIKE (not eq)
  // is what makes `c-104` find `C-104`. Migration 097 indexes
  // upper(visitor_card_number) for checked_in rows to match.
  it('returns the visit holding that card', async () => {
    mockCardIlike.mockResolvedValue({
      data: [makeVisit({ id: 'inside-1', status: 'checked_in', visitor_card_number: 'C-104' })],
      error: null,
    });
    const result = await searchAllVisits('c-104');
    expect(result.map((v) => v.id)).toEqual(['inside-1']);
  });

  // THE LATEST HOLDER IS ON TOP, ordered by the instant the card was ISSUED and
  // not by when the visit row was created — a pre-approval raised last week and
  // used this morning is the row the guard is holding in their hand, and a
  // created_at sort would bury it under a walk-in registered an hour ago.
  it("orders one card's holders newest arrival first, whatever their created_at", async () => {
    mockCardIlike.mockResolvedValue({
      data: [
        makeVisit({
          id: 'morning', status: 'checked_out', visitor_card_number: 'C-104',
          created_at: '2026-08-18T02:00:00Z', checked_in_at: '2026-08-18T03:30:00Z',
        }),
        makeVisit({
          id: 'now', status: 'checked_in', visitor_card_number: 'C-104',
          created_at: '2026-08-11T02:00:00Z', checked_in_at: '2026-08-18T07:45:00Z',
        }),
      ],
      error: null,
    });
    const result = await searchAllVisits('C-104');
    expect(result.map((v) => v.id)).toEqual(['now', 'morning']);
  });

  // The card rows ARE the answer to a card search; a name or ref hit for the
  // same string is context underneath it, however recent.
  it('keeps card hits above every other leg', async () => {
    mockCardIlike.mockResolvedValue({
      data: [makeVisit({
        id: 'card-hit', status: 'checked_in', visitor_card_number: 'C-104',
        created_at: '2026-07-01T00:00:00Z', checked_in_at: '2026-08-18T07:45:00Z',
      })],
      error: null,
    });
    mockVisitsIlike.mockResolvedValue({
      data: [makeVisit({ id: 'ref-hit', created_at: '2026-08-18T09:00:00Z' })],
      error: null,
    });
    const result = await searchAllVisits('C-104');
    expect(result.map((v) => v.id)).toEqual(['card-hit', 'ref-hit']);
  });

  // Not mutually exclusive with the other legs, and not meant to be: deciding
  // whether "C-104" is a card or a name would be a classifier that is wrong at
  // the gate, and merging costs one round trip instead.
  it('dedupes a visit matched by BOTH the card and the ref', async () => {
    const row = makeVisit({ id: 'same-visit', status: 'checked_in', visitor_card_number: 'C-104' });
    mockCardIlike.mockResolvedValue({ data: [row], error: null });
    mockVisitsIlike.mockResolvedValue({ data: [row], error: null });

    const result = await searchAllVisits('C-104');
    expect(result.filter((v) => v.id === 'same-visit')).toHaveLength(1);
  });

  it('still answers from the other legs when the card lookup errors', async () => {
    mockCardIlike.mockResolvedValue({ data: null, error: { message: 'boom' } });
    mockVisitsIlike.mockResolvedValue({ data: [makeVisit({ id: 'by-ref' })], error: null });

    const result = await searchAllVisits('C-104');
    expect(result.map((v) => v.id)).toEqual(['by-ref']);
  });
});

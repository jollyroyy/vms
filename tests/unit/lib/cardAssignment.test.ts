// ONE PHYSICAL CARD, ONE HOLDER (client instruction, 2026-08-18: "the same card
// number cannot be assigned twice until and unless it gets returned — and that
// only for today. And at the end of the day, tally whatever cards did not
// return, flag those … dashboard KPI").
//
// Both halves of that instruction come out of src/lib/cardAssignment.ts on
// purpose — "which numbers are blocked" and "which cards are missing" are the
// same fact read from two ends, and two modules answering it is how they start
// disagreeing. This file pins both against the same fixtures.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rows: any[] = [];
vi.mock('../../../src/supabaseClient', () => {
  const builder: any = {};
  builder.select = () => builder;
  builder.is = () => builder;
  builder.ilike = () => builder;
  builder.limit = () => Promise.resolve({ data: rows, error: null });
  return { supabase: { from: () => builder } };
});

import {
  isCardOutstanding, normalizeCard, findCardHolder, cardInUseMessage, isCardTakenError,
} from '../../../src/lib/cardAssignment';
import type { ReportVisit } from '../../../src/lib/reportRow';

function v(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    status: 'checked_out',
    created_at: '2026-08-18T02:00:00Z',
    checked_in_at: '2026-08-18T04:00:00Z',
    checked_out_at: '2026-08-18T11:00:00Z',
    visitor_card_number: 'C-124',
    visitor_card_returned_at: null,
    ...over,
  } as unknown as ReportVisit;
}

describe('normalizeCard', () => {
  // The number is read off a printed card and typed by hand. A rule a shift key
  // defeats is not a rule — and it is the same upper() migration 102 indexes on.
  it('upper-cases and trims, so c-124 IS C-124', () => {
    expect(normalizeCard('  c-124 ')).toBe('C-124');
  });
});

describe('isCardOutstanding — the end-of-day tally', () => {
  it('flags a card whose visit closed with no return stamped', () => {
    expect(isCardOutstanding(v())).toBe(true);
  });

  // The distinction the whole tile rests on: a card with a visitor who is
  // inside is IN USE, not missing. Counting them would make the tile read as a
  // fault every single afternoon, which is how a number stops being believed.
  it('does not flag a card still with a visitor who is inside', () => {
    expect(isCardOutstanding(v({ status: 'checked_in', checked_out_at: null }))).toBe(false);
  });

  it('does not flag a card that came back', () => {
    expect(isCardOutstanding(v({ visitor_card_returned_at: '2026-08-18T11:00:00Z' }))).toBe(false);
  });

  // A visit that never issued one has nothing outstanding. Migration 083's
  // shortcut left real rows in exactly this shape.
  it('does not flag a visit with no card at all', () => {
    expect(isCardOutstanding(v({ visitor_card_number: null }))).toBe(false);
  });
});

describe('findCardHolder — can this number be issued?', () => {
  const NOW = new Date('2026-08-18T12:00:00Z'); // 17:30 IST

  beforeEach(() => { rows.length = 0; });

  it('is free when nothing holds the number', async () => {
    expect(await findCardHolder('C-124', { now: NOW })).toBeNull();
  });

  // Any day, no date bound: a contractor who arrived at 21:00 last night is
  // still carrying the card this morning.
  it('is blocked while its holder is inside, even from an earlier day', async () => {
    rows.push({
      id: 'v9', status: 'checked_in', checked_in_at: '2026-08-17T16:00:00Z',
      visitor_card_number: 'C-124', visitor: { full_name: 'Priya Nair' },
    });
    const holder = await findCardHolder('C-124', { now: NOW });
    expect(holder?.visitorName).toBe('Priya Nair');
    expect(holder?.stillInside).toBe(true);
  });

  // "Only for today" — a card is reissued daily, and without this bound one
  // lost card would wedge its number out of the stack for good, with no screen
  // in this app able to release it.
  it('is blocked when issued earlier TODAY and never returned', async () => {
    rows.push({
      id: 'v9', status: 'checked_out', checked_in_at: '2026-08-18T05:00:00Z',
      visitor_card_number: 'C-124', visitor: { full_name: 'Amit Roy' },
    });
    expect(await findCardHolder('C-124', { now: NOW })).not.toBeNull();
  });

  it('is free again the day after a closed visit failed to return it', async () => {
    rows.push({
      id: 'v9', status: 'checked_out', checked_in_at: '2026-08-16T05:00:00Z',
      visitor_card_number: 'C-124', visitor: { full_name: 'Amit Roy' },
    });
    expect(await findCardHolder('C-124', { now: NOW })).toBeNull();
  });

  // A re-submit of the same visit must never be refused by its own write.
  it('ignores the visit being checked in itself', async () => {
    rows.push({
      id: 'v9', status: 'checked_in', checked_in_at: '2026-08-18T05:00:00Z',
      visitor_card_number: 'C-124', visitor: { full_name: 'Priya Nair' },
    });
    expect(await findCardHolder('C-124', { excludeVisitId: 'v9', now: NOW })).toBeNull();
  });

  // The allowlist gate also guarantees no `%` or `_` reaches the ilike.
  it('never queries a malformed number', async () => {
    expect(await findCardHolder('C 124%', { now: NOW })).toBeNull();
  });
});

describe('what the guard reads', () => {
  it('names the holder rather than stating a constraint', () => {
    const msg = cardInUseMessage({
      visitId: 'v9', visitorName: 'Priya Nair', cardNumber: 'C-124',
      checkedInAt: '2026-08-18T05:00:00Z', stillInside: true,
    });
    expect(msg).toContain('Priya Nair');
    expect(msg).toContain('C-124');
  });
});

describe('isCardTakenError', () => {
  // Matched BY CONSTRAINT NAME, so an unrelated unique violation still surfaces
  // its own error instead of being mislabelled — the same rule activeVisit.ts
  // follows for the one-open-visit index.
  it('recognises migration 102s two indexes', () => {
    expect(isCardTakenError({ code: '23505', message: 'visits_card_live_holder_uidx' })).toBe(true);
    expect(isCardTakenError({ code: '23505', message: 'visits_card_unreturned_today_uidx' })).toBe(true);
  });

  it('does not claim an unrelated unique violation', () => {
    expect(isCardTakenError({ code: '23505', message: 'visits_one_open_per_visitor' })).toBe(false);
    expect(isCardTakenError({ code: '23502', message: 'visits_card_live_holder_uidx' })).toBe(false);
  });
});

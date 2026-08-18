// Universal visit search for the guard check-in desk.
//
// CheckInPanel.loadData only ever fetched `status in ('approved',
// 'walkin_approved')` — the open, actionable statuses. That is the right
// scope for the arrivals board, but it quietly became the ONLY way to look a
// visit up: once a pass was used (checked_out), lapsed (no_show / expired) or
// declined (rejected / cancelled), it vanished from search entirely. A guard
// re-typing a ref number off yesterday's printed pass, or a host asking "did
// so-and-so ever show up?", got "No match found" for a visit that plainly
// existed.
//
// SEARCHING answers "does this exist?" — every status, no filtering.
// ACTING (checking someone in) answers "can I do something about it right
// now?" and stays governed by CheckInPanel / checkInMatches.ts, which is
// deliberately scoped to what is due today. This module only ever answers
// the first question; callers decide what a closed result is allowed to do.
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { attachHostNames } from './hostNames';
import { istDayStart } from './visitExpiry';

export const VISIT_SEARCH_LIMIT = 50;

const VISIT_SELECT = '*, visitor:visitors(*), department:departments(id, name, code, created_at)';

/**
 * ILIKE treats `%` and `_` as wildcards, so a guard typing a literal percent
 * sign (or an underscore, common in vendor names) would otherwise turn their
 * own search into a match-everything pattern. Escape both before wrapping in
 * `%...%`.
 */
function escapeIlike(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * IS THE GUARD QUOTING A PHONE NUMBER? (client report, 2026-08-18: searching a
 * card number returned yesterday's visitor instead of today's.)
 *
 * The phone leg used to fire on ANY query carrying two or more digits, which
 * is a substring match on `visitors.phone`. So "C-V12" — a card number, with
 * letters in it — was reduced to "12" and matched every visitor whose ten-digit
 * mobile happens to contain those two digits anywhere; a card that had never
 * been issued therefore returned a stranger who checked in the day before, and
 * a guard reading the top of that list had no way to tell it was a phone hit.
 *
 * Two conditions, and both are about what the guard TYPED rather than what it
 * might match:
 *   * NO LETTERS. A phone number does not contain any. A card number
 *     ("C-350", "CV-895") and a ref ("VIS-20260818-0001") do, and each has its
 *     own leg that matches it properly — exactly, in the card's case.
 *   * FOUR DIGITS OR MORE. Below that it is not an identifier, it is a filter:
 *     "12" narrows a directory to roughly a third of itself and calls the
 *     result a match. Four is the "last four digits" a person actually quotes.
 *
 * Separators stay welcome — "+91 90786 12345", "9078-612345" and "612345" are
 * all phone-shaped and all still search.
 */
function isPhoneShaped(query: string, digits: string): boolean {
  return digits.length >= 4 && !/[A-Za-z]/.test(query);
}

async function fetchVisitsByRef(pattern: string): Promise<Visit[]> {
  const { data, error } = await supabase.from('visits').select(VISIT_SELECT).ilike('ref_number', pattern);
  if (error) {
    console.error('[searchVisits] ref_number lookup failed', error);
    return [];
  }
  return (data as unknown as Visit[]) ?? [];
}

/**
 * THE PHYSICAL CARD THE VISITOR IS HOLDING (client instruction, 2026-08-17).
 *
 * A card number is the one identifier a visitor carries in their hand. Asking
 * them for a ref number instead asks for something they were never given, and
 * asking for a name gets you three Sharmas.
 *
 * TODAY ONLY, AND TODAY IS AN IST DAY (client instruction, 2026-08-18). The
 * scope was `status = 'checked_in'` — the one live holder — and that answered
 * only half the question the guard is actually asking. A card comes back at
 * the gate and is handed straight to the next visitor, so within one shift the
 * same number can have been carried by three people; the guard holding C-104
 * needs the person who has it NOW, but also needs to see that it was returned
 * an hour ago by somebody else, or the number reads as never issued. What is
 * genuinely not meant by "who has C-104" is last week's holder: the card is
 * reissued daily, so historical rows are three strangers wearing the same
 * label. So the window is the IST day, keyed on `checked_in_at` — the instant
 * the card was ISSUED — which is the same bound `guardTiles` and
 * `useGateActivity` use for today's departures, and unlike a status test it
 * cannot silently drop a visitor the moment they walk out.
 *
 * ORDER IS LATEST FIRST, by that same issue instant, and `searchAllVisits`
 * keeps these rows at the top of the merged list: the current holder is the
 * answer to the question, and the earlier ones are the trail behind it.
 *
 * EXACT and CASE-INSENSITIVE, not a substring: the number is read off a printed
 * card, so `c-104` must find `C-104`; but `10` must NOT find `C-104`, `C-1042`
 * and `B-210` at once. This is the one leg of the search where the guard is
 * quoting an identifier rather than groping for a person. Indexed on
 * `upper(visitor_card_number)` for `checked_in` rows by migration 097.
 */
async function fetchVisitsByCard(raw: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .gte('checked_in_at', istDayStart().toISOString())
    .ilike('visitor_card_number', escapeIlike(raw));
  if (error) {
    console.error('[searchVisits] visitor_card_number lookup failed', error);
    return [];
  }
  return (data as unknown as Visit[]) ?? [];
}

/** Newest issue first. A row with no arrival stamp cannot be in this list —
 *  the fetch is bounded on it — but the fallback keeps the comparator total. */
function byCardIssueDesc(a: Visit, b: Visit): number {
  const at = new Date(a.checked_in_at ?? a.created_at).getTime();
  const bt = new Date(b.checked_in_at ?? b.created_at).getTime();
  return bt - at;
}

async function fetchVisitorIds(column: 'full_name' | 'phone', pattern: string): Promise<string[]> {
  const { data, error } = await supabase.from('visitors').select('id').ilike(column, pattern);
  if (error) {
    console.error(`[searchVisits] visitors.${column} lookup failed`, error);
    return [];
  }
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

async function fetchVisitsByVisitorIds(ids: string[]): Promise<Visit[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('visits').select(VISIT_SELECT).in('visitor_id', ids);
  if (error) {
    console.error('[searchVisits] visits-by-visitor lookup failed', error);
    return [];
  }
  return (data as unknown as Visit[]) ?? [];
}

/**
 * Finds every visit — any status — matching `query` against ref number,
 * visitor name, visitor phone, or the physical visitor card the person is
 * carrying — the card leg scoped to today's issues, newest first, and kept at
 * the top of the result. Never throws: a Supabase failure on any one leg is logged
 * and treated as an empty result for that leg, so the other legs can still
 * answer.
 *
 * The legs are NOT mutually exclusive and are not meant to be. "C-104" is a
 * plausible card number and an implausible name, but deciding which the guard
 * meant would be a classifier that is wrong at the gate; running both and
 * merging costs one round trip and cannot guess wrong.
 */
export async function searchAllVisits(query: string, limit?: number): Promise<Visit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const effectiveLimit = limit ?? VISIT_SEARCH_LIMIT;
  const pattern = `%${escapeIlike(trimmed)}%`;
  const digits = digitsOnly(trimmed);

  try {
    const [refVisits, cardVisits, nameIds, phoneIds] = await Promise.all([
      fetchVisitsByRef(pattern),
      fetchVisitsByCard(trimmed),
      fetchVisitorIds('full_name', pattern),
      isPhoneShaped(trimmed, digits) ? fetchVisitorIds('phone', `%${digits}%`) : Promise.resolve<string[]>([]),
    ]);

    // One combined lookup for both name- and phone-matched visitors, rather
    // than two separate visits queries, to keep round-trips down.
    const visitorIds = [...new Set([...nameIds, ...phoneIds])];
    const visitorVisits = await fetchVisitsByVisitorIds(visitorIds);

    // TWO ORDERED GROUPS, NOT ONE SORT (client instruction, 2026-08-18: the
    // latest card holder must be on top, then back through today).
    //
    // A card hit is an answer to a different question from a name hit — "who
    // is carrying this number", not "who is this person" — and the instant
    // that orders it is when the card was ISSUED, not when the visit row was
    // created (a pre-approval raised last week and used this morning would
    // sink to the bottom under a created_at sort, which is exactly the row the
    // guard is holding in their hand). So card rows are sorted among
    // themselves by arrival, newest first, and kept ABOVE everything else;
    // the remaining legs keep the created_at order they always had.
    const cardIds = new Set(cardVisits.map((v) => v.id));
    const cardRows = [...new Map(cardVisits.map((v) => [v.id, v])).values()].sort(byCardIssueDesc);

    // The map dedupes by visit id, so a visit matched by both the ref and the
    // name lands once; anything already carried by the card group is dropped
    // here rather than rendered twice under a different order.
    const merged = new Map<string, Visit>();
    for (const v of [...refVisits, ...visitorVisits]) {
      if (!cardIds.has(v.id)) merged.set(v.id, v);
    }

    const rest = [...merged.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const rows = [...cardRows, ...rest].slice(0, effectiveLimit);

    return await attachHostNames(rows);
  } catch (err) {
    console.error('[searchVisits] unexpected failure', err);
    return [];
  }
}

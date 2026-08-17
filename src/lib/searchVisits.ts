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
 * LIVE HOLDER ONLY, on the client's instruction: `status = 'checked_in'`. One
 * card is reissued to a different visitor the day after it comes back, so the
 * historical rows are not what the guard means when they type C-104 — they mean
 * "who has this one, now". Matching `checked_out` rows as well would put three
 * strangers on screen for one card, newest first, and the guard would have to
 * work out which is the person standing in front of them.
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
    .eq('status', 'checked_in')
    .ilike('visitor_card_number', escapeIlike(raw));
  if (error) {
    console.error('[searchVisits] visitor_card_number lookup failed', error);
    return [];
  }
  return (data as unknown as Visit[]) ?? [];
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
 * holding right now. Never throws: a Supabase failure on any one leg is logged
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
      digits.length >= 2 ? fetchVisitorIds('phone', `%${digits}%`) : Promise.resolve<string[]>([]),
    ]);

    // One combined lookup for both name- and phone-matched visitors, rather
    // than two separate visits queries, to keep round-trips down.
    const visitorIds = [...new Set([...nameIds, ...phoneIds])];
    const visitorVisits = await fetchVisitsByVisitorIds(visitorIds);

    const merged = new Map<string, Visit>();
    // The map dedupes by visit id, so a card hit that is also a name hit lands
    // once. Card rows go in FIRST, which is only a tie-break on identity, not
    // on order — the sort below is by created_at either way.
    for (const v of [...cardVisits, ...refVisits, ...visitorVisits]) merged.set(v.id, v);

    const rows = [...merged.values()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, effectiveLimit);

    return await attachHostNames(rows);
  } catch (err) {
    console.error('[searchVisits] unexpected failure', err);
    return [];
  }
}

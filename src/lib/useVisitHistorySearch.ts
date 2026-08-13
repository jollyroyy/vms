// The second half of "searching means it would come up if it exists".
//
// buildMatchItems can only ever filter rows the panel already fetched, and that
// fetch is deliberately narrow: open statuses only, because it feeds the
// arrivals board. So a pass that was already used, rejected or swept closed was
// unfindable no matter how the client filtered — the row was never in the
// browser. This hook is the server-side other half: when the guard actually
// types something, it asks the database for every visit matching that name,
// phone or reference, in any state, and hands them back as MatchItems.
//
// They arrive NON-ACTIONABLE by construction: visitToMatchItem carries the
// visit's real `status` and `dueToday`, and CheckInMatchList refuses to enable
// a row that fails either test. Finding a closed pass tells the guard what
// became of it; it never offers to reopen it.
import { useEffect, useRef, useState } from 'react';
import { searchAllVisits } from './searchVisits';
import { visitToMatchItem } from '../pages/Guard/qrMatchItem';
import type { MatchItem } from '../pages/Guard/checkInTypes';

/** Typing pause before the query goes to the server. Long enough that a guard
 *  keying a 10-digit phone number spends one request, not ten. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Below this the query is too broad to be worth a round-trip. Mirrors the
 *  same guard inside searchAllVisits, which is the authority. */
const MIN_QUERY_LENGTH = 2;

export type UseVisitHistorySearch = {
  /** Matches NOT already present in the panel's own list, newest first. */
  historyMatches: MatchItem[];
  searching: boolean;
};

/**
 * Server-side lookup across every visit status for `query`.
 *
 * `excludeVisitIds` are the rows the panel already shows from its own fetch;
 * they are dropped here so one pass never renders twice — once as an actionable
 * candidate and again as a history row, which would let the guard click the
 * wrong copy of the same visitor.
 */
export function useVisitHistorySearch(
  query: string,
  excludeVisitIds: Set<string>,
): UseVisitHistorySearch {
  const [historyMatches, setHistoryMatches] = useState<MatchItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Monotonic request id. Without it a slow response for "sha" can land after
  // a fast one for "sharma" and overwrite it — the classic search race, where
  // the list shows results for a query the box no longer contains.
  const requestRef = useRef(0);

  // Read through a ref so a changing Set identity (a fresh Set every render in
  // the caller) cannot retrigger the fetch. Only `query` may do that.
  const excludeRef = useRef(excludeVisitIds);
  excludeRef.current = excludeVisitIds;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setHistoryMatches([]);
      setSearching(false);
      // Bump the id so an in-flight response for a longer query cannot repopulate
      // the list after the guard has cleared the box.
      requestRef.current += 1;
      return;
    }

    setSearching(true);
    const id = ++requestRef.current;
    const timer = setTimeout(() => {
      void searchAllVisits(trimmed).then((visits) => {
        if (id !== requestRef.current) return;
        const exclude = excludeRef.current;
        setHistoryMatches(
          visits.filter((v) => !exclude.has(v.id)).map((v) => visitToMatchItem(v)),
        );
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { historyMatches, searching };
}

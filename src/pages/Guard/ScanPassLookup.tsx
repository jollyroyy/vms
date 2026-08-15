import React, { useMemo } from 'react';

import { useVisitHistorySearch } from '../../lib/useVisitHistorySearch';
import { isCheckableStatus } from '../../lib/checkableStatus';
import { MIN_QUERY } from './ScanPassSearchBar';
import CheckInMatchCard from './CheckInMatchCard';
import type { MatchItem } from './checkInTypes';

// Find the pass WITHOUT the camera — by name or mobile number (client
// instruction, 2026-08-15).
//
// The scan desk had exactly one way in: hold the pass up to the lens. That
// fails for the ordinary cases a gate actually sees — a flat phone, a pass left
// at home, a printout that will not focus, a camera the browser refuses to open
// on an insecure origin — and the guard's only remaining move was to leave the
// page. A visitor whose pre-approval exists must be findable by the two things
// they can always tell you: who they are and their number.
//
// This file is the RESULTS half only; the box itself is `ScanPassSearchBar`, in
// the page header. They were one card below the scanner until 2026-08-15 —
// see that file for why the box moved up.
//
// It searches EVERY status, deliberately, because the question is "does this
// pass exist?" — `searchAllVisits` behind `useVisitHistorySearch`. A pass that
// was already used, refused or swept closed comes back and says so rather than
// returning nothing and implying the visitor was never booked.
//
// Results are NON-ACTIONABLE by construction, the same rule the pre-approvals
// desk follows: `isCheckableStatus` and `dueToday` gate `disabled`, so finding
// a closed pass tells the guard what became of it and never offers to reopen
// it. Seeing a pass and being allowed to honour it are two different
// permissions.

export default function ScanPassLookup({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (m: MatchItem) => void;
}): React.ReactElement | null {
  // Nothing to exclude: this page has no candidate list of its own, so no row
  // can render twice.
  const exclude = useMemo(() => new Set<string>(), []);
  const { historyMatches, searching } = useVisitHistorySearch(query, exclude);

  // Nothing has been asked for yet, so there is nothing to say. An empty
  // results card sitting above the scanner would be a permanent "no visitor
  // found" for a search nobody ran.
  if (query.trim().length < MIN_QUERY) return null;

  return (
    <div className="space-y-2">
      {searching && [0, 1].map((i) => <div key={i} className="skeleton h-[72px] w-full rounded-2xl" />)}

      {!searching && historyMatches.length === 0 && (
        <div className="card empty-state !py-10">
          <p className="text-sm font-semibold text-navy-500">No visitor found.</p>
          <p className="text-xs text-navy-500 mt-1">
            This search covers every visit on record, so nothing here means no pass was ever raised
            for that name or number.
          </p>
        </div>
      )}

      {!searching && historyMatches.map((m) => {
        // Same two tests the pre-approvals desk applies. `dueToday` is not
        // redundant next to the status one: a rejected visit scheduled for
        // today has no `checked_in_at`, so the date test alone passes it.
        const checkable = isCheckableStatus(m.status);
        return (
          <CheckInMatchCard
            key={m.id}
            match={m}
            disabled={!checkable || !m.dueToday}
            isCheckedIn={m.status === 'checked_in'}
            expired={!checkable}
            onSelect={() => onSelect(m)}
          />
        );
      })}
    </div>
  );
}

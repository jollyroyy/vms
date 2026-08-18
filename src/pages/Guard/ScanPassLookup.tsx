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
//
// WITH ONE EXCEPTION, added on client instruction 2026-08-17: a visitor who is
// `checked_in` gets a CHECK OUT button. That is not a hole in the rule above —
// it is the same rule read correctly. `disabled` has always meant "cannot be
// checked IN", and somebody already inside is the clearest possible case of
// that; refusing to let them out too was the tab-hopping this surface exists to
// end. It is also what makes the card-number search useful: a guard types the
// number off the card in the visitor's hand and the one thing they need to do
// about it is right there.

export default function ScanPassLookup({
  query,
  onSelect,
  onCheckOut,
  onOpen,
}: {
  query: string;
  onSelect: (m: MatchItem) => void;
  /** Omitted by any caller that cannot complete an exit. */
  onCheckOut?: (m: MatchItem) => void;
  /** Open this visitor's full record — the Entry & Exit frame (client
   *  instruction, 2026-08-18). */
  onOpen?: (m: MatchItem) => void;
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
          <p className="text-sm font-semibold text-navy-800">No visitor found.</p>
          <p className="text-xs text-navy-700 mt-1">
            This search covers every visit on record by name, mobile number or reference — and any
            visitor card issued today. Nothing here means no pass was ever raised, and no card by
            that number has been handed out today.
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
            // NOT `!checkable` (client instruction, 2026-08-18). That said
            // "Expired" about every closed pass alike — a visitor who had
            // checked out an hour ago, a request the host declined, a walk-in
            // nobody answered — because non-checkable and expired are not the
            // same fact. This surface computes no expiry of its own: it has a
            // MatchItem, not a Visit, and it does not need one. The sweep
            // (migrations 065/066/077) writes `expired` or `no_show` onto the
            // row itself once a pass really has run out unused, and
            // CheckInMatchCard prints the row's own status in preference to
            // anything a caller infers. So the honest value here is false.
            expired={false}
            onSelect={() => onSelect(m)}
            onCheckOut={onCheckOut ? () => onCheckOut(m) : undefined}
            // ONE ROW PER HIT, STACKED, AND EVERY ONE OF THEM OPENS (client
            // instruction, 2026-08-18). Three visitors carried card C-104
            // today; the list shows all three, newest first, and clicking any
            // of them renders the same full record Entry & Exit renders —
            // photo, identity steps, timeline and pass — with whichever of
            // Check In / Check Out that visitor is actually due.
            onOpen={onOpen && m.visitId ? () => onOpen(m) : undefined}
          />
        );
      })}
    </div>
  );
}

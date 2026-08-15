import React, { useMemo, useState } from 'react';

import { useVisitHistorySearch } from '../../lib/useVisitHistorySearch';
import { isCheckableStatus } from '../../lib/checkableStatus';
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
  onSelect,
}: {
  onSelect: (m: MatchItem) => void;
}): React.ReactElement {
  const [query, setQuery] = useState('');

  // Nothing to exclude: this page has no candidate list of its own, so no row
  // can render twice.
  const exclude = useMemo(() => new Set<string>(), []);
  const { historyMatches, searching } = useVisitHistorySearch(query, exclude);

  const typed = query.trim().length >= 2;

  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm space-y-4">
      <div>
        <h2 className="font-display text-h2 text-navy-950 dark:text-white">Can't scan the pass?</h2>
        <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">
          Find a pre-approved visitor by their name or mobile number.
        </p>
      </div>

      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-300 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          aria-label="Search by visitor name or mobile number"
          placeholder="Search by name, mobile number or pass number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl text-base font-medium text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Below two characters the query is too broad to be worth a round-trip,
          which is the hook's own rule — say so rather than showing an empty
          list, which reads as "no such visitor". */}
      {!typed && (
        <p className="text-xs text-navy-500 dark:text-navy-400">
          Type at least two characters. Part of a name or a phone number is enough.
        </p>
      )}

      {typed && searching && (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[72px] w-full rounded-2xl" />)}
        </div>
      )}

      {typed && !searching && historyMatches.length === 0 && (
        <div className="card empty-state !py-10">
          <p className="text-sm font-semibold text-navy-500">No visitor found.</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            This search covers every visit on record, so nothing here means no pass was ever raised
            for that name or number.
          </p>
        </div>
      )}

      {typed && !searching && historyMatches.length > 0 && (
        <div className="space-y-2">
          {historyMatches.map((m) => {
            // Same two tests the pre-approvals desk applies. `dueToday` is not
            // redundant next to the status one: a rejected visit scheduled for
            // today has no `checked_in_at`, so the date test alone passes it.
            const checkable = isCheckableStatus(m.status);
            const disabled = !checkable || !m.dueToday;
            return (
              <CheckInMatchCard
                key={m.id}
                match={m}
                disabled={disabled}
                isCheckedIn={m.status === 'checked_in'}
                expired={!checkable}
                onSelect={() => onSelect(m)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

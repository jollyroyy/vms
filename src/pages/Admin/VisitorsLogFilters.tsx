import React from 'react';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { statusesPresent, DEFAULT_LOG_FILTERS, type LogFilters } from '../../lib/visitorsLog';
import type { ReportVisit } from '../../lib/reportRow';

type Props = {
  rows: ReportVisit[];
  filters: LogFilters;
  onChange: (next: LogFilters) => void;
};

// The Visitors Log's controls: one search box and two pickers.
//
// The search is a `type="search"` input, not a magnifying-glass button that
// opens one. This is the admin's register — looking somebody up IS the reason
// the page is open — so the control that does it is on screen and focused-able
// the moment the page loads.
//
// The pickers are built from the LOADED ROWS, never from the full enum: an
// option that opens an empty table is a dead end the reader has to rule out by
// pressing it. Same reasoning as the Reports department filter.

export default function VisitorsLogFilters({ rows, filters, onChange }: Props): React.ReactElement {
  const set = (patch: Partial<LogFilters>) => onChange({ ...filters, ...patch });
  const statuses = statusesPresent(rows);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-surface-200/60 dark:border-white/[0.07]">
      <label className="flex items-center gap-2 text-sm text-navy-700 flex-1 min-w-[220px]">
        <span className="sr-only">Search visitors</span>
        <input
          type="search"
          className="input !py-1.5 w-full"
          placeholder="Search name, vendor, phone or reference"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-navy-700">
        Status
        <select className="input !py-1.5 !w-auto" value={filters.status}
                onChange={(e) => set({ status: e.target.value as LogFilters['status'] })}>
          <option value="all">All Statuses</option>
          {/* `visitStatusLabel` takes the whole visit, not a bare status: for
              `rejected` and `approved` it names the ACTOR ("Rejected by Jane
              (Host)"), which is what keeps a guard's refusal distinguishable
              from an HOD's decline. A picker OPTION has no actor — it stands
              for every row with that status — so it is passed the status alone
              and gets the plain word back. */}
          {statuses.map((s) => (
            <option key={s} value={s}>{visitStatusLabel({ status: s })}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-navy-700">
        Type
        <select className="input !py-1.5 !w-auto" value={filters.origin}
                onChange={(e) => set({ origin: e.target.value as LogFilters['origin'] })}>
          <option value="all">All Visitors</option>
          <option value="pre_approved">Pre-approved</option>
          <option value="walk_in">Walk-in</option>
        </select>
      </label>

      <button type="button" className="btn-secondary text-sm ml-auto"
              onClick={() => onChange(DEFAULT_LOG_FILTERS)}>
        Reset
      </button>
    </div>
  );
}

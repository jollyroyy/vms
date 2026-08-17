import React from 'react';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { statusesPresent, DEFAULT_LOG_FILTERS, type LogFilters } from '../../lib/visitorsLog';
import { ALL_DEPTS, deptOptions } from '../../lib/reportsDeptFilter';
import type { ReportVisit } from '../../lib/reportRow';

type Props = {
  rows: ReportVisit[];
  filters: LogFilters;
  onChange: (next: LogFilters) => void;
};

// The Visitors Log's controls: one search box and three pickers.
//
// DEPARTMENT joined them on 2026-08-17 (client instruction), reusing
// `lib/reportsDeptFilter.ts` — the register's own picker — rather than a second
// implementation, so "which departments can be picked" is answered once. It
// selects on `department_id`, not on the joined name: the join is dropped when
// the department row is unreadable, and filtering by a label would silently lose
// exactly those rows.
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
  const depts = deptOptions(rows);
  // A department can fall out of the loaded rows when the range moves. Resolving
  // the value back to All here keeps the `<select>` controlled — an unmatched
  // value would make the browser show the first option while the filter went on
  // hiding every row, which reads as an empty window rather than a stale filter.
  const deptValue = depts.some((d) => d.id === filters.department) ? filters.department : ALL_DEPTS;

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

      <label className="flex items-center gap-2 text-sm text-navy-700">
        Department
        <select className="input !py-1.5 !w-auto" value={deptValue}
                onChange={(e) => set({ department: e.target.value })}>
          <option value={ALL_DEPTS}>All Departments</option>
          {/* The count rides in the option, the same way the register's picker
              prints it: an admin choosing between eleven departments is usually
              looking for the one a visit is likely to be in. */}
          {depts.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
          ))}
        </select>
      </label>

      <button type="button" className="btn-secondary text-sm ml-auto"
              onClick={() => onChange(DEFAULT_LOG_FILTERS)}>
        Reset
      </button>
    </div>
  );
}

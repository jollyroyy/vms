import React, { useMemo } from 'react';
import type { ReportVisit } from '../../lib/reportRow';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { DEFAULT_FILTERS, type PreRegFilters, type DateRangeFilter } from '../../lib/preRegistration';

// Re-exported so the page imports the filter vocabulary from the component it
// renders. A bare `export { X } from '…'` does NOT bind X locally, which is
// what made the Reset button below reference an undeclared name.
export type { PreRegFilters, DateRangeFilter } from '../../lib/preRegistration';
export { DEFAULT_FILTERS } from '../../lib/preRegistration';

type Props = {
  rows: ReportVisit[];
  filters: PreRegFilters;
  onChange: (filters: PreRegFilters) => void;
};

// Options are built from the rows the page already loaded, never a separate
// lookup — the host dropdown must never offer a name that has zero visits in
// the current window, which is what a static host list off `profiles` would
// do. Same reasoning for Status: only statuses a pre-approval can actually
// reach appear (approved / no_show / expired / checked_in / checked_out), not
// the full ten-value enum.
export default function AdminPreRegFilters({ rows, filters, onChange }: Props): React.ReactElement {
  const hosts = useMemo(() => {
    const names = new Set<string>();
    rows.forEach((v) => { if (v.host?.full_name) names.add(v.host.full_name); });
    return Array.from(names).sort();
  }, [rows]);

  const statuses = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((v) => { if (!seen.has(v.status)) seen.set(v.status, visitStatusLabel(v)); });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const set = (patch: Partial<PreRegFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <label className="flex items-center gap-2 text-sm text-navy-700">
        Host
        <select className="input !py-1.5 !w-auto" value={filters.host} onChange={(e) => set({ host: e.target.value })}>
          <option value="all">All Hosts</option>
          {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-navy-700">
        Date Range
        <select
          className="input !py-1.5 !w-auto"
          value={filters.dateRange}
          onChange={(e) => set({ dateRange: e.target.value as DateRangeFilter })}
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="next7">Next 7 days</option>
          <option value="past">Past</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-navy-700">
        Status
        <select className="input !py-1.5 !w-auto" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="all">All Statuses</option>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <button
        type="button"
        className="btn-secondary text-sm ml-auto"
        onClick={() => onChange(DEFAULT_FILTERS)}
      >
        Reset
      </button>
    </div>
  );
}

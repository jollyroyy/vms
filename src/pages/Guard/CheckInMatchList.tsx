import React from 'react';
import { Link } from 'react-router-dom';
import type { Department, Visit } from '../../types/index';
import CheckInMatchCard from './CheckInMatchCard';
import type { MatchItem } from './checkInTypes';
import { isCheckableStatus } from '../../lib/checkableStatus';

type Props = {
  error: string;
  search: string;
  onSearchChange: (value: string) => void;
  deptFilter: string;
  onDeptFilterChange: (value: string) => void;
  departments: Department[];
  loading: boolean;
  allMatches: MatchItem[];
  preApproved: Visit[];
  checkedInIds: Set<string>;
  isExpired: (v: Visit) => boolean;
  onSelectMatch: (m: MatchItem) => void;
};

export default function CheckInMatchList({
  error, search, onSearchChange, deptFilter, onDeptFilterChange, departments, loading,
  allMatches, preApproved, checkedInIds, isExpired, onSelectMatch,
}: Props): React.ReactElement {
  return (
    <div className="space-y-4 animate-fade-in">
      {error && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Search by name, phone or pass number..." value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl text-base font-medium text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" autoFocus />
        </div>
        <select value={deptFilter} onChange={(e) => onDeptFilterChange(e.target.value)}
          className="w-full sm:w-44 px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl text-sm text-navy-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-2xl" />
          ))}
        </div>
      ) : allMatches.length > 0 ? (
        <div className="space-y-2">
          {allMatches.map((m, idx) => {
            const isCheckedIn = m.source === 'pre_approved' && checkedInIds.has(preApproved.find((v) => v.id === m.visitId)?.visitor_id ?? '');
            const visitRecord = m.source === 'pre_approved' ? preApproved.find((v) => v.id === m.visitId) : null;
            const expired = visitRecord ? isExpired(visitRecord) : false;
            // `!m.dueToday` only ever appears in search results (the default
            // board is today-only), and it disables rather than hides: the
            // guard needs to see that the pass exists and read the date on it,
            // which is the whole reason searching spans every open approval.
            // `!isCheckableStatus(m.status)` closes a second, separate hole:
            // search now spans EVERY open pass regardless of state, so a hit
            // can be checked_out / rejected / cancelled / no_show / expired —
            // none of those are actionable even if dueToday happens to be
            // true (a rejected visit scheduled for today has no
            // checked_in_at, so dueToday alone would say it's fine).
            const disabled = isCheckedIn || expired || !m.dueToday || !isCheckableStatus(m.status);
            return (
              <CheckInMatchCard key={`${m.id}-${idx}`} match={m} disabled={disabled} isCheckedIn={isCheckedIn}
                expired={expired} onSelect={() => onSelectMatch(m)} />
            );
          })}
        </div>
      ) : search || deptFilter ? (
        // No pass, but there IS a visitor at the gate. The register is its own
        // destination (/guard/walk-in, a left-hand nav item since 2026-08-15),
        // where the form is open on arrival and the pending queue sits beside
        // it — so this sends the guard there rather than unfolding a second
        // copy of that form inside a search result. One place a walk-in is
        // raised, one place its answer comes back.
        <div className="text-center py-12 px-6 bg-surface-50 rounded-2xl space-y-4">
          <span className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold text-navy-600">No match found</p>
            <p className="text-sm text-navy-500 max-w-sm mx-auto">
              No pass exists for that name, phone number or pass reference — in any state.
              If they are standing at the gate, register them as a walk-in.
            </p>
          </div>
          <Link to="/guard/walk-in"
            className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-[15px] font-bold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Register walk-in visitor
            <svg className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" /></svg>
          </Link>
          <p className="text-xs text-navy-500">
            Opens the Register Walk-in tab — the person to meet is asked to approve
          </p>
        </div>
      ) : (
        <div className="text-center py-16 bg-surface-50 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-navy-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-lg font-bold text-navy-600">Search for a visitor</p>
          <p className="text-sm text-navy-500 mt-1">Search by name, phone number or pass reference</p>
        </div>
      )}
    </div>
  );
}

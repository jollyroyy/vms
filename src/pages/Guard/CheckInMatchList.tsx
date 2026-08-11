import React from 'react';
import type { Department, Visit } from '../../types/index';
import WalkInRequest from './WalkInRequest';
import CheckInMatchCard from './CheckInMatchCard';
import type { MatchItem } from './CheckInPanel';
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
  showWalkIn: boolean;
  onShowWalkIn: () => void;
  onWalkInSubmitted: (name: string) => void;
  onWalkInCancel: () => void;
};

export default function CheckInMatchList({
  error, search, onSearchChange, deptFilter, onDeptFilterChange, departments, loading,
  allMatches, preApproved, checkedInIds, isExpired, onSelectMatch, showWalkIn, onShowWalkIn,
  onWalkInSubmitted, onWalkInCancel,
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
        <div className="text-center py-12 bg-surface-50 rounded-2xl space-y-3">
          <p className="text-lg font-bold text-navy-600">No match found</p>
          <p className="text-sm text-navy-500 dark:text-navy-400">No pass exists for that name, phone number or pass reference — in any state.</p>
          {!showWalkIn ? (
            <button onClick={onShowWalkIn}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Request Walk-in Approval
            </button>
          ) : (
            <div className="max-w-lg mx-auto">
              <WalkInRequest
                onSubmitted={onWalkInSubmitted}
                onCancel={onWalkInCancel}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface-50 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-navy-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-lg font-bold text-navy-600">Search for a visitor</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 mt-1">Search by name, phone number or pass reference</p>
        </div>
      )}
    </div>
  );
}

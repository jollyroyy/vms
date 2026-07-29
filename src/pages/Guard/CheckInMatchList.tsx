import React from 'react';
import type { Department, Visit } from '../../types/index';
import WalkInRequest from './WalkInRequest';
import type { MatchItem } from './CheckInPanel';

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
          <input type="text" placeholder="Search by phone or name..." value={search}
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
            const isRecurring = m.source === 'recurring';
            const isCheckedIn = m.source === 'pre_approved' && checkedInIds.has(preApproved.find((v) => v.id === m.visitId)?.visitor_id ?? '');
            const visitRecord = m.source === 'pre_approved' ? preApproved.find((v) => v.id === m.visitId) : null;
            const expired = visitRecord ? isExpired(visitRecord) : false;
            const disabled = isCheckedIn || expired;
            return (
              <div key={`${m.id}-${idx}`}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-surface-100 flex items-center justify-between transition-all ${
                  disabled ? 'opacity-50' : 'hover:shadow-md cursor-pointer'
                }`}
                onClick={() => {
                  if (!disabled) onSelectMatch(m);
                }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-navy-900">{m.visitorName}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isRecurring ? 'bg-accent-50 text-accent-700' : 'bg-success-50 text-success-700'
                    }`}>
                      {isRecurring ? 'Regular' : 'Pre-Approved'}
                    </span>
                    {isCheckedIn && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Checked In</span>
                    )}
                    {expired && !isCheckedIn && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-danger-50 text-danger-700">Expired</span>
                    )}
                  </div>
                  <p className="text-sm text-navy-400 mt-0.5 truncate">{m.departmentName} · {m.purpose}</p>
                </div>
                {!disabled && (
                  <button onClick={(e) => { e.stopPropagation(); onSelectMatch(m); }}
                    className="shrink-0 ml-3 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
                    Check In
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : search || deptFilter ? (
        <div className="text-center py-12 bg-surface-50 rounded-2xl space-y-3">
          <p className="text-lg font-bold text-navy-600">No match found</p>
          <p className="text-sm text-navy-400">No pre-approved or regular visitor matches your search.</p>
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
          <p className="text-sm text-navy-400 mt-1">Type name or phone number above</p>
        </div>
      )}
    </div>
  );
}

// Lists departments with no head of department assigned, allowing the admin to quickly spot gaps.
import React from 'react';
import type { Department } from '../../types/index';

type Props = {
  id: string;
  departments: Department[];
  onAssign: (department: Department) => void;
};

export default function UnassignedDepartments({ id, departments, onAssign }: Props): React.ReactElement {
  if (departments.length === 0) {
    return (
      <div id={id} className="space-y-3 animate-fade-in">
        <div className="empty-state card">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-success-500/15 to-brand-500/10 border border-success-500/20 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-success-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-navy-500">Every department has an HOD</p>
          <p className="text-xs text-navy-300 mt-1">Nothing needs attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="space-y-3 animate-fade-in">
      {departments.map((d, i) => (
        <div
          key={d.id}
          className={`card card-hover p-4 flex items-center justify-between gap-3 animate-slide-up stagger-${Math.min(i + 1, 5)}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-800 truncate">{d.name}</p>
            {d.code && <p className="text-xs text-navy-400 truncate">{d.code}</p>}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="status-badge bg-warning-500/12 text-warning-600 border border-warning-500/25">
              No HOD
            </span>
            <button
              type="button"
              onClick={() => onAssign(d)}
              aria-label={`Assign a head of department to ${d.name}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 bg-gradient-to-r from-brand-500/12 to-accent-500/12 text-brand-600 dark:text-brand-300 border border-brand-500/25 hover:border-brand-500/50 active:scale-[0.97] transition-all"
            >
              Assign HOD
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

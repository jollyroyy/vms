import React from 'react';
import type { Department, Profile } from '../../types/index';

// Displays a read-only directory of all heads of department, grouped by department.
// All HOD editing is handled in the Departments view / DepartmentCard component.
// This component is shown when clicking the "Heads of Department" count in AdminPanel.

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

type Props = {
  id: string;
  departments: Department[];
  hodsByDept: Map<string, Profile[]>;
};

export default function HodDirectory({ id, departments, hodsByDept }: Props): React.ReactElement {
  const groups = departments
    .map((d) => ({ dept: d, hods: hodsByDept.get(d.id) ?? [] }))
    .filter((g) => g.hods.length > 0);

  if (groups.length === 0) {
    return (
      <div id={id} className="space-y-3 animate-fade-in">
        <div className="empty-state card">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-accent-500/15 to-brand-500/10 border border-accent-500/20 flex items-center justify-center mb-3">
            <svg
              aria-hidden="true"
              className="w-6 h-6 text-accent-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.856-1.487M7 20H2v-2a3 3 0 015.856-1.487M15 7a3 3 0 11-6 0 3 3 0 016 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-navy-500">No heads of department yet</p>
          <p className="text-xs text-navy-300 mt-1">Assign an HOD from the Departments view.</p>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="space-y-3 animate-fade-in">
      {groups.map((g, i) => (
        <div
          key={g.dept.id}
          className={`card p-5 animate-slide-up stagger-${Math.min(i + 1, 5)}`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">{g.dept.name}</p>
            <span className="glass-chip !px-2 !py-0.5 !text-[10px] tabular-nums text-navy-500 dark:text-navy-400">
              {g.hods.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {g.hods.map((hod) => (
              <div
                key={hod.id}
                className="flex items-center gap-3 py-2 px-2.5 rounded-xl min-w-0 hover:bg-surface-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="h-9 w-9 rounded-full avatar-gradient flex items-center justify-center shrink-0 ring-1 ring-white/20">
                  <span className="text-[11px] font-bold">
                    {initials(hod.full_name ?? '')}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800 truncate">
                    {hod.full_name}
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400 truncate">{hod.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

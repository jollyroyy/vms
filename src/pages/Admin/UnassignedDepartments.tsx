// Departments with no head of department, and the one action that closes the
// gap. "Assign HOD" used to hand off to the Departments view with the form
// open, which dumped the admin into a list of EVERY department — the exact
// thing this screen exists to filter out. The form now opens inline, on the
// card, so assigning never costs the filtered list.
import React from 'react';
import type { Department } from '../../types/index';
import type { HodInput } from '../../lib/adminHods';
import type { HodFormSlot } from './HodList';
import HodForm from './HodForm';

type Props = {
  id: string;
  departments: Department[];
  hodSlot: HodFormSlot | null;
  hodBusy: boolean;
  onAssign: (department: Department) => void;
  onCancelHod: () => void;
  onSubmitHod: (input: HodInput) => void;
};

export default function UnassignedDepartments({
  id, departments, hodSlot, hodBusy, onAssign, onCancelHod, onSubmitHod,
}: Props): React.ReactElement {
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
      {departments.map((d, i) => {
        const open = hodSlot?.kind === 'add' && hodSlot.departmentId === d.id;
        return (
          <div
            key={d.id}
            className={`card card-hover p-4 animate-slide-up stagger-${Math.min(i + 1, 5)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-navy-900 dark:text-white tracking-tight truncate">{d.name}</p>
                {d.code && <p className="text-xs font-mono tracking-wider text-navy-400 truncate mt-0.5">{d.code}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="status-badge bg-warning-500/12 text-warning-600 dark:text-warning-300 border border-warning-500/25">
                  No HOD
                </span>
                <button
                  type="button"
                  onClick={() => (open ? onCancelHod() : onAssign(d))}
                  aria-expanded={open}
                  aria-label={`Assign a head of department to ${d.name}`}
                  className="btn-primary !px-3.5 !py-1.5 !text-xs"
                >
                  {open ? 'Close' : 'Assign HOD'}
                </button>
              </div>
            </div>

            {open && (
              <HodForm busy={hodBusy} onSubmit={onSubmitHod} onCancel={onCancelHod} />
            )}
          </div>
        );
      })}
    </div>
  );
}

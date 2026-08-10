// One department: its identity row, inline edit form, and its HOD roster.
import React from 'react';
import DepartmentForm from './DepartmentForm';
import HodList, { type HodFormSlot } from './HodList';
import type { DepartmentInput } from '../../lib/adminDepartments';
import type { HodInput } from '../../lib/adminHods';
import type { Department, Profile } from '../../types/index';

type Props = {
  department: Department;
  hods: Profile[];
  index: number;
  isEditing: boolean;
  editBusy: boolean;
  hodBusy: boolean;
  hodSlot: HodFormSlot | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (input: DepartmentInput) => void;
  onRequestDelete: () => void;
  onOpenAddHod: () => void;
  onOpenEditHod: (hod: Profile) => void;
  onCancelHod: () => void;
  onSubmitHod: (input: HodInput) => void;
  onRequestRemoveHod: (hod: Profile) => void;
};

export default function DepartmentCard({
  department: d, hods, index, isEditing, editBusy, hodBusy, hodSlot,
  onStartEdit, onCancelEdit, onSubmitEdit, onRequestDelete,
  onOpenAddHod, onOpenEditHod, onCancelHod, onSubmitHod, onRequestRemoveHod,
}: Props): React.ReactElement {
  return (
    <div className={`card card-hover p-5 relative overflow-hidden animate-slide-up stagger-${Math.min(index + 1, 5)}`}>
      {/* premium accent rail */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand-500 via-accent-500 to-transparent opacity-70"
      />

      {isEditing ? (
        <DepartmentForm
          mode="edit"
          initial={{ name: d.name, code: d.code }}
          busy={editBusy}
          onSubmit={onSubmitEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-600 dark:text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="card-title truncate">{d.name}</h3>
              <span className="glass-chip !px-2 !py-0.5 !text-[11px] font-mono tracking-wider text-navy-500 dark:text-navy-400 mt-1.5">
                {d.code}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              aria-label={`Edit ${d.name}`}
              title={`Edit ${d.name}`}
              onClick={onStartEdit}
              className="btn-ghost !px-3 !py-1.5 !text-xs hover:!text-brand-600"
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Delete ${d.name}`}
              title={`Delete ${d.name}`}
              onClick={onRequestDelete}
              className="text-xs font-medium text-danger-600 hover:text-danger-700 px-3 py-1.5 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-500/10 active:scale-[0.97] transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <HodList
        departmentId={d.id}
        departmentName={d.name}
        hods={hods}
        slot={hodSlot}
        busy={hodBusy}
        onOpenAdd={onOpenAddHod}
        onOpenEdit={onOpenEditHod}
        onCancel={onCancelHod}
        onSubmit={onSubmitHod}
        onRequestRemove={onRequestRemoveHod}
      />
    </div>
  );
}

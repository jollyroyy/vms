// The department roster: the New Department form plus one DepartmentCard per
// department, or an empty state. Split out of DepartmentsManager so that file
// stays a state container and this one stays presentational.
import React from 'react';
import DepartmentCard from './DepartmentCard';
import DepartmentForm from './DepartmentForm';
import type { HodFormSlot } from './HodList';
import type { DepartmentInput } from '../../lib/adminDepartments';
import type { HodInput } from '../../lib/adminHods';
import type { Department, Profile } from '../../types/index';

type Props = {
  id: string;
  departments: Department[];
  hodsByDept: Map<string, Profile[]>;
  createKey: number;
  createBusy: boolean;
  editingId: string | null;
  editBusy: boolean;
  hodBusy: boolean;
  hodSlot: HodFormSlot | null;
  onCreate: (input: DepartmentInput) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (id: string, input: DepartmentInput) => void;
  onRequestDelete: (department: Department) => void;
  onOpenAddHod: (departmentId: string) => void;
  onOpenEditHod: (departmentId: string, hod: Profile) => void;
  onCancelHod: () => void;
  onSubmitHod: (input: HodInput) => void;
  onRequestRemoveHod: (hod: Profile) => void;
};

export default function DepartmentList({
  id, departments, hodsByDept, createKey, createBusy, editingId, editBusy,
  hodBusy, hodSlot, onCreate, onStartEdit, onCancelEdit, onSubmitEdit,
  onRequestDelete, onOpenAddHod, onOpenEditHod, onCancelHod, onSubmitHod,
  onRequestRemoveHod,
}: Props): React.ReactElement {
  return (
    <div id={id} className="space-y-5 animate-fade-in">
      <div className="card-premium p-5">
        <p className="section-title mb-3">New Department</p>
        <DepartmentForm key={createKey} mode="create" busy={createBusy} onSubmit={onCreate} />
      </div>

      <div className="space-y-3">
        {departments.map((d, i) => (
          <DepartmentCard
            key={d.id}
            department={d}
            hods={hodsByDept.get(d.id) ?? []}
            index={i}
            isEditing={editingId === d.id}
            editBusy={editBusy}
            hodBusy={hodBusy}
            hodSlot={hodSlot}
            onStartEdit={() => onStartEdit(d.id)}
            onCancelEdit={onCancelEdit}
            onSubmitEdit={(input) => onSubmitEdit(d.id, input)}
            onRequestDelete={() => onRequestDelete(d)}
            onOpenAddHod={() => onOpenAddHod(d.id)}
            onOpenEditHod={(hod) => onOpenEditHod(d.id, hod)}
            onCancelHod={onCancelHod}
            onSubmitHod={onSubmitHod}
            onRequestRemoveHod={onRequestRemoveHod}
          />
        ))}

        {departments.length === 0 && (
          <div className="empty-state card">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 border border-brand-500/20 flex items-center justify-center mb-3">
              <svg aria-hidden="true" className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy-500">No departments yet</p>
            <p className="text-xs text-navy-300 mt-1">Create your first one using the form above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

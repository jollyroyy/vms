// The "Heads of Department" block inside a department card: the roster, the
// add/edit form slot, and the per-row edit / remove controls.
import React from 'react';
import HodForm from './HodForm';
import type { HodInput } from '../../lib/adminHods';
import type { Profile } from '../../types/index';

export type HodFormSlot =
  | { kind: 'add'; departmentId: string }
  | { kind: 'edit'; departmentId: string; hod: Profile };

type Props = {
  departmentId: string;
  departmentName: string;
  hods: Profile[];
  slot: HodFormSlot | null;
  busy: boolean;
  onOpenAdd: () => void;
  onOpenEdit: (hod: Profile) => void;
  onCancel: () => void;
  onSubmit: (input: HodInput) => void;
  onRequestRemove: (hod: Profile) => void;
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default function HodList({
  departmentId, departmentName, hods, slot, busy,
  onOpenAdd, onOpenEdit, onCancel, onSubmit, onRequestRemove,
}: Props): React.ReactElement {
  const mine = slot && slot.departmentId === departmentId ? slot : null;
  const editingId = mine?.kind === 'edit' ? mine.hod.id : null;

  return (
    <div className="border-t border-surface-200/60 dark:border-white/[0.06] pt-4 mt-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-title">Heads of Department</p>
        <span className="glass-chip !px-2 !py-0.5 !text-[10px] text-navy-400">{hods.length}</span>
      </div>

      {hods.length === 0 && !mine && (
        <p className="text-sm text-navy-300 italic py-2">No head of department assigned</p>
      )}

      <div className="space-y-1">
        {hods.map((hod) => (
          <div
            key={hod.id}
            className="flex items-center justify-between gap-3 py-2 px-2.5 rounded-xl hover:bg-surface-100/70 dark:hover:bg-white/[0.04] transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full avatar-gradient flex items-center justify-center shrink-0 ring-1 ring-white/20">
                <span className="text-[11px] font-bold">{initials(hod.full_name ?? '')}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{hod.full_name}</p>
                <p className="text-xs text-navy-400 truncate">{hod.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label={`Edit ${hod.full_name}`}
                title={`Edit ${hod.full_name}`}
                onClick={() => onOpenEdit(hod)}
                className="text-xs font-medium text-navy-400 hover:text-brand-600 px-2.5 py-1.5 rounded-lg hover:bg-brand-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Remove ${hod.full_name}`}
                title={`Remove ${hod.full_name}`}
                onClick={() => onRequestRemove(hod)}
                className="text-xs font-medium text-danger-600/80 hover:text-danger-700 px-2.5 py-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {mine ? (
        <HodForm
          key={editingId ?? 'add'}
          initial={mine.kind === 'edit'
            ? { fullName: mine.hod.full_name ?? '', email: mine.hod.email ?? '' }
            : undefined}
          editingHodId={mine.kind === 'edit' ? mine.hod.id : undefined}
          busy={busy}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      ) : (
        <button
          type="button"
          aria-label={`Add head of department to ${departmentName}`}
          onClick={onOpenAdd}
          className="mt-2.5 text-xs font-semibold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 bg-gradient-to-r from-brand-500/12 to-accent-500/12 text-brand-600 dark:text-brand-300 border border-brand-500/25 hover:border-brand-500/50 hover:shadow-glow-sm active:scale-[0.97] transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add HOD
        </button>
      )}
    </div>
  );
}

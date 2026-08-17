import React from 'react';
import type { DirectoryUser } from '../../lib/adminUsers';
import {
  ROLE_CHIP, ROLE_LABEL, accountStatusChip, accountStatusLabel, isAccountActive, isManageable,
} from '../../lib/userStatus';
import type { Department } from '../../types/index';

// The account directory. Presentational: it owns no state and performs no
// write — SettingsUsers holds both, so the table can be read as a description
// of a row rather than as a place where things happen.

type Props = {
  users: DirectoryUser[];
  departments: Department[];
  /** The id currently being deactivated or reactivated, so one row can say so. */
  busyId: string | null;
  onEdit: (user: DirectoryUser) => void;
  onRequestDeactivate: (user: DirectoryUser) => void;
  onReactivate: (user: DirectoryUser) => void;
};

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UserDirectoryTable({
  users, departments, busyId, onEdit, onRequestDeactivate, onReactivate,
}: Props): React.ReactElement {
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-200/60 dark:border-white/[0.07]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-navy-700 bg-surface-100/60 dark:bg-white/[0.03]">
            <th scope="col" className="px-4 py-3 font-semibold">Name</th>
            <th scope="col" className="px-4 py-3 font-semibold">Email</th>
            <th scope="col" className="px-4 py-3 font-semibold">Role</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Department</th>
            <th scope="col" className="px-4 py-3 font-semibold">Added</th>
            <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-200/60 dark:divide-white/[0.07]">
          {users.map((u) => {
            const active = isAccountActive(u.is_active);
            const busy = busyId === u.id;
            return (
              <tr key={u.id} className="align-middle">
                <td className="px-4 py-3 font-semibold text-navy-950 dark:text-white">{u.full_name}</td>
                {/* An account with no address on the profile row is a real
                    state, not a rendering gap — say so rather than leaving the
                    cell blank, which reads as a layout bug. */}
                <td className="px-4 py-3 text-navy-700 break-words">{u.email || 'Not recorded'}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${ROLE_CHIP[u.role] ?? ROLE_CHIP.staff}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${accountStatusChip(u.is_active)}`}>
                    {accountStatusLabel(u.is_active)}
                  </span>
                </td>
                {/* A guard has no department by design, and an em dash would
                    read as "we do not know". */}
                <td className="px-4 py-3 text-navy-700 whitespace-nowrap">
                  {u.department_id ? (deptName.get(u.department_id) ?? 'Unknown department') : 'None'}
                </td>
                <td className="px-4 py-3 text-navy-700 whitespace-nowrap tabular-nums">{formatJoined(u.created_at)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {isManageable(u.role) ? (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => onEdit(u)}
                        className="text-xs font-semibold text-navy-600 hover:text-brand-600 transition-colors"
                      >
                        Edit
                      </button>
                      {active ? (
                        <button
                          type="button"
                          disabled={busy}
                          // Opens the confirmation, never deactivates directly:
                          // one stray click on a dense table row must not
                          // revoke somebody's access.
                          onClick={() => onRequestDeactivate(u)}
                          className="text-xs font-semibold text-danger-600 hover:text-danger-700 transition-colors disabled:opacity-50"
                        >
                          {busy ? 'Working…' : 'Deactivate'}
                        </button>
                      ) : (
                        // No dialog: reactivation restores exactly what was
                        // withdrawn and is not destructive, which is the whole
                        // reason its counterpart has one.
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onReactivate(u)}
                          className="text-xs font-semibold text-success-700 hover:text-success-800 transition-colors disabled:opacity-50"
                        >
                          {busy ? 'Working…' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  ) : (
                    // Every one of the four RPCs refuses an admin target, so no
                    // control is rendered rather than one that could only fail.
                    <span className="text-xs text-navy-600">Managed in Supabase</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

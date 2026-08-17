import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminAlerts, { useAdminMessages } from './AdminAlerts';
import ConfirmDialog from './ConfirmDialog';
import UserDirectoryTable from './UserDirectoryTable';
import UserFormModal from './UserFormModal';
import { useDepartments } from '../../lib/useDepartments';
import {
  createUser, deactivateUser, fetchUserDirectory, reactivateUser, updateUser,
  validateUser, type DirectoryUser, type UserInput,
} from '../../lib/adminUsers';
import { isAccountActive } from '../../lib/userStatus';

// Settings → Users: every account that can sign in to VMS.
//
// The filter is by ROLE plus one STATUS entry, and those are two different
// questions on purpose. "Suspended" is not a role — a suspended guard is still
// a guard (migration 094) — so the Guard filter lists them too. Splitting them
// into separate columns is the whole reason the status has its own table.
//
// One in-flight id covers deactivate and reactivate, because a row can only
// ever offer one of the two.

// One chip per assignable role, plus All and Suspended. Senior Manager gets its
// OWN filter rather than being folded in with HODs (2026-08-18): the two share
// every permission, but the reason the role exists is that an admin needs to
// see which departments are headed by which title, and a filter that answered
// "HODs" with a mixed list would take that answer away.
type Filter = 'all' | 'guard' | 'hod' | 'senior_manager' | 'staff' | 'suspended';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'guard', label: 'Guards' },
  { key: 'hod', label: 'HODs' },
  { key: 'senior_manager', label: 'Senior Managers' },
  { key: 'staff', label: 'Staff' },
  { key: 'suspended', label: 'Suspended' },
];

function matches(user: DirectoryUser, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'suspended') return !isAccountActive(user.is_active);
  return user.role === filter;
}

const message = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function SettingsUsers(): React.ReactElement {
  const { departments } = useDepartments();
  const msg = useAdminMessages();

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // `null` = closed. `{ user: undefined }` = the Add form. An explicit wrapper
  // rather than two booleans, so "adding" and "editing nobody" cannot both be
  // true at once.
  const [form, setForm] = useState<{ user?: DirectoryUser } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDeactivate, setPendingDeactivate] = useState<DirectoryUser | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchUserDirectory());
      setLoadError('');
    } catch (err) {
      // Surfaced, never rendered as an empty table: a failed read and an
      // organisation with no accounts must not look the same.
      setLoadError(message(err, 'Could not load the user directory.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => users.filter((u) => matches(u, filter)), [users, filter]);

  const handleSubmit = async (input: UserInput, password?: string) => {
    const invalid = validateUser(input, password);
    if (invalid) { setFormError(invalid); return; }

    setFormBusy(true);
    setFormError(null);
    msg.clear();
    const editing = form?.user;
    try {
      if (editing) {
        await updateUser(editing.id, input);
        msg.showSuccess(`${input.fullName} updated.`);
      } else {
        await createUser(input, password ?? '');
        msg.showSuccess(`${input.fullName} can now sign in. They will be asked to set their own password.`);
      }
      setForm(null);
      await load();
    } catch (err) {
      // The form stays open with everything typed still in it — reporting that
      // we could not save is no reason to throw away what was entered.
      setFormError(message(err, 'Could not save this user.'));
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivate) return;
    const target = pendingDeactivate;
    msg.clear();
    setStatusBusyId(target.id);
    try {
      await deactivateUser(target.id);
      setPendingDeactivate(null);
      msg.showSuccess(`${target.full_name} can no longer sign in. Their role and history are unchanged.`);
      await load();
    } catch (err) {
      setPendingDeactivate(null);
      msg.showError(message(err, 'Could not deactivate this user.'));
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleReactivate = async (target: DirectoryUser) => {
    msg.clear();
    setStatusBusyId(target.id);
    try {
      await reactivateUser(target.id);
      msg.showSuccess(`${target.full_name} can sign in again.`);
      await load();
    } catch (err) {
      msg.showError(message(err, 'Could not reactivate this user.'));
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tab-group w-fit" role="group" aria-label="Filter users">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className={filter === f.key ? 'tab-active' : 'tab-inactive'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => { setFormError(null); setForm({}); }}
        >
          Add User
        </button>
      </div>

      <AdminAlerts success={msg.success} error={msg.error || loadError} />

      {loading ? (
        <p className="text-sm text-navy-700 py-8">Loading users…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-navy-700 py-8">
          {users.length === 0 ? 'No accounts yet.' : 'No accounts match this filter.'}
        </p>
      ) : (
        <UserDirectoryTable
          users={filtered}
          departments={departments}
          busyId={statusBusyId}
          onEdit={(user) => { setFormError(null); setForm({ user }); }}
          onRequestDeactivate={setPendingDeactivate}
          onReactivate={(user) => { void handleReactivate(user); }}
        />
      )}

      {form && (
        <UserFormModal
          user={form.user}
          departments={departments}
          busy={formBusy}
          error={formError}
          onSubmit={(input, password) => { void handleSubmit(input, password); }}
          onClose={() => setForm(null)}
        />
      )}

      {pendingDeactivate && (
        <ConfirmDialog
          title="Deactivate this account?"
          message={`${pendingDeactivate.full_name} will be signed out everywhere and will not be able to sign in again until an admin reactivates them. Their role, department and everything they have already done are kept.`}
          confirmLabel="Deactivate"
          busyLabel="Deactivating…"
          busy={statusBusyId === pendingDeactivate.id}
          onConfirm={() => { void handleDeactivate(); }}
          onCancel={() => setPendingDeactivate(null)}
        />
      )}
    </div>
  );
}

import React, { useId, useState } from 'react';
import ModalCloseButton from '../../components/ModalCloseButton';
import HodPasswordReset from './HodPasswordReset';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { PERSON_NAME_MAX } from '../../lib/inputRules';
import { PASSWORD_MIN, type DirectoryUser, type UserInput } from '../../lib/adminUsers';
import { ASSIGNABLE_ROLES, isAssignableRole, roleTakesDepartment, type AssignableRole } from '../../lib/userStatus';
import type { Department } from '../../types/index';

// One modal, two modes. Adding and editing ask for the same four things minus
// the credential, and a second component would be the same form twice — which
// is how the Role list in one of them drifts away from the other's.
//
// THE EMAIL IS READ-ONLY WHEN EDITING. Changing the address somebody signs in
// with is an auth-admin operation; `admin_update_user` deliberately does not
// accept one, because rewriting only `profiles.email` would leave this screen
// showing an address the login does not accept. Resetting the password is
// offered instead, through the same component the HOD cards use.

type Props = {
  /** Absent when adding. */
  user?: DirectoryUser;
  departments: Department[];
  busy: boolean;
  error: string | null;
  onSubmit: (input: UserInput, password?: string) => void;
  onClose: () => void;
};

export default function UserFormModal({
  user, departments, busy, error, onSubmit, onClose,
}: Props): React.ReactElement {
  const editing = user !== undefined;
  const uid = useId();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  // A row whose role this screen cannot assign (there is none today — the table
  // renders no Edit for admin rows) falls back to Staff, which is the choice
  // the admin came here to make.
  const [role, setRole] = useState<AssignableRole>(
    user && isAssignableRole(user.role) ? user.role : 'guard',
  );
  const [departmentId, setDepartmentId] = useState(user?.department_id ?? '');

  useEscapeKey(onClose);

  const takesDepartment = roleTakesDepartment(role);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      // A guard's department is dropped here as well as server-side: leaving a
      // stale id in the payload would make the request describe something the
      // database is about to silently ignore.
      { fullName, email, role, departmentId: takesDepartment ? (departmentId || null) : null },
      editing ? undefined : password,
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit user' : 'Add user'}
        className="modal-content p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClose={onClose} />
        <h3 className="text-lg font-semibold text-navy-950 dark:text-white font-display mb-1 pr-14">
          {editing ? 'Edit user' : 'Add user'}
        </h3>
        <p className="text-sm text-navy-700 mb-5 pr-14">
          {editing
            ? user.email || 'No email on file'
            : 'Creates the account immediately. Hand the password over in person — the person is made to choose their own the first time they sign in.'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor={`${uid}-name`} className="label">Full name</label>
            <input
              id={`${uid}-name`}
              className="input"
              required
              maxLength={PERSON_NAME_MAX}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Asha Rao"
            />
          </div>

          <div>
            <label htmlFor={`${uid}-email`} className="label">Email</label>
            <input
              id={`${uid}-email`}
              className="input disabled:opacity-60"
              type="email"
              required
              disabled={editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@company.com"
              aria-describedby={editing ? `${uid}-email-hint` : undefined}
            />
            {editing && (
              <p id={`${uid}-email-hint`} className="text-[11px] text-navy-700 mt-1">
                The sign-in address cannot be changed here. Reset the password below instead.
              </p>
            )}
          </div>

          {!editing && (
            <div>
              <label htmlFor={`${uid}-password`} className="label">Temporary password</label>
              <input
                id={`${uid}-password`}
                className="input"
                type="text"
                required
                minLength={PASSWORD_MIN}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN} characters`}
                aria-describedby={`${uid}-password-hint`}
              />
              {/* Shown as text, not dots: the admin has to read this out or
                  write it down, and a masked field they cannot check is how a
                  typo becomes a support call. */}
              <p id={`${uid}-password-hint`} className="text-[11px] text-navy-700 mt-1">
                Shown as you type so it can be read out. It is replaced by one the person chooses on first sign-in.
              </p>
            </div>
          )}

          <div>
            <label htmlFor={`${uid}-role`} className="label">Role</label>
            <select
              id={`${uid}-role`}
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as AssignableRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-navy-700 mt-1">
              Admin and CEO accounts are not created here — see the Supabase dashboard.
            </p>
          </div>

          {takesDepartment ? (
            <div>
              <label htmlFor={`${uid}-dept`} className="label">Department</label>
              <select
                id={`${uid}-dept`}
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
              <p className="text-[11px] text-navy-700 mt-1">
                A head of department approves this department&rsquo;s visitors; staff in it can be the person a visitor came to meet.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-navy-700">
              A guard works a gate, not a department, so no department is recorded.
            </p>
          )}

          {error && <div className="alert-error">{error}</div>}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>

        {editing && (
          <div className="mt-5 pt-5 border-t border-surface-200/60 dark:border-white/[0.07]">
            <HodPasswordReset userId={user.id} userName={user.full_name} />
          </div>
        )}
      </div>
    </div>
  );
}

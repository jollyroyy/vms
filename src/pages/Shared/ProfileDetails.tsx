import React, { useState } from 'react';
import type { UserRole } from '../../types/index';
import { formatDateTime } from '../../lib/formatDate';

const ROLE_LABELS: Record<UserRole, string> = {
  guard: 'Guard', hod: 'Head of Department', senior_manager: 'Senior Manager',
  staff: 'Staff', admin: 'Administrator',
  ceo: 'Chief Executive Officer',
};

type Props = {
  fullName: string;
  email: string;
  role: UserRole | null;
  deptName: string;
  createdAt: string | null;
  onSaveName: (name: string) => Promise<string | null>;
};

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint: string }): React.ReactElement {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm font-semibold text-navy-950 dark:text-white mt-1">{value}</p>
      <p className="text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">{hint}</p>
    </div>
  );
}

export default function ProfileDetails({ fullName, email, role, deptName, createdAt, onSaveName }: Props): React.ReactElement {
  const [draft, setDraft] = useState(fullName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const dirty = draft.trim() !== fullName.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    const err = await onSaveName(draft);
    setBusy(false);
    if (err) { setError(err); return; }
    setSaved(true);
  };

  return (
    <div className="card p-6 space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <label className="label" htmlFor="profile-name">Display name</label>
        <div className="flex flex-wrap items-start gap-2">
          <input id="profile-name" className="input flex-1 min-w-[12rem]" value={draft} maxLength={80}
            onChange={(e) => { setDraft(e.target.value); setSaved(false); setError(''); }} />
          <button type="submit" disabled={busy || !dirty} className="btn-primary !py-2.5 !px-4 text-sm">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-[11px] text-navy-500 dark:text-navy-400">This is the name hosts and guards see next to your actions.</p>
        {error && <p role="alert" className="text-xs font-semibold text-danger-600">{error}</p>}
        {saved && !error && <p className="text-xs font-semibold text-success-700">Name saved.</p>}
      </form>

      {/* Everything below is administered, not self-service: role and department
          are set in the Admin Panel and role syncs into the JWT, so they are
          deliberately read-only here. */}
      <div className="grid gap-5 sm:grid-cols-2 pt-5 border-t border-surface-100 dark:border-white/[0.06]">
        <ReadOnlyField label="Email" value={email || '—'} hint="Used to sign in. Contact an administrator to change it." />
        <ReadOnlyField label="Role" value={role ? ROLE_LABELS[role] : '—'} hint="Set by an administrator." />
        <ReadOnlyField label="Department" value={deptName || 'Not assigned'} hint="Set by an administrator." />
        <ReadOnlyField label="Member since" value={createdAt ? formatDateTime(createdAt) : '—'} hint="When this account was created." />
      </div>
    </div>
  );
}

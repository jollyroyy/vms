// Add / edit a head of department by name + email.
// Only one of these is mounted at a time (the manager owns which card is open),
// so the label associations stay unambiguous.
import React, { useId, useState } from 'react';
import type { HodInput } from '../../lib/adminHods';
import { PERSON_NAME_MAX } from '../../lib/inputRules';

type Props = {
  initial?: HodInput;
  busy?: boolean;
  onSubmit: (input: HodInput) => void;
  onCancel: () => void;
};

export default function HodForm({ initial, busy = false, onSubmit, onCancel }: Props): React.ReactElement {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const uid = useId();
  const nameId = `hod-name-${uid}`;
  const emailId = `hod-email-${uid}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ fullName, email });
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/[0.06] to-accent-500/[0.03] p-4 space-y-3 animate-fade-in"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={nameId} className="label">HOD Name</label>
          <input
            id={nameId}
            placeholder="e.g. Asha Rao"
            maxLength={PERSON_NAME_MAX}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={emailId} className="label">Email</label>
          {/* Deliberately type="text": native email validation would silently
              swallow the submit, hiding our own (stricter) validateHod message. */}
          <input
            id={emailId}
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="asha@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary !px-4 !py-2 !text-xs">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary !px-4 !py-2 !text-xs">
          {busy ? 'Saving…' : 'Save HOD'}
        </button>
      </div>
    </form>
  );
}

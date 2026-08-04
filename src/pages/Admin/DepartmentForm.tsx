// Add / edit department form. Used twice: once as the "create" card at the top of
// the manager, and once inline inside a department card when editing.
import React, { useId, useState } from 'react';
import { DEPT_CODE_MAX, type DepartmentInput } from '../../lib/adminDepartments';
import { DEPT_NAME_MAX } from '../../lib/inputRules';

type Props = {
  mode: 'create' | 'edit';
  initial?: DepartmentInput;
  busy?: boolean;
  onSubmit: (input: DepartmentInput) => void;
  onCancel?: () => void;
};

export default function DepartmentForm({
  mode, initial, busy = false, onSubmit, onCancel,
}: Props): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const uid = useId();
  const nameId = `dept-name-${uid}`;
  const codeId = `dept-code-${uid}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, code });
  };

  return (
    <form onSubmit={submit} className="flex gap-3 flex-wrap items-end">
      <div className="flex-1 min-w-[10rem]">
        <label htmlFor={nameId} className="label">Department Name</label>
        {/* No `required`: validateDepartment owns the messaging, and native
            validation would silently swallow the submit instead. */}
        <input
          id={nameId}
          placeholder="e.g. Human Resources"
          maxLength={DEPT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
      </div>
      <div className="w-32">
        <label htmlFor={codeId} className="label">Code</label>
        <input
          id={codeId}
          placeholder="HR"
          maxLength={DEPT_CODE_MAX}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input uppercase font-mono tracking-wider"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary shrink-0">
        {mode === 'create'
          ? (busy ? 'Adding…' : 'Add Department')
          : (busy ? 'Saving…' : 'Save Department')}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn-secondary shrink-0">Cancel</button>
      )}
    </form>
  );
}

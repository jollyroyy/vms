import React from 'react';
import type { Department, Profile, VisitorPurpose } from '../../types/index';

// The typed half of the walk-in register: who the visitor is, who they are here
// to see, and what the approver should know. Split out of WalkInRequest when
// that file crossed the 300-line cap; it owns no state and performs no write,
// so the parent is still the one place the form's rules live.

/** Mirrors the visits_remarks_length CHECK in migration 068. The input caps the
 *  text so the guard sees the limit while typing; the constraint is what
 *  actually enforces it, since any token can POST to PostgREST directly. */
export const REMARKS_MAX = 500;

export const PURPOSES: { value: VisitorPurpose; label: string }[] = [
  { value: 'meeting',     label: 'Meeting' },
  { value: 'vendor',      label: 'Vendor / Contractor' },
  { value: 'interview',   label: 'Interview' },
  { value: 'delivery',    label: 'Delivery / Courier' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'audit',       label: 'Audit / Inspection' },
  { value: 'other',       label: 'Other' },
];

const FIELD = 'w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all';
const LABEL = 'text-xs font-semibold text-navy-600 mb-1 block';

type Props = {
  phone: string;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  fullName: string;
  onFullNameChange: (value: string) => void;
  vendorName: string;
  onVendorNameChange: (value: string) => void;
  purpose: VisitorPurpose;
  onPurposeChange: (value: VisitorPurpose) => void;
  departments: Department[];
  deptId: string;
  onDeptIdChange: (value: string) => void;
  hosts: Profile[];
  hostId: string;
  onHostIdChange: (value: string) => void;
  hostError: string | null;
  remarks: string;
  onRemarksChange: (value: string) => void;
};

export default function WalkInVisitorFields({
  phone, onPhoneChange, onPhoneBlur, fullName, onFullNameChange,
  vendorName, onVendorNameChange, purpose, onPurposeChange,
  departments, deptId, onDeptIdChange, hosts, hostId, onHostIdChange, hostError,
  remarks, onRemarksChange,
}: Props): React.ReactElement {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="walkin-phone" className={LABEL}>Phone *</label>
          <input id="walkin-phone" type="tel" required maxLength={20} value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onBlur={onPhoneBlur} placeholder="98xxx xxxxx" className={FIELD} />
        </div>
        <div>
          <label htmlFor="walkin-name" className={LABEL}>Visitor Name *</label>
          <input id="walkin-name" type="text" required value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Visitor name" className={FIELD} />
        </div>
        <div>
          <label htmlFor="walkin-vendor" className={LABEL}>Vendor Name</label>
          <input id="walkin-vendor" type="text" value={vendorName}
            onChange={(e) => onVendorNameChange(e.target.value)}
            placeholder="Optional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="walkin-purpose" className={LABEL}>Purpose *</label>
          <select id="walkin-purpose" required value={purpose}
            onChange={(e) => onPurposeChange(e.target.value as VisitorPurpose)} className={FIELD}>
            {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="walkin-dept" className={LABEL}>Department *</label>
          <select id="walkin-dept" required value={deptId}
            onChange={(e) => onDeptIdChange(e.target.value)} className={FIELD}>
            <option value="">Select</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="walkin-host" className={LABEL}>Person to Meet *</label>
          <select id="walkin-host" required value={hostId}
            onChange={(e) => onHostIdChange(e.target.value)}
            className={`${FIELD} disabled:opacity-50`} disabled={!deptId}>
            <option value="">{deptId ? 'Select' : 'Select dept first'}</option>
            {hosts.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
          </select>
          {hostError && <p className="text-xs text-danger-500 mt-0.5">{hostError}</p>}
        </div>
      </div>

      {/* The HOD approves a walk-in blind — they get a name, a vendor and a
          purpose off a seven-item list. This is where the guard passes on what
          they can actually see and hear at the gate, and it is the difference
          between an informed approval and a guess. Optional on purpose: never
          hold up a queue for a text box. */}
      <div>
        <label htmlFor="walkin-remarks" className={LABEL}>
          Remarks <span className="font-normal text-navy-400">(optional — shown to the person approving)</span>
        </label>
        <textarea
          id="walkin-remarks"
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          maxLength={REMARKS_MAX}
          rows={2}
          placeholder="Anything the approver should know — e.g. &ldquo;says he has a 3pm with you&rdquo;, &ldquo;van waiting at gate 2&rdquo;"
          className={`${FIELD} resize-y`}
        />
        <p className="text-[10px] text-navy-400 mt-0.5 text-right tabular-nums">{remarks.length}/{REMARKS_MAX}</p>
      </div>
    </>
  );
}

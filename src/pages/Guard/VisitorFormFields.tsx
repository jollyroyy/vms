import React from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import type { Department, Profile, VisitorPurpose } from '../../types/index';

const PURPOSES: { value: VisitorPurpose; label: string }[] = [
  { value: 'meeting',     label: 'Meeting' },
  { value: 'vendor',      label: 'Vendor / Contractor' },
  { value: 'interview',   label: 'Interview' },
  { value: 'delivery',    label: 'Delivery / Courier' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'audit',       label: 'Audit / Inspection' },
  { value: 'other',       label: 'Other' },
];

const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driver Licence', 'Voter ID'];

type Props = {
  phone: string;
  onPhoneChange: (v: string) => void;
  onPhoneBlur: () => void;
  fullName: string;
  onFullNameChange: (v: string) => void;
  vendorName: string;
  onVendorNameChange: (v: string) => void;
  purpose: VisitorPurpose;
  onPurposeChange: (v: VisitorPurpose) => void;
  deptId: string;
  onDeptChange: (v: string) => void;
  departments: Department[];
  hostId: string;
  onHostChange: (v: string) => void;
  hosts: Profile[];
  hostError: string | null;
  onRetryHosts: () => void;
  idType: string;
  onIdTypeChange: (v: string) => void;
  idLast4: string;
  onIdLast4Change: (v: string) => void;
  onScanId?: () => void;
  vehicle: string;
  onVehicleChange: (v: string) => void;
  carryingMaterial: boolean;
  onCarryingMaterialChange: (v: boolean) => void;
  photoBlob: Blob | null;
  onPhotoCapture: (blob: Blob) => void;
  onRetakePhoto: () => void;
  submitting: boolean;
  blacklistHit: string | null;
  activeVisitChecking: boolean;
};

export default function VisitorFormFields({
  phone, onPhoneChange, onPhoneBlur, fullName, onFullNameChange, vendorName, onVendorNameChange,
  purpose, onPurposeChange, deptId, onDeptChange, departments, hostId, onHostChange, hosts,
  hostError, onRetryHosts, idType, onIdTypeChange, idLast4, onIdLast4Change, onScanId, vehicle, onVehicleChange,
  carryingMaterial, onCarryingMaterialChange, photoBlob, onPhotoCapture, onRetakePhoto, submitting,
  blacklistHit, activeVisitChecking,
}: Props): React.ReactElement {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Mobile Number *</label>
          <input type="tel" required maxLength={20} value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onBlur={onPhoneBlur} placeholder="+91 98765 43210" className="input" />
        </div>
        <div><label className="label">Visitor Name *</label><input type="text" required maxLength={100} value={fullName} onChange={(e) => onFullNameChange(e.target.value)} className="input" /></div>
        <div><label className="label">Vendor Name *</label><input type="text" required maxLength={200} value={vendorName} onChange={(e) => onVendorNameChange(e.target.value)} className="input" /></div>
        <div>
          <label className="label">Purpose *</label>
          <select required value={purpose} onChange={(e) => onPurposeChange(e.target.value as VisitorPurpose)} className="input">
            {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department *</label>
          <select required value={deptId} onChange={(e) => onDeptChange(e.target.value)} className="input">
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Person to Meet *</label>
          <select required value={hostId} onChange={(e) => onHostChange(e.target.value)} className="input" disabled={!deptId}>
            <option value="">{deptId ? 'Select person' : 'Select department first'}</option>
            {hosts.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
          </select>
          {hostError && (
            <p className="text-xs text-danger-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              {hostError}
              <button type="button" onClick={onRetryHosts} className="ml-1 font-semibold text-brand-600 hover:text-brand-800 underline">Retry</button>
            </p>
          )}
        </div>
        <div>
          <label className="label">Govt ID Type</label>
          <select value={idType} onChange={(e) => onIdTypeChange(e.target.value)} className="input">
            <option value="">Optional</option>
            {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">ID Last 4 Digits</label><input type="text" maxLength={4} value={idLast4} onChange={(e) => onIdLast4Change(e.target.value)} className="input" placeholder="XXXX" /></div>
        {onScanId && (
          <div className="sm:col-span-2">
            <button type="button" onClick={onScanId}
              className="w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
              Scan ID card
            </button>
          </div>
        )}
        <div className="sm:col-span-2"><label className="label">Vehicle Number (optional)</label><input type="text" maxLength={20} value={vehicle} onChange={(e) => onVehicleChange(e.target.value)} className="input" placeholder="MH 12 AB 1234" /></div>
        <div className="sm:col-span-2">
          <label className="label flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={carryingMaterial} onChange={(e) => onCarryingMaterialChange(e.target.checked)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
            Carrying material / equipment
          </label>
        </div>
      </div>

      <div>
        <label className="label mb-2 block">Visitor Photo *</label>
        {!photoBlob ? (
          <PhotoCapture onCapture={onPhotoCapture} />
        ) : (
          <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl border border-surface-200">
            <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl shadow-xs" />
            <div className="flex-1">
              <p className="text-sm font-medium text-navy-700">Photo captured</p>
              <p className="text-xs text-navy-500 dark:text-navy-400">Ready to submit</p>
            </div>
            <button type="button" onClick={onRetakePhoto} className="btn-ghost text-danger-600 hover:text-danger-700 text-sm">Retake</button>
          </div>
        )}
      </div>

      {/* Emergency Contact & Expected Duration */}
      <div className="card p-5 space-y-4 bg-amber-50/30 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/25 rounded-xl">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          Visit Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={submitting || !!blacklistHit || !photoBlob || activeVisitChecking}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl px-5 py-3.5 text-sm font-bold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200">
        {submitting ? (
          <span className="flex items-center justify-center gap-2.5">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Registering...
          </span>
        ) : 'Submit for HOD Approval'}
      </button>

      <p className="text-xs text-navy-300 text-center">Photographs captured for security purposes only</p>
    </>
  );
}

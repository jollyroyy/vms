import React from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import AuroraBackdrop from './KioskAuroraBackdrop';
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

type Props = {
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  phone: string;
  fullName: string;
  onFullNameChange: (v: string) => void;
  company: string;
  onCompanyChange: (v: string) => void;
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
  photoBlob: Blob | null;
  onPhotoCapture: (blob: Blob) => void;
  onRetakePhoto: () => void;
  submitting: boolean;
};

export default function KioskFormScreen({
  error, onSubmit, onBack, phone, fullName, onFullNameChange, company, onCompanyChange,
  purpose, onPurposeChange, deptId, onDeptChange, departments, hostId, onHostChange, hosts,
  hostError, onRetryHosts, photoBlob, onPhotoCapture, onRetakePhoto, submitting,
}: Props): React.ReactElement {
  return (
    <div className="relative min-h-screen overflow-y-auto">
      <AuroraBackdrop />
      <div className="relative max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="btn-icon -ml-2" title="Back">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-navy-950 font-display">Visitor Registration</h1>
            <p className="text-sm text-navy-400">Complete the form to register your visit</p>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-4">
            <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="card p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="label">Mobile Number</label>
              <input type="tel" value={phone} disabled className="input bg-surface-100 text-navy-500" />
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input type="text" required maxLength={100} value={fullName} onChange={(e) => onFullNameChange(e.target.value)} className="input" placeholder="e.g. John Doe" autoFocus />
            </div>
            <div>
              <label className="label">Company / Coming from *</label>
              <input type="text" required maxLength={200} value={company} onChange={(e) => onCompanyChange(e.target.value)} className="input" placeholder="e.g. ABC Corp" />
            </div>
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
          </div>

          <div>
            <label className="label mb-2 block">Photo *</label>
            {!photoBlob ? (
              <PhotoCapture onCapture={onPhotoCapture} />
            ) : (
              <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl border">
                <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-700">Photo captured</p>
                  <p className="text-xs text-navy-400">Ready to submit</p>
                </div>
                <button type="button" onClick={onRetakePhoto} className="btn-ghost text-danger-600 text-sm">Retake</button>
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting || !photoBlob}
            className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl px-5 py-4 text-base font-bold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] disabled:opacity-50 shadow-soft transition-all">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Submitting...
              </span>
            ) : 'Submit for HOD Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}

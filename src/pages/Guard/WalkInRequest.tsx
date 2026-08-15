import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { useDepartments } from '../../lib/useDepartments';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';
import type { Profile, VisitorPurpose } from '../../types/index';

// Mirrors the visits_remarks_length CHECK in migration 068. The input caps the
// text so the guard sees the limit while typing; the constraint is what actually
// enforces it, since any token can POST to PostgREST directly.
const REMARKS_MAX = 500;

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
  onSubmitted: (name: string) => void;
  /** Close the form without submitting. OMITTED on /guard/walk-in, where the
   *  form IS the page — a Cancel button there would close nothing and leave the
   *  guard staring at the same screen, which is the defect that made the old
   *  Deny Entry link a no-op. */
  onCancel?: () => void;
};

export default function WalkInRequest({ onSubmitted, onCancel }: Props): React.ReactElement {
  const { departments } = useDepartments();
  const [hosts, setHosts] = useState<Profile[]>([]);
  const [blacklist, setBlacklist] = useState<{ phone: string; reason: string }[]>([]);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [idType, setIdType] = useState('');
  const [idLast4, setIdLast4] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [purpose, setPurpose] = useState<VisitorPurpose>('meeting');
  const [remarks, setRemarks] = useState('');
  const [deptId, setDeptId] = useState('');
  const [hostId, setHostId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hostError, setHostError] = useState<string | null>(null);
  const [blacklistHit, setBlacklistHit] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('visitors').select('phone, blacklist_reason').eq('is_blacklisted', true).then(({ data }) => {
      setBlacklist((data ?? []).map((r) => ({ phone: r.phone, reason: r.blacklist_reason ?? 'Flagged' })));
    });
  }, []);

  const loadHosts = useCallback(async (departmentId: string) => {
    setHostError(null);
    try {
      const { data, error } = await (supabase as any).rpc('get_hosts_for_department', { dept_id: departmentId });
      if (error) throw error;
      setHosts((data ?? []) as Profile[]);
    } catch {
      setHostError('Could not load the person to meet list.');
      setHosts([]);
    }
  }, []);

  useEffect(() => {
    if (!deptId) { setHosts([]); setHostError(null); return; }
    void loadHosts(deptId);
  }, [deptId, loadHosts]);

  const applyScanResult = useCallback((r: IdScanResult) => {
    if (r.idType) setIdType(r.idType);
    if (r.idLast4) setIdLast4(r.idLast4);
    if (r.name && !fullName.trim()) setFullName(r.name);
    setScanOpen(false);
  }, [fullName]);

  const handlePhoneBlur = useCallback(async () => {
    if (!phone) return;
    try {
      const normalized = normalizePhone(phone);
      const hit = isBlacklisted(phone, blacklist);
      if (hit) { setBlacklistHit(hit.reason); return; }
      setBlacklistHit(null);
      const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
      if (data) { setFullName(data.full_name); setVendorName(data.vendor_name ?? ''); }
    } catch { /* ignore */ }
  }, [phone, blacklist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) return;
    if (!hostId) { setError('Please select a person to meet.'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Please enter a valid 10-digit mobile number.'); }
      const { data: existingVisit } = await (supabase as any).rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) { throw new Error(`This phone has an active visit (Ref: ${existingVisit.ref_number}). Complete it first.`); }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, vendor_name: vendorName || null, id_type: idType || null, id_last4: idLast4 || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create visitor record.');
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        status: 'pending_approval', carrying_material: false,
        // Trimmed to null rather than stored as '': an empty note and no note
        // are the same fact, and only one of them should be in the column.
        remarks: remarks.trim() || null,
        photo_path: null, photo_data: null,
        scheduled_for: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      onSubmitted(fullName);
    } catch (err) { setError(safeErrorMessage(err, 'Request failed.')); }
    finally { setSubmitting(false); }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-dashed border-brand-300/30 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-navy-900">Not found — request walk-in approval</p>
          <p className="text-xs text-navy-500 dark:text-navy-400">HOD will be notified to approve</p>
        </div>
      </div>

      {blacklistHit && (
        <div className="bg-danger-50 border border-danger-200 dark:border-danger-500/25 rounded-xl p-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <p className="text-sm text-danger-700 font-semibold">Blacklisted — {blacklistHit}</p>
        </div>
      )}

      {error && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Phone *</label>
            <input type="tel" required maxLength={20} value={phone}
              onChange={(e) => { setPhone(e.target.value); setBlacklistHit(null); }}
              onBlur={handlePhoneBlur} placeholder="98xxx xxxxx" className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Visitor Name *</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Visitor name" className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
            <button type="button" onClick={() => setScanOpen(true)}
              className="mt-1.5 w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
              Scan ID card
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Vendor Name</label>
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Optional" className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Purpose *</label>
            <select required value={purpose} onChange={(e) => setPurpose(e.target.value as VisitorPurpose)} className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all">
              {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Department *</label>
            <select required value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all">
              <option value="">Select</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-navy-600 mb-1 block">Person to Meet *</label>
            <select required value={hostId} onChange={(e) => setHostId(e.target.value)} className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all disabled:opacity-50" disabled={!deptId}>
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
          <label htmlFor="walkin-remarks" className="text-xs font-semibold text-navy-600 mb-1 block">
            Remarks <span className="font-normal text-navy-400">(optional — shown to the person approving)</span>
          </label>
          <textarea
            id="walkin-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={REMARKS_MAX}
            rows={2}
            placeholder="Anything the approver should know — e.g. &ldquo;says he has a 3pm with you&rdquo;, &ldquo;van waiting at gate 2&rdquo;"
            className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-y"
          />
          <p className="text-[10px] text-navy-400 mt-0.5 text-right tabular-nums">{remarks.length}/{REMARKS_MAX}</p>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-2.5 text-sm transition-all">Cancel</button>
        )}
        <button type="submit" disabled={submitting || !!blacklistHit}
          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Sending...</>
          ) : 'Send Request'}
        </button>
      </div>
    </form>
    {scanOpen && (
      <IdScanOverlay
        onScanned={applyScanResult}
        onClose={() => setScanOpen(false)}
      />
    )}
    </>
  );
}

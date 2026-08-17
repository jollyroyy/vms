import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { namesMatch } from '../../lib/ai/nameMatch';
import { safeErrorMessage } from '../../lib/errors';
import { useDepartments } from '../../lib/useDepartments';
import { uploadPhoto } from '../../lib/photoUpload';
import type { IdScanResult } from './idScanTypes';
import WalkInIdentityStep from './WalkInIdentityStep';
import WalkInVisitorFields from './WalkInVisitorFields';
import type { Profile, VisitorPurpose } from '../../types/index';

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
  const [scan, setScan] = useState<IdScanResult | null>(null);
  // The guard's leniency for a scan that names somebody else (migration 097).
  // Cleared by every change to the scan AND by every change to the typed name,
  // because it is a decision about one specific disagreement between the two.
  const [idOverride, setIdOverride] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [purpose, setPurpose] = useState<VisitorPurpose>('meeting');
  const [remarks, setRemarks] = useState('');
  const [deptId, setDeptId] = useState('');
  const [hostId, setHostId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hostError, setHostError] = useState<string | null>(null);
  const [blacklistHit, setBlacklistHit] = useState<string | null>(null);
  // Bumped on every successful submit to REMOUNT the identity step. Nulling
  // `photoBlob` is not enough on its own: PhotoCapture owns the frozen preview
  // internally, so the previous visitor's face would stay on screen under a
  // "Use Photo" button while the parent believed no photo was attached.
  const [identityKey, setIdentityKey] = useState(0);

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
    setScan(r);
    setIdOverride(false);
    if (r.name && !fullName.trim()) setFullName(r.name);
    setScanOpen(false);
  }, [fullName]);

  // Recomputed here as well as inside WalkInIdentityStep, from the same
  // `namesMatch`, because the submit gate below cannot ask a child component
  // what it is currently rendering. One function, two readers — never two rules.
  const nameMismatch = Boolean(scan?.name) && fullName.trim() !== ''
    && !namesMatch(scan?.name ?? null, fullName.trim());
  const mismatchBlocking = nameMismatch && !idOverride;

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

  // A submitted request is finished business, and the next person at the gate is
  // a different visitor. On /guard/walk-in the form IS the page and never
  // unmounts, so without this the guard registered them on top of the last
  // visitor's name, phone, vendor and remarks — with the mandatory ID scan and
  // photo still reading as satisfied, which is the half that could have sent an
  // approver a face belonging to somebody else. Only called on success: a failed
  // insert must leave every typed value where it is, since the visitor is still
  // standing there.
  const resetForm = useCallback(() => {
    setPhone(''); setFullName(''); setVendorName('');
    setPurpose('meeting'); setRemarks('');
    setDeptId(''); setHostId('');
    setScan(null); setIdOverride(false); setPhotoBlob(null); setScanOpen(false);
    setError(''); setBlacklistHit(null);
    setIdentityKey((k) => k + 1);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) return;
    if (!hostId) { setError('Please select a person to meet.'); return; }
    // Both are structurally gated (the submit button is disabled without them),
    // so these messages are the belt to that braces — a form submitted with
    // Enter must not be able to skip the identity step either.
    if (!scan) { setError('Scan the visitor’s ID card before sending the request.'); return; }
    if (!photoBlob) { setError('Capture the visitor’s photo before sending the request.'); return; }
    if (mismatchBlocking) { setError('The scanned ID names somebody else. Correct the name, rescan, or use “send anyway”.'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Please enter a valid 10-digit mobile number.'); }
      const { data: existingVisit } = await (supabase as any).rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) { throw new Error(`This phone has an active visit (Ref: ${existingVisit.ref_number}). Complete it first.`); }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, vendor_name: vendorName || null, id_type: scan.idType || null, id_last4: scan.idLast4 || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create visitor record.');
      // The photo goes up BEFORE the visit row, so a request never reaches an
      // approver without the face it is asking them to clear. uploadPhoto falls
      // back to a base64 data URL when storage hiccups, so a bucket outage
      // degrades the record rather than blocking the gate.
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        status: 'pending_approval', carrying_material: false,
        // Recorded, never explained — see migration 097. False is the honest
        // value for every request where the two names agreed.
        id_match_overridden: idOverride,
        // Trimmed to null rather than stored as '': an empty note and no note
        // are the same fact, and only one of them should be in the column.
        remarks: remarks.trim() || null,
        photo_path: photoPath, photo_data: photoData,
        scheduled_for: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      resetForm();
      onSubmitted(fullName);
    } catch (err) { setError(safeErrorMessage(err, 'Request failed.')); }
    finally { setSubmitting(false); }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-dashed border-brand-300/30 space-y-4 animate-fade-in">
      {/* The header names what this form DOES, not the search that failed to
          find a pass. It stopped being the "no match found" fallback when the
          register became its own destination (/guard/walk-in) — the guard
          reaching it now chose it from the nav, and telling them something was
          "not found" describes a search they never ran. */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-navy-900">Register a walk-in visitor</p>
          <p className="text-xs text-navy-500">The person to meet is asked to approve before entry</p>
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
        <WalkInVisitorFields
          phone={phone}
          onPhoneChange={(v) => { setPhone(v); setBlacklistHit(null); }}
          onPhoneBlur={() => { void handlePhoneBlur(); }}
          fullName={fullName}
          onFullNameChange={(v) => { setFullName(v); setIdOverride(false); }}
          vendorName={vendorName}
          onVendorNameChange={setVendorName}
          purpose={purpose}
          onPurposeChange={setPurpose}
          departments={departments}
          deptId={deptId}
          onDeptIdChange={setDeptId}
          hosts={hosts}
          hostId={hostId}
          onHostIdChange={setHostId}
          hostError={hostError}
          remarks={remarks}
          onRemarksChange={setRemarks}
        />

        <WalkInIdentityStep
          key={identityKey}
          scan={scan}
          visitorName={fullName}
          overridden={idOverride}
          onOverride={() => setIdOverride(true)}
          scanOpen={scanOpen}
          onOpenScan={() => setScanOpen(true)}
          onCloseScan={() => setScanOpen(false)}
          onScanned={applyScanResult}
          onDiscardScan={() => { setScan(null); setIdOverride(false); }}
          photoTaken={photoBlob !== null}
          onPhoto={setPhotoBlob}
        />
      </div>

      {/* .btn-primary / .btn-secondary rather than a bespoke pair: this is the
          one submit in the guard's day that hands a decision to somebody else,
          and it should look like every other primary action in the app — the
          gold gradient, the inset highlight and the lift are defined once in
          components-forms.css, so a rebrand moves this button too. */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-3 font-semibold">Cancel</button>
        )}
        <button type="submit" disabled={submitting || !!blacklistHit || !scan || !photoBlob || mismatchBlocking}
          className="btn-primary flex-1 py-3 text-[15px] font-bold flex items-center justify-center gap-2">
          {submitting ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Sending request…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              Send approval request
            </>
          )}
        </button>
      </div>
    </form>
    </>
  );
}

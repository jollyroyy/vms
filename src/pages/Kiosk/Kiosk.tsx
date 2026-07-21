import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import PhotoCapture from '../../components/PhotoCapture';
import DocumentSign from '../../components/DocumentSign';
import Badge from '../../components/Badge';
import type { Department, Profile, Visit, VisitorPurpose } from '../../types/index';

const PURPOSES: { value: VisitorPurpose; label: string }[] = [
  { value: 'meeting',     label: 'Meeting' },
  { value: 'vendor',      label: 'Vendor / Contractor' },
  { value: 'interview',   label: 'Interview' },
  { value: 'delivery',    label: 'Delivery / Courier' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'audit',       label: 'Audit / Inspection' },
  { value: 'other',       label: 'Other' },
];

type Step = 'idle' | 'phone' | 'form' | 'badge';

export default function Kiosk(): React.ReactElement {
  const [step, setStep] = useState<Step>('idle');

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState<VisitorPurpose>('meeting');
  const [deptId, setDeptId] = useState('');
  const [hostId, setHostId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hosts, setHosts] = useState<Profile[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [privacySignature, setPrivacySignature] = useState<string | null>(null);
  const [consentSiteRules, setConsentSiteRules] = useState(false);
  const [siteRulesSignature, setSiteRulesSignature] = useState<string | null>(null);
  const [ndaSignature, setNdaSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recalledName, setRecalledName] = useState<string | null>(null);
  const [blacklist, setBlacklist] = useState<{ phone: string; reason: string }[]>([]);
  const [blacklistHit, setBlacklistHit] = useState<string | null>(null);
  const [preApprovedVisit, setPreApprovedVisit] = useState<{ id: string; ref_number: string; visitor_name: string; dept_name: string; purpose: string; photo_data: string | null } | null>(null);
  const [checkingInPreApproved, setCheckingInPreApproved] = useState(false);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [hostError, setHostError] = useState<string | null>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? []));
    supabase.from('visitors').select('phone, blacklist_reason').eq('is_blacklisted', true).then(({ data }) => {
      setBlacklist((data ?? []).map((r) => ({ phone: r.phone, reason: r.blacklist_reason ?? 'Flagged' })));
    });
  }, []);

  useEffect(() => {
    if (!deptId) { setHosts([]); setHostError(null); return; }
    setHostError(null);
    fetch(`/api/hosts/${deptId}`)
      .then((r) => { if (!r.ok) throw new Error(`Server error (${r.status})`); return r.json(); })
      .then((data) => setHosts(data ?? []))
      .catch((err) => { console.error('Failed to load hosts:', err.message); setHostError('Could not load person-to-meet list.'); setHosts([]); });
  }, [deptId]);

  const resetAll = useCallback(() => {
    setStep('idle');
    setPhone('');
    setFullName('');
    setCompany('');
    setPurpose('meeting');
    setDeptId('');
    setHostId('');
    setPhotoBlob(null);
    setConsentPrivacy(false);
    setPrivacySignature(null);
    setConsentSiteRules(false);
    setSiteRulesSignature(null);
    setNdaSignature(null);
    setError('');
    setSuccessMsg('');
    setRecalledName(null);
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    setBadgeVisit(null);
    setResetCountdown(0);
    setHostError(null);
    setSubmitting(false);
    setCheckingInPreApproved(false);
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => { resetAll(); }, 60000);
  }, [resetAll]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const showBadgeWithCountdown = useCallback((visit: Visit) => {
    setBadgeVisit(visit);
    setStep('badge');
    setResetCountdown(15);
    countdownRef.current = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          resetAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetAll]);

  const recallByPhone = useCallback(async () => {
    if (!phone) return;
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { return; }
    const hit = isBlacklisted(phone, blacklist);
    if (hit) { setBlacklistHit(hit.reason); return; }
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
    if (data) {
      const v = data as any;
      setFullName(v.full_name); setCompany(v.company ?? ''); setRecalledName(v.full_name);
      const { data: pre } = await (supabase as any)
        .from('visits')
        .select('id, ref_number, purpose, photo_data, department:departments(name)')
        .eq('visitor_id', v.id)
        .eq('status', 'approved')
        .maybeSingle();
      if (pre) {
        setPreApprovedVisit({
          id: pre.id, ref_number: pre.ref_number, visitor_name: v.full_name,
          dept_name: pre.department?.name ?? '', purpose: pre.purpose, photo_data: pre.photo_data,
        });
      }
    }
  }, [phone, blacklist]);

  const handlePhoneSubmit = async () => {
    if (!phone) return;
    await recallByPhone();
    // recallByPhone sets state async; wait a tick then check
    setTimeout(() => {
      if (blacklistHit) return;
      if (!preApprovedVisit) setStep('form');
    }, 300);
  };

  const checkInPreApproved = async () => {
    if (!preApprovedVisit) return;
    setCheckingInPreApproved(true);
    setError('');
    try {
      const { error: err } = await supabase.from('visits').update({
        status: 'checked_in', checked_in_at: new Date().toISOString(),
      }).eq('id', preApprovedVisit.id);
      if (err) throw err;
      const { data: fullVisit } = await (supabase as any)
        .from('visits')
        .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('id', preApprovedVisit.id)
        .single();
      if (fullVisit) showBadgeWithCountdown(fullVisit as Visit);
    } catch (err) { setError(safeErrorMessage(err, 'Failed to check in pre-approved visitor.')); }
    finally { setCheckingInPreApproved(false); }
  };

  const uploadPhoto = useCallback(async (blob: Blob): Promise<{ photoPath: string | null; photoData: string | null }> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read photo'));
      reader.readAsDataURL(blob);
    });
    const filePath = `visits/${Date.now()}.webp`;
    const { error: uploadErr } = await supabase.storage
      .from('visitor-photos')
      .upload(filePath, blob, { contentType: 'image/webp', upsert: true });
    if (uploadErr) {
      console.warn('[kiosk] Storage upload failed, using base64 only:', uploadErr.message);
      return { photoPath: null, photoData: base64 };
    }
    const { data: urlData } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBlob) { setError('Photo is required.'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Enter a valid 10-digit mobile number.'); }
      const { data: existingVisit } = await (supabase as any)
        .rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) {
        setError(`This phone has an active visit (Ref: ${existingVisit.ref_number}).`);
        setSubmitting(false); return;
      }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, company: company || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create visitor record.');
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: false,
        emergency_contact_name: null, emergency_contact_phone: null, expected_duration_minutes: null,
        consent_privacy: consentPrivacy, consent_site_rules: consentSiteRules,
        nda_signature: ndaSignature, privacy_signature: privacySignature,
        site_rules_signature: siteRulesSignature,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      setSuccessMsg(`Registration submitted — awaiting HOD approval.`);
      setStep('badge');
      setResetCountdown(12);
      countdownRef.current = setInterval(() => {
        setResetCountdown((prev) => {
          if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); resetAll(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) { setError(safeErrorMessage(err, 'Registration failed.')); }
    finally { setSubmitting(false); }
  };

  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-brand-950 p-8">
      <div className="animate-fade-in text-center max-w-lg">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto shadow-glow ring-4 ring-brand-500/20 mb-8">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">SecureGate</h1>
        <p className="text-lg text-brand-300/80 mb-2">Visitor Self Check-in Kiosk</p>
        <p className="text-sm text-navy-400 mb-12">Touch the screen to begin</p>
        <button onClick={() => { clearIdleTimer(); setStep('phone'); }}
          className="w-64 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-2xl px-8 py-5 text-xl font-bold hover:from-brand-600 hover:to-brand-700 active:scale-[0.97] shadow-soft hover:shadow-glow transition-all duration-200 animate-soft-pulse">
          Tap to Start
        </button>
        <p className="text-xs text-navy-500 mt-8">Tap anywhere or press any key</p>
      </div>
    </div>
  );

  const renderPhone = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-brand-950 p-8">
      <div className="w-full max-w-md animate-fade-in">
        <button onClick={() => resetAll()} className="text-brand-300 hover:text-white text-sm mb-8 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back
        </button>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome</h2>
          <p className="text-brand-300/80">Enter your mobile number to check in</p>
        </div>
        <input type="tel" autoFocus maxLength={20} value={phone}
          onChange={(e) => { setPhone(e.target.value); setRecalledName(null); setBlacklistHit(null); setPreApprovedVisit(null); }}
          onBlur={recallByPhone}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSubmit(); if (e.key === 'Escape') resetAll(); }}
          placeholder="+91 98765 43210"
          className="w-full text-center text-2xl bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-5 text-white placeholder-white/30 outline-none focus:border-brand-400 focus:bg-white/15 transition-all" />
        <div className="flex gap-3 mt-6">
          <button onClick={() => resetAll()} className="flex-1 bg-white/10 text-white rounded-xl px-6 py-4 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition-all">Cancel</button>
          <button onClick={handlePhoneSubmit} className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl px-6 py-4 text-lg font-bold hover:from-brand-600 hover:to-brand-700 active:scale-[0.98] shadow-soft transition-all">Check In</button>
        </div>
        {recalledName && !blacklistHit && !preApprovedVisit && (
          <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/10 text-center">
            <p className="text-white font-medium">Welcome back, {recalledName}</p>
            <p className="text-brand-300 text-sm mt-1">Fill in the details to continue</p>
          </div>
        )}
        {preApprovedVisit && (
          <div className="mt-6 p-6 bg-success-900/40 rounded-2xl border border-success-500/30 space-y-4 text-center">
            <div className="h-14 w-14 rounded-full bg-success-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-white text-xl font-bold">{preApprovedVisit.visitor_name}</p>
              <p className="text-success-300 text-sm mt-1">Pre-approved for {preApprovedVisit.dept_name}</p>
              <p className="text-success-300/70 text-xs mt-1">Ref: {preApprovedVisit.ref_number}</p>
            </div>
            <button onClick={checkInPreApproved} disabled={checkingInPreApproved}
              className="w-full bg-gradient-to-r from-success-500 to-success-600 text-white rounded-xl px-6 py-4 text-lg font-bold hover:from-success-600 hover:to-success-700 active:scale-[0.98] disabled:opacity-50 transition-all">
              {checkingInPreApproved ? 'Checking in...' : 'Tap to Check In'}
            </button>
          </div>
        )}
        {blacklistHit && (
          <div className="mt-6 p-4 bg-danger-900/40 rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-300 font-bold">ACCESS DENIED</p>
            <p className="text-danger-400 text-sm mt-1">{blacklistHit}</p>
          </div>
        )}
        {error && (
          <div className="mt-6 p-4 bg-danger-900/40 rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-300">{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="min-h-screen bg-surface-50 overflow-y-auto" onClick={() => startIdleTimer()}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setStep('phone'); setError(''); }} className="btn-ghost p-2 -ml-2" title="Back">
            <svg className="w-5 h-5 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-navy-950">Visitor Registration</h1>
            <p className="text-sm text-navy-400">Complete the form to register your visit</p>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-4">
            <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="label">Mobile Number</label>
              <input type="tel" value={phone} disabled className="input bg-surface-100 text-navy-500" />
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input type="text" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="e.g. John Doe" />
            </div>
            <div>
              <label className="label">Company / Coming from *</label>
              <input type="text" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} className="input" placeholder="e.g. ABC Corp" />
            </div>
            <div>
              <label className="label">Purpose *</label>
              <select required value={purpose} onChange={(e) => setPurpose(e.target.value as VisitorPurpose)} className="input">
                {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department *</label>
              <select required value={deptId} onChange={(e) => setDeptId(e.target.value)} className="input">
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Person to Meet *</label>
              <select required value={hostId} onChange={(e) => setHostId(e.target.value)} className="input" disabled={!deptId}>
                <option value="">{deptId ? 'Select person' : 'Select department first'}</option>
                {hosts.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
              </select>
              {hostError && <p className="text-xs text-danger-600 mt-1">{hostError}</p>}
            </div>
          </div>

          <div>
            <label className="label mb-2 block">Photo *</label>
            {!photoBlob ? (
              <PhotoCapture onCapture={(blob) => setPhotoBlob(blob)} />
            ) : (
              <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl border">
                <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-700">Photo captured</p>
                  <p className="text-xs text-navy-400">Ready to submit</p>
                </div>
                <button type="button" onClick={() => setPhotoBlob(null)} className="btn-ghost text-danger-600 text-sm">Retake</button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consentPrivacy} onChange={(e) => { setConsentPrivacy(e.target.checked); if (!e.target.checked) setPrivacySignature(null); }} className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600" />
              <div>
                <p className="text-sm font-medium text-navy-800">I consent to the Privacy Policy</p>
                <p className="text-xs text-navy-400">I understand how my personal data will be processed</p>
              </div>
            </label>
            {consentPrivacy && !privacySignature && (
              <DocumentSign documentTitle="Privacy Policy" documentText="This Visitor Management System collects and processes your personal data for security and record-keeping purposes. Your data is stored securely and never shared with third parties." onSign={(sig) => setPrivacySignature(sig)} required />
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consentSiteRules} onChange={(e) => { setConsentSiteRules(e.target.checked); if (!e.target.checked) setSiteRulesSignature(null); }} className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600" />
              <div>
                <p className="text-sm font-medium text-navy-800">I acknowledge the Site Rules</p>
                <p className="text-xs text-navy-400">I agree to follow all site safety and security rules</p>
              </div>
            </label>
            {consentSiteRules && !siteRulesSignature && (
              <DocumentSign documentTitle="Site Rules" documentText="1. Wear visitor badge at all times. 2. Do not access restricted areas. 3. Follow fire safety procedures. 4. Report suspicious activity. 5. No photography without authorization." onSign={(sig) => setSiteRulesSignature(sig)} required />
            )}
          </div>

          {purpose === 'vendor' && !ndaSignature && (
            <DocumentSign documentTitle="NDA" documentText="You agree to maintain confidentiality of all proprietary information observed during the visit." onSign={(sig) => setNdaSignature(sig)} required />
          )}

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

  const renderBadge = () => (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-8">
      <div className="animate-fade-in text-center max-w-md">
        {badgeVisit ? (
          <div className="mb-6 flex justify-center scale-125 origin-top">
            <Badge visit={badgeVisit} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="h-20 w-20 rounded-full bg-success-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{successMsg}</h2>
          </div>
        )}
        <div className="space-y-4">
          <button onClick={() => window.print()} className="w-64 bg-white/10 text-white rounded-xl px-6 py-4 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mx-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
            Print Badge
          </button>
          <div className="flex items-center justify-center gap-2 text-navy-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            <span>Resetting in {resetCountdown}s</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'idle': return renderIdle();
      case 'phone': return renderPhone();
      case 'form': return renderForm();
      case 'badge': return renderBadge();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-50" onClick={() => { if (step !== 'idle') startIdleTimer(); }}>
      {renderContent()}
    </div>
  );
}

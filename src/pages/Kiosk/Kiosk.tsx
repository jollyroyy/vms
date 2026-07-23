import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import PhotoCapture from '../../components/PhotoCapture';
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

const DARK_STAGE = 'relative min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-accent-900 overflow-hidden';

function AuroraBackdrop(): React.ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/25 blur-3xl animate-aurora" />
      <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-accent-500/20 blur-3xl animate-aurora-alt" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-brand-700/25 blur-3xl animate-aurora" />
    </div>
  );
}

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
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id, full_name, email, role').eq('department_id', deptId).order('full_name');
        if (error) throw error;
        setHosts((data ?? []) as Profile[]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to load hosts:', msg);
        setHostError('Could not load person-to-meet list.');
        setHosts([]);
      }
    })();
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

  const recallByPhone = useCallback(async (): Promise<'blacklisted' | 'pre-approved' | 'found' | 'not-found'> => {
    if (!phone) return 'not-found';
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { return 'not-found'; }
    const hit = isBlacklisted(phone, blacklist);
    if (hit) { setBlacklistHit(hit.reason); return 'blacklisted'; }
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
    if (!data) { setFullName(''); setCompany(''); setRecalledName(null); return 'not-found'; }
    const v = data as any;
    setFullName(v.full_name); setCompany(v.company ?? ''); setRecalledName(v.full_name);
    const { data: pre } = await (supabase as any)
      .from('visits')
      .select('id, ref_number, purpose, photo_data, department:departments(name)')
      .eq('visitor_id', v.id)
      .in('status', ['approved', 'walkin_approved'])
      .maybeSingle();
    if (pre) {
      setPreApprovedVisit({
        id: pre.id, ref_number: pre.ref_number, visitor_name: v.full_name,
        dept_name: pre.department?.name ?? '', purpose: pre.purpose, photo_data: pre.photo_data,
      });
      return 'pre-approved';
    }
    return 'found';
  }, [phone, blacklist]);

  const handlePhoneSubmit = async () => {
    if (!phone) return;
    const result = await recallByPhone();
    if (result === 'pre-approved' || result === 'blacklisted') return;
    setStep('form');
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
      if (fullVisit) {
        const v = { ...fullVisit, photo_url: fullVisit.photo_data ?? undefined } as Visit;
        showBadgeWithCountdown(v);
      }
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
    if (blacklistHit) { setError('Access denied — blacklisted phone.'); return; }
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
        expected_duration_minutes: null,
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
    <div className={`${DARK_STAGE} flex flex-col items-center justify-center p-8`}>
      <AuroraBackdrop />
      <div className="relative animate-fade-in text-center max-w-lg">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mx-auto shadow-glow-mix ring-4 ring-white/10 mb-8">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">SecureGate</h1>
        <p className="text-lg text-brand-200/80 mb-2">Visitor Self Check-in Kiosk</p>
        <p className="text-sm text-white/50 mb-12">Touch the screen to begin</p>
        <button onClick={() => { clearIdleTimer(); setStep('phone'); }}
          className="w-64 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-2xl px-8 py-5 text-xl font-bold hover:shadow-glow-accent active:scale-[0.97] shadow-glow-mix transition-all duration-200 animate-pulse-soft">
          Tap to Start
        </button>
        <p className="text-xs text-white/40 mt-8">Tap anywhere or press any key</p>
      </div>
    </div>
  );

  const renderPhone = () => (
    <div className={`${DARK_STAGE} flex flex-col items-center justify-center p-8`}>
      <AuroraBackdrop />
      <div className="relative w-full max-w-md animate-fade-in">
        <button onClick={() => resetAll()} className="text-brand-200 hover:text-white text-sm mb-8 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back
        </button>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white font-display mb-2">Welcome</h2>
          <p className="text-brand-200/80">Enter your mobile number to check in</p>
        </div>
        <input type="tel" autoFocus maxLength={20} value={phone}
          onChange={(e) => { setPhone(e.target.value); setRecalledName(null); setBlacklistHit(null); setPreApprovedVisit(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSubmit(); if (e.key === 'Escape') resetAll(); }}
          placeholder="+91 98765 43210"
          className="w-full text-center text-2xl bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl px-6 py-5 text-white placeholder-white/30 outline-none focus:border-brand-300 focus:bg-white/15 transition-all" />
        <div className="flex gap-3 mt-6">
          <button onClick={() => resetAll()} className="flex-1 bg-white/10 backdrop-blur border border-white/10 text-white rounded-xl px-6 py-4 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition-all">Cancel</button>
          <button onClick={handlePhoneSubmit} className="flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl px-6 py-4 text-lg font-bold active:scale-[0.98] shadow-glow transition-all">Check In</button>
        </div>
        {recalledName && !blacklistHit && !preApprovedVisit && (
          <div className="mt-6 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 text-center">
            <p className="text-white font-medium">Welcome back, {recalledName}</p>
            <p className="text-brand-200 text-sm mt-1">Fill in the details to continue</p>
          </div>
        )}
        {preApprovedVisit && (
          <div className="mt-6 p-6 bg-success-500/10 backdrop-blur-xl rounded-2xl border border-success-500/30 space-y-4 text-center">
            <div className="h-14 w-14 rounded-full bg-success-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-white text-xl font-bold">{preApprovedVisit.visitor_name}</p>
              <p className="text-success-500 text-sm mt-1">Pre-approved for {preApprovedVisit.dept_name}</p>
              <p className="text-white/50 text-xs mt-1">Ref: {preApprovedVisit.ref_number}</p>
            </div>
            <button onClick={checkInPreApproved} disabled={checkingInPreApproved}
              className="w-full bg-gradient-to-r from-success-500 to-success-600 text-white rounded-xl px-6 py-4 text-lg font-bold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all">
              {checkingInPreApproved ? 'Checking in...' : 'Tap to Check In'}
            </button>
          </div>
        )}
        {blacklistHit && (
          <div className="mt-6 p-4 bg-danger-500/10 backdrop-blur-xl rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-500 font-bold">ACCESS DENIED</p>
            <p className="text-white/60 text-sm mt-1">{blacklistHit}</p>
          </div>
        )}
        {error && (
          <div className="mt-6 p-4 bg-danger-500/10 backdrop-blur-xl rounded-xl border border-danger-500/30 text-center">
            <p className="text-danger-500">{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="relative min-h-screen overflow-y-auto">
      <AuroraBackdrop />
      <div className="relative max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setStep('phone'); setError(''); }} className="btn-icon -ml-2" title="Back">
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

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="label">Mobile Number</label>
              <input type="tel" value={phone} disabled className="input bg-surface-100 text-navy-500" />
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input type="text" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="e.g. John Doe" autoFocus />
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
    <div className="fixed inset-0 z-50 bg-surface-50 overflow-y-auto" onClick={() => { if (step !== 'idle') startIdleTimer(); }}>
      {renderContent()}
    </div>
  );
}

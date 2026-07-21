/**
 * VisitorForm — FR-VIS-02/03, PRD §3.4
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import PhotoCapture from '../../components/PhotoCapture';
import type { Department, Profile, Visitor, VisitorPurpose } from '../../types/index';

const PURPOSES: { value: VisitorPurpose; label: string }[] = [
  { value: 'meeting',     label: 'Meeting' },
  { value: 'vendor',      label: 'Vendor / Contractor' },
  { value: 'interview',   label: 'Interview' },
  { value: 'delivery',    label: 'Delivery / Courier' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'audit',       label: 'Audit / Inspection' },
  { value: 'other',       label: 'Other' },
];

type Props = { onRegistered: (visitorName: string) => void };

export default function VisitorForm({ onRegistered }: Props): React.ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hosts,       setHosts]       = useState<Profile[]>([]);
  const [blacklist,   setBlacklist]   = useState<{ phone: string; reason: string }[]>([]);

  const [phone,       setPhone]       = useState('');
  const [fullName,    setFullName]    = useState('');
  const [company,     setCompany]     = useState('');
  const [purpose,     setPurpose]     = useState<VisitorPurpose>('meeting');
  const [deptId,      setDeptId]      = useState('');
  const [hostId,      setHostId]      = useState('');
  const [idType,      setIdType]      = useState('');
  const [idLast4,     setIdLast4]     = useState('');
  const [vehicle,     setVehicle]     = useState('');
  const [carryingMaterial, setCarryingMaterial] = useState(false);
  const [photoBlob,   setPhotoBlob]   = useState<Blob | null>(null);

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [expectedDuration, setExpectedDuration] = useState<number>(30);

  const [blacklistHit,  setBlacklistHit]  = useState<string | null>(null);
  const [recalledName,  setRecalledName]  = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [hostError,     setHostError]     = useState<string | null>(null);
  const [activeVisitCheck, setActiveVisitCheck] = useState<{ checking: boolean; message: string | null }>({ checking: false, message: null });
  const [preApprovedVisit, setPreApprovedVisit] = useState<{ id: string; ref_number: string; visitor_name: string; dept_name: string; purpose: string; photo_data: string | null } | null>(null);
  const [checkingInPreApproved, setCheckingInPreApproved] = useState(false);

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
      .catch((err) => { console.error('Failed to load hosts:', err.message); setHostError('Could not load person-to-meet list. Contact admin.'); setHosts([]); });
  }, [deptId]);

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
      const v = data as Visitor;
      setFullName(v.full_name); setCompany(v.company ?? ''); setRecalledName(v.full_name);
      const pre = await (async () => {
        try {
          const { data: d } = await (supabase as any)
            .from('visits')
            .select('id, ref_number, purpose, photo_data, department:departments(name)')
            .eq('visitor_id', v.id)
            .eq('status', 'approved')
            .maybeSingle();
          return d as { id: string; ref_number: string; purpose: string; photo_data: string | null; department: { name: string } | null } | null;
        } catch { return null; }
      })();
      if (pre) {
        setPreApprovedVisit({
          id: pre.id,
          ref_number: pre.ref_number,
          visitor_name: v.full_name,
          dept_name: pre.department?.name ?? '',
          purpose: pre.purpose,
          photo_data: pre.photo_data,
        });
      }
    }
  }, [phone, blacklist]);

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
      console.warn('[photo] Storage upload failed, using base64 only:', uploadErr.message);
      return { photoPath: null, photoData: base64 };
    }

    const { data: urlData } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
  }, []);

  const checkInPreApproved = async () => {
    if (!preApprovedVisit) return;
    setCheckingInPreApproved(true);
    setError('');
    try {
      const { error: err } = await supabase.from('visits').update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      }).eq('id', preApprovedVisit.id);
      if (err) throw err;
      setPreApprovedVisit(null);
      setPhone(''); setFullName(''); setCompany(''); setRecalledName(null);
      onRegistered(preApprovedVisit.visitor_name);
    } catch (err) { setError(safeErrorMessage(err, 'Failed to check in pre-approved visitor.')); }
    finally { setCheckingInPreApproved(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) return;
    if (!photoBlob) { setError('Photo is required (FR-CAM-05).'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Please enter a valid 10-digit mobile number (e.g. +91 98765 43210).'); }
      // SEC-17: Check for existing active visit before registration
      setActiveVisitCheck({ checking: true, message: null });
      const { data: existingVisit } = await (supabase as any)
        .rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) {
        setActiveVisitCheck({ checking: false, message: `This phone number already has an active visit (Ref: ${existingVisit.ref_number}, Status: ${existingVisit.status.replace(/_/g, ' ')}). Please complete that visit first.` });
        setSubmitting(false);
        return;
      }
      setActiveVisitCheck({ checking: false, message: null });
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, company: company || null, id_type: idType || null, id_last4: idLast4 || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create/find visitor record.');
      if (vehicle.trim()) {
        await supabase.from('visitors').update({ vehicle_number: vehicle.trim() || null }).eq('id', vis.id);
      }
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: carryingMaterial,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        expected_duration_minutes: expectedDuration || null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      onRegistered(fullName);
    } catch (err) { setError(safeErrorMessage(err, 'Registration failed. Please try again.')); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-navy-950">Register New Visitor</h2>
        <p className="text-sm text-navy-400 mt-1">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date().toLocaleDateString('en-IN')}
        </p>
      </div>

      {blacklistHit && (
        <div className="rounded-xl border-2 border-danger-500/30 bg-danger-50 p-4 flex items-start gap-3 animate-fade-in">
          <div className="shrink-0 h-8 w-8 rounded-lg bg-danger-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <div>
            <p className="font-bold text-danger-700">BLACKLISTED — Do not allow entry</p>
            <p className="text-sm text-danger-600 mt-0.5">Reason: {blacklistHit}</p>
            <p className="text-xs text-danger-500 mt-1">Contact Admin or Security Head immediately.</p>
          </div>
        </div>
      )}

      {recalledName && !blacklistHit && !preApprovedVisit && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Returning visitor — details pre-filled
        </div>
      )}

      {preApprovedVisit && (
        <div className="rounded-xl border-2 border-success-400/40 bg-gradient-to-br from-success-50 to-white p-5 space-y-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-10 w-10 rounded-xl bg-success-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-success-800 text-lg">Pre-Approved Visitor</p>
              <p className="text-sm text-success-700 mt-0.5">This visitor is pre-approved and ready for check-in.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-white/60 rounded-xl p-4">
            <div><span className="font-semibold text-navy-700">Name:</span> <span className="text-navy-600">{preApprovedVisit.visitor_name}</span></div>
            <div><span className="font-semibold text-navy-700">Ref:</span> <span className="text-navy-600 font-mono">{preApprovedVisit.ref_number}</span></div>
            <div><span className="font-semibold text-navy-700">Department:</span> <span className="text-navy-600">{preApprovedVisit.dept_name}</span></div>
            <div><span className="font-semibold text-navy-700">Purpose:</span> <span className="text-navy-600 capitalize">{preApprovedVisit.purpose}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={checkInPreApproved} disabled={checkingInPreApproved}
              className="flex-1 bg-gradient-to-r from-success-600 to-success-700 text-white rounded-xl px-5 py-3 text-sm font-bold hover:from-success-700 hover:to-success-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2">
              {checkingInPreApproved ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Check In Now
                </>
              )}
            </button>
            <button onClick={() => setPreApprovedVisit(null)} disabled={checkingInPreApproved}
              className="btn-secondary text-sm px-5 py-3">
              Register as Walk-in
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {activeVisitCheck.message && (
        <div className="alert-warning">
          <svg className="w-4 h-4 text-warning-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{activeVisitCheck.message}</span>
          <button onClick={() => setActiveVisitCheck({ checking: false, message: null })} className="text-warning-500 hover:text-warning-700 text-xs font-medium ml-auto">Dismiss</button>
        </div>
      )}

      {!preApprovedVisit && (
      <><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Mobile Number *</label>
          <input type="tel" required maxLength={20} value={phone}
            onChange={(e) => { setPhone(e.target.value); setRecalledName(null); setBlacklistHit(null); }}
            onBlur={recallByPhone} placeholder="+91 98765 43210" className="input" />
        </div>
        <div><label className="label">Full Name *</label><input type="text" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" /></div>
        <div><label className="label">Company / Coming from *</label><input type="text" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} className="input" /></div>
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
          {hostError && (
            <p className="text-xs text-danger-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              {hostError}
            </p>
          )}
        </div>
        <div>
          <label className="label">Govt ID Type</label>
          <select value={idType} onChange={(e) => setIdType(e.target.value)} className="input">
            <option value="">Optional</option>
            {['Aadhaar', 'PAN', 'Passport', 'Driver Licence', 'Voter ID'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">ID Last 4 Digits</label><input type="text" maxLength={4} value={idLast4} onChange={(e) => setIdLast4(e.target.value)} className="input" placeholder="XXXX" /></div>
        <div className="sm:col-span-2"><label className="label">Vehicle Number (optional)</label><input type="text" maxLength={20} value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="input" placeholder="MH 12 AB 1234" /></div>
        <div className="sm:col-span-2">
          <label className="label flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={carryingMaterial} onChange={(e) => setCarryingMaterial(e.target.checked)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
            Carrying material / equipment
          </label>
        </div>
      </div>

      <div>
        <label className="label mb-2 block">Visitor Photo *</label>
        {!photoBlob ? (
          <PhotoCapture onCapture={(blob) => setPhotoBlob(blob)} />
        ) : (
          <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl border border-surface-200">
            <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl shadow-xs" />
            <div className="flex-1">
              <p className="text-sm font-medium text-navy-700">Photo captured</p>
              <p className="text-xs text-navy-400">Ready to submit</p>
            </div>
            <button type="button" onClick={() => setPhotoBlob(null)} className="btn-ghost text-danger-600 hover:text-danger-700 text-sm">Retake</button>
          </div>
        )}
      </div>

      {/* Emergency Contact & Expected Duration */}
      <div className="card p-5 space-y-4 bg-amber-50/30 border border-amber-200 rounded-xl">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          Emergency Contact & Visit Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="label">Emergency Contact Name</label><input type="text" maxLength={100} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="input" placeholder="Next of kin" /></div>
          <div><label className="label">Emergency Contact Phone</label><input type="tel" maxLength={20} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="input" placeholder="+91 98765 43210" /></div>
          <div><label className="label">Expected Duration (min)</label><input type="number" min={5} max={480} value={expectedDuration} onChange={(e) => setExpectedDuration(Number(e.target.value))} className="input" /></div>
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={submitting || !!blacklistHit || !photoBlob || activeVisitCheck.checking}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl px-5 py-3.5 text-sm font-bold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200">
        {submitting ? (
          <span className="flex items-center justify-center gap-2.5">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Registering...
          </span>
        ) : 'Submit for HOD Approval'}
      </button>

      <p className="text-xs text-navy-300 text-center">Photographs captured for security purposes only</p>
      </>)}
    </form>
  );
}

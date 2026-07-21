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
  const [photoBlob,   setPhotoBlob]   = useState<Blob | null>(null);

  const [blacklistHit,  setBlacklistHit]  = useState<string | null>(null);
  const [recalledName,  setRecalledName]  = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? []));
    supabase.from('visitors').select('phone, blacklist_reason').eq('is_blacklisted', true).then(({ data }) => {
      setBlacklist((data ?? []).map((r) => ({ phone: r.phone, reason: r.blacklist_reason ?? 'Flagged' })));
    });
  }, []);

  useEffect(() => {
    if (!deptId) { setHosts([]); return; }
    fetch(`/api/hosts/${deptId}`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data) => setHosts(data ?? []))
      .catch((err) => { console.error('Failed to load hosts:', err.message); setHosts([]); });
  }, [deptId]);

  const recallByPhone = useCallback(async () => {
    if (!phone) return;
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { return; }
    const hit = isBlacklisted(phone, blacklist);
    if (hit) { setBlacklistHit(hit.reason); return; }
    setBlacklistHit(null);
    const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
    if (data) { const v = data as Visitor; setFullName(v.full_name); setCompany(v.company ?? ''); setRecalledName(v.full_name); }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) return;
    if (!photoBlob) { setError('Photo is required (FR-CAM-05).'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Invalid phone number.'); }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, company: company || null, id_type: idType || null, id_last4: idLast4 || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create/find visitor record.');
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: false,
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

      {recalledName && !blacklistHit && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Returning visitor — details pre-filled
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Mobile Number *</label>
          <input type="tel" required value={phone}
            onChange={(e) => { setPhone(e.target.value); setRecalledName(null); setBlacklistHit(null); }}
            onBlur={recallByPhone} placeholder="+91 98765 43210" className="input" />
        </div>
        <div><label className="label">Full Name *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" /></div>
        <div><label className="label">Company / Coming from *</label><input type="text" required value={company} onChange={(e) => setCompany(e.target.value)} className="input" /></div>
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
        </div>
        <div>
          <label className="label">Govt ID Type</label>
          <select value={idType} onChange={(e) => setIdType(e.target.value)} className="input">
            <option value="">Optional</option>
            {['Aadhaar', 'PAN', 'Passport', 'Driver Licence', 'Voter ID'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">ID Last 4 Digits</label><input type="text" maxLength={4} value={idLast4} onChange={(e) => setIdLast4(e.target.value)} className="input" placeholder="XXXX" /></div>
        <div className="sm:col-span-2"><label className="label">Vehicle Number (optional)</label><input type="text" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="input" placeholder="MH 12 AB 1234" /></div>
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

      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting || !!blacklistHit || !photoBlob}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl px-5 py-3.5 text-sm font-bold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200">
        {submitting ? (
          <span className="flex items-center justify-center gap-2.5">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Registering...
          </span>
        ) : 'Submit for HOD Approval'}
      </button>

      <p className="text-xs text-navy-300 text-center">Photographs captured for security purposes only</p>
    </form>
  );
}

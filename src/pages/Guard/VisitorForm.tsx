/**
 * VisitorForm — FR-VIS-02/03, PRD §3.4
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
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
    // Always store base64 for reliable display (works without storage bucket)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read photo'));
      reader.readAsDataURL(blob);
    });

    // Try uploading to Supabase Storage for signed URL (optional enhancement)
    const filePath = `visits/${Date.now()}.webp`;
    const { error: uploadErr } = await supabase.storage
      .from('visitor-photos')
      .upload(filePath, blob, { contentType: 'image/webp', upsert: true });

    if (uploadErr) {
      console.warn('[photo] Storage upload failed, using base64 only:', uploadErr.message);
      return { photoPath: null, photoData: base64 };
    }

    // Storage upload succeeded — try signed URL; fall back to base64 for display
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
      // Upload photo to Supabase Storage, fall back to base64
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: false,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      onRegistered(fullName);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-navy-950">Register New Visitor</h2>
        <p className="text-sm text-navy-400 mt-1">Registering at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {new Date().toLocaleDateString('en-IN')}</p>
      </div>

      {blacklistHit && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <span className="shrink-0 h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs mt-0.5">!</span>
          <div>
            <p className="font-bold text-red-700">BLACKLISTED — Do not allow entry</p>
            <p className="text-sm text-red-600 mt-0.5">Reason: {blacklistHit}</p>
            <p className="text-xs text-red-500 mt-1">Contact Admin or Security Head immediately.</p>
          </div>
        </div>
      )}

      {recalledName && !blacklistHit && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-2.5 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">✓</span>
          <span className="text-sm text-brand-800">Returning visitor — details pre-filled</span>
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
          <div className="flex items-center gap-4">
            <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl shadow-soft" />
            <button type="button" onClick={() => setPhotoBlob(null)} className="text-sm text-red-600 hover:text-red-700 font-medium">Retake</button>
          </div>
        )}
      </div>

      {error && (<div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>)}

      <button type="submit" disabled={submitting || !!blacklistHit || !photoBlob} className="btn-primary w-full py-3 text-base">
        {submitting ? 'Registering...' : 'Submit for HOD Approval'}
      </button>

      <p className="text-xs text-navy-300 text-center">Photographs captured for security purposes only</p>
    </form>
  );
}

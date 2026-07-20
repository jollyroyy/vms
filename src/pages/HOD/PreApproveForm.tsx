import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { validatePreApproval } from '../../lib/visitLifecycle';
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

type Props = { onPreApproved: (name: string, refNumber: string) => void };

export default function PreApproveForm({ onPreApproved }: Props): React.ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hosts,       setHosts]       = useState<Profile[]>([]);
  const [blacklist,   setBlacklist]   = useState<{ phone: string; reason: string }[]>([]);

  const [phone,       setPhone]       = useState('');
  const [fullName,    setFullName]    = useState('');
  const [company,     setCompany]     = useState('');
  const [purpose,     setPurpose]     = useState<VisitorPurpose>('meeting');
  const [deptId,      setDeptId]      = useState('');
  const [hostId,      setHostId]      = useState('');
  const [vehicle,     setVehicle]     = useState('');

  const [blacklistHit,  setBlacklistHit]  = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [userRole,      setUserRole]      = useState<string>('');
  const [userDept,      setUserDept]      = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.app_metadata ?? {};
      setUserRole((meta.role as string) ?? '');
      const dept = (meta.department_id as string) ?? '';
      setUserDept(dept);
      if (dept) setDeptId(dept);
    });
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
    if (data) { setFullName(data.full_name); setCompany(data.company ?? ''); }
  }, [phone, blacklist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validatePreApproval({ department_id: deptId, host_id: hostId, purpose });
    if (validationError) { setError(validationError); return; }
    if (blacklistHit) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired — please log in again.'); return; }
    setSubmitting(true);
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Invalid phone number.'); }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, company: company || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create/find visitor record.');
      const { data: visit, error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        status: 'approved', carrying_material: false,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
        photo_path: null, photo_data: null,
      }).select('ref_number').single();
      if (visitErr) throw visitErr;
      onPreApproved(fullName, visit?.ref_number ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-navy-950">Pre-Approve Visitor</h2>
        <p className="text-sm text-navy-400 mt-1">Pre-register a visitor — they will be pre-approved and can be checked in at the gate</p>
      </div>

      {blacklistHit && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <span className="shrink-0 h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs mt-0.5">!</span>
          <div>
            <p className="font-bold text-red-700">BLACKLISTED — Do not pre-approve</p>
            <p className="text-sm text-red-600 mt-0.5">Reason: {blacklistHit}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Mobile Number *</label>
          <input type="tel" required value={phone}
            onChange={(e) => { setPhone(e.target.value); setBlacklistHit(null); }}
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
          {['admin', 'super_admin'].includes(userRole) ? (
            <select required value={deptId} onChange={(e) => setDeptId(e.target.value)} className="input">
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <select required value={deptId} onChange={(e) => setDeptId(e.target.value)} className="input">
              <option value="">{userDept ? 'Your department' : 'No department assigned'}</option>
              {departments.filter((d) => d.id === userDept).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="label">Person to Meet *</label>
          <select required value={hostId} onChange={(e) => setHostId(e.target.value)} className="input" disabled={!deptId}>
            <option value="">{deptId ? 'Select person' : 'Select department first'}</option>
            {hosts.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Vehicle Number (optional)</label><input type="text" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="input" placeholder="MH 12 AB 1234" /></div>
      </div>

      {error && (<div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>)}

      <button type="submit" disabled={submitting || !!blacklistHit} className="btn-primary w-full py-3 text-base">
        {submitting ? 'Submitting...' : 'Pre-Approve Visitor'}
      </button>

      <p className="text-xs text-navy-300 text-center">Pre-approved visitors can be checked in at the gate without HOD approval</p>
    </form>
  );
}

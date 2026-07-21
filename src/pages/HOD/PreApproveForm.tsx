import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { validatePreApproval } from '../../lib/visitLifecycle';
import { safeErrorMessage } from '../../lib/errors';
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
  const [activeVisitCheck, setActiveVisitCheck] = useState<{ checking: boolean; message: string | null }>({ checking: false, message: null });

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
      try { normalized = normalizePhone(phone); } catch { throw new Error('Please enter a valid 10-digit mobile number (e.g. +91 98765 43210).'); }
      // SEC-17: Check for existing active visit before pre-approval
      setActiveVisitCheck({ checking: true, message: null });
      const { data: existingVisit } = await (supabase as any)
        .rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) {
        setActiveVisitCheck({ checking: false, message: `This phone number already has an active visit (Ref: ${existingVisit.ref_number}, Status: ${existingVisit.status.replace(/_/g, ' ')}). Cannot pre-approve.` });
        setSubmitting(false);
        return;
      }
      setActiveVisitCheck({ checking: false, message: null });
      const { data, error: rpcErr } = await (supabase as any).rpc('pre_approve_visitor', {
        p_phone: normalized,
        p_full_name: fullName,
        p_company: company || null,
        p_vehicle_number: vehicle || null,
        p_department_id: deptId,
        p_host_id: hostId,
        p_purpose: purpose,
      });
      if (rpcErr) throw rpcErr;
      if (!data?.ref_number) throw new Error('Failed to create pre-approved visit.');
      onPreApproved(fullName, data.ref_number);
    } catch (err) { setError(safeErrorMessage(err, 'Pre-approval failed. Please try again.')); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="card-premium p-6 sm:p-8 space-y-6 max-w-2xl animate-fade-in">
      <div className="flex items-start gap-3.5">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-navy-950 font-display tracking-tight">Pre-Approve Visitor</h2>
          <p className="text-sm text-navy-400 mt-1">Pre-register a visitor — they will be pre-approved and can be checked in at the gate without waiting</p>
        </div>
      </div>

      {blacklistHit && (
        <div className="rounded-xl border-2 border-danger-500/30 bg-danger-50 p-4 flex items-start gap-3 animate-fade-in">
          <div className="shrink-0 h-8 w-8 rounded-lg bg-danger-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <div>
            <p className="font-bold text-danger-700">BLACKLISTED — Do not pre-approve</p>
            <p className="text-sm text-danger-600 mt-0.5">Reason: {blacklistHit}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Mobile Number *</label>
          <input type="tel" required maxLength={20} value={phone}
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
        <div className="sm:col-span-2"><label className="label">Vehicle Number (optional)</label><input type="text" maxLength={20} value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="input" placeholder="MH 12 AB 1234" /></div>
      </div>

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

      <button type="submit" disabled={submitting || !!blacklistHit}
        className="btn-primary w-full !py-3.5">
        {submitting ? 'Submitting...' : 'Pre-Approve Visitor'}
      </button>

      <p className="text-xs text-navy-300 text-center">Pre-approved visitors skip the approval queue at entry</p>
    </form>
  );
}

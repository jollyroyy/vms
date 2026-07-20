import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';
import { attachHostNames } from '../../lib/hostNames';
import PreApproveForm from './PreApproveForm';

type Tab = 'pending' | 'pre-approve';

const TAB_LABELS: Record<Tab, string> = {
  pending:     'Pending Approvals',
  'pre-approve': 'Pre-Approve Visitor',
};

export default function HODApprovals(): React.ReactElement {
  const [tab,        setTab]        = useState<Tab>('pending');
  const [visits,     setVisits]     = useState<Visit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [reasons,    setReasons]    = useState<Record<string, string>>({});
  const [acting,     setActing]     = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPending = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated.'); setLoading(false); return; }

      const departmentId = user.app_metadata?.department_id as string | undefined;
      if (!departmentId) {
        console.warn('[HOD] No department_id in JWT app_metadata. Try: refresh session or run migration 010.');
        setError('Your account is not assigned to any department. Contact admin.');
        setLoading(false);
        return;
      }
      console.log('[HOD] Using department_id from JWT:', departmentId);

      let { data, error: visitsErr } = await supabase
        .from('visits')
        .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
        .eq('department_id', departmentId)
        .in('status', ['pending_approval'])
        .order('created_at', { ascending: true });
      if (visitsErr) {
        console.error('[HOD] Visits query error:', visitsErr.message);
        setError('Failed to load pending approvals: ' + visitsErr.message);
        setLoading(false);
        return;
      }

      let raw = ((data as unknown as Visit[]) ?? []);
      raw = await attachHostNames(raw);
      const enriched = raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined }));
      setVisits(enriched);
      if (enriched.length === 0) {
        console.log('[HOD] No pending approvals found for department', departmentId);
      } else {
        console.log(`[HOD] Loaded ${enriched.length} pending approvals`);
      }
    } catch (err) {
      console.error('[HOD] Unexpected error:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPending();
    const ch = supabase.channel('hod-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void loadPending(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [loadPending]);

  const decide = async (visitId: string, approved: boolean) => {
    const reason = reasons[visitId]?.trim();
    if (!approved && !reason) { setError('Please enter a rejection reason.'); return; }
    setActing(visitId);
    setError('');
    try {
      const rpc = (supabase as any).rpc.bind(supabase);
      const { error: err } = approved
        ? await rpc('approve_visit', { visit_id: visitId })
        : await rpc('reject_visit', { visit_id: visitId, reason: reason || 'Rejected by HOD' });
      if (err) { console.error('[HOD] Decision error:', err.message); setError(err.message); setActing(null); return; }
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
    } catch (err) {
      console.error('[HOD] Unexpected error:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
    setActing(null);
  };

  const escalationLabel = (v: Visit): { text: string; urgent: boolean } => {
    const now = new Date().toISOString();
    const target = getEscalationTarget(v.created_at, now, { hod_id: 'self', delegate_id: null });
    if (target === 'hod') {
      const mins = Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / 60000);
      const remaining = 5 - mins;
      return { text: `${remaining}m remaining`, urgent: remaining <= 2 };
    }
    if (target === 'delegate') return { text: 'Escalated to delegate', urgent: true };
    return { text: 'Escalated to Admin', urgent: true };
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="page-header !mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Approvals</h1>
            <p className="page-subtitle">{visits.length > 0 ? `${visits.length} pending` : 'Review visitor requests'}</p>
          </div>
          <button onClick={() => void loadPending()} className="btn-secondary text-xs px-3 py-1.5" title="Refresh">↻</button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-800 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">✓</span>
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-brand-500 hover:text-brand-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold shrink-0">!</span>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group">
        {(['pending', 'pre-approve'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'tab-active' : 'tab-inactive'}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'pre-approve' && (
        <PreApproveForm onPreApproved={(name, refNumber) => {
          setSuccessMsg(`"${name}" pre-approved — ref ${refNumber}`);
          setTimeout(() => setSuccessMsg(''), 6000);
        }} />
      )}

      {tab === 'pending' && (
        <>
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-20 h-28 bg-surface-100 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-5 bg-surface-100 rounded w-2/3" /><div className="h-3 bg-surface-100 rounded w-1/2" /></div></div>
            </div>
          ))}
        </div>
      )}

      {!loading && visits.length === 0 && !error && (
        <div className="empty-state py-20">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 mb-3">
            <svg className="w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-lg font-semibold text-navy-700">All caught up</p>
          <p className="text-sm text-navy-400 mt-1">No pending approvals</p>
        </div>
      )}

      {visits.map((v) => {
        const esc = escalationLabel(v);
        return (
          <div key={v.id} className="card overflow-hidden">
            <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 ${
              esc.urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${esc.urgent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
              {esc.text}
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                {v.photo_url ? (
                  <img src={v.photo_url} alt="Visitor" className="w-20 h-28 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-20 h-28 bg-surface-100 rounded-xl shrink-0 flex items-center justify-center text-surface-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-bold text-navy-950 text-lg truncate">{v.visitor?.full_name ?? v.host?.full_name ?? '—'}</p>
                  <p className="text-sm text-navy-500">{v.visitor?.company ?? ''}</p>
                  <div className="space-y-0.5 text-xs text-navy-400 pt-1">
                    <p>{v.visitor?.phone ?? ''}</p>
                    <p>{v.department?.name ?? ''} · {v.host?.full_name ?? ''}</p>
                    <p className="capitalize">Purpose: {v.purpose}</p>
                  </div>
                  <p className="text-[11px] text-navy-300 font-mono pt-1">{v.ref_number}</p>
                  <p className="text-[10px] text-navy-300">Registered: {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              <input
                type="text"
                placeholder="Reason for rejection (required)"
                value={reasons[v.id] ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, [v.id]: e.target.value }))}
                className="input"
              />

              <div className="flex gap-3">
                <button onClick={() => decide(v.id, true)} disabled={acting === v.id}
                  className="flex-1 bg-brand-600 text-white rounded-xl py-3.5 text-base font-bold hover:bg-brand-700 disabled:opacity-50 shadow-sm transition-all">
                  Approve
                </button>
                <button onClick={() => decide(v.id, false)} disabled={acting === v.id}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3.5 text-base font-bold hover:bg-red-700 disabled:opacity-50 shadow-sm transition-all">
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
      </>
      )}
    </div>
  );
}

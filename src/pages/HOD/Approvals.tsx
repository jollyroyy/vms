import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import PreApproveForm from './PreApproveForm';

type Tab = 'pending' | 'pre-approve';

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pending Approvals', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'pre-approve', label: 'Pre-Approve', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

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

      let { data, error: visitsErr } = await supabase
        .from('visits')
        .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
        .eq('department_id', departmentId)
        .in('status', ['pending_approval'])
        .order('created_at', { ascending: true });
      if (visitsErr) {
        setError('Failed to load pending approvals: ' + visitsErr.message);
        setLoading(false);
        return;
      }

      let raw = ((data as unknown as Visit[]) ?? []);
      raw = await attachHostNames(raw);
      const enriched = raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined }));
      setVisits(enriched);
    } catch (err) {
      setError(safeErrorMessage(err, 'Failed to load approvals.'));
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
      if (err) { setError(safeErrorMessage(err, 'Action failed.')); setActing(null); return; }
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
      setSuccessMsg(approved ? 'Visitor approved successfully.' : 'Visit rejected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(safeErrorMessage(err, 'Action failed.'));
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
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">{visits.length > 0 ? `${visits.length} pending review` : 'Manage visitor requests'}</p>
        </div>
        <button onClick={() => void loadPending()} className="btn-icon" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-success-500 hover:text-success-700 text-xs font-medium">Dismiss</button>
        </div>
      )}
      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group">
        {TAB_CONFIG.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`${tab === key ? 'tab-active' : 'tab-inactive'} flex items-center gap-2`}>
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Pre-approve tab */}
      {tab === 'pre-approve' && (
        <div className="animate-fade-in">
          <PreApproveForm onPreApproved={(name, refNumber) => {
            setSuccessMsg(`"${name}" pre-approved — ref ${refNumber}`);
            setTimeout(() => setSuccessMsg(''), 6000);
          }} />
        </div>
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="space-y-4 animate-fade-in">
          {loading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="card p-6">
                  <div className="flex gap-4 animate-pulse">
                    <div className="w-20 h-28 skeleton rounded-xl" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 skeleton w-2/3" />
                      <div className="h-3 skeleton w-1/2" />
                      <div className="h-3 skeleton w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && visits.length === 0 && !error && (
            <div className="empty-state py-20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 mb-4">
                <svg className="w-8 h-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-lg font-semibold text-navy-700">All caught up</p>
              <p className="text-sm text-navy-400 mt-1">No pending approvals right now</p>
            </div>
          )}

          {visits.map((v) => {
            const esc = escalationLabel(v);
            return (
              <div key={v.id} className="card overflow-hidden animate-fade-in">
                {/* Urgency banner */}
                <div className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                  esc.urgent ? 'bg-danger-50 text-danger-600 border-b border-danger-100' : 'bg-warning-50 text-warning-700 border-b border-warning-100'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${esc.urgent ? 'bg-danger-500 animate-pulse' : 'bg-warning-500'}`} />
                  {esc.text}
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex gap-4">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="Visitor" className="w-20 h-28 object-cover rounded-xl shadow-soft shrink-0" />
                    ) : (
                      <div className="w-20 h-28 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl shrink-0 flex items-center justify-center">
                        <svg className="w-8 h-8 text-navy-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-bold text-navy-950 text-lg truncate">{v.visitor?.full_name ?? '—'}</p>
                      <p className="text-sm text-navy-500">{v.visitor?.company ?? ''}</p>
                      <div className="space-y-0.5 text-xs text-navy-400 pt-1">
                        <p className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                          {v.visitor?.phone ?? ''}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                          {v.department?.name ?? ''} · {v.host?.full_name ?? ''}
                        </p>
                        <p className="capitalize">Purpose: {v.purpose}</p>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                        <span className="text-navy-200">·</span>
                        <p className="text-[10px] text-navy-300">Registered: {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Rejection reason input */}
                  <input
                    type="text"
                    placeholder="Reason for rejection (required if rejecting)"
                    value={reasons[v.id] ?? ''}
                    onChange={(e) => setReasons((r) => ({ ...r, [v.id]: e.target.value }))}
                    className="input"
                  />

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button onClick={() => decide(v.id, true)} disabled={acting === v.id}
                      className="flex-1 bg-gradient-to-r from-success-600 to-success-700 text-white rounded-xl py-3.5 text-sm font-bold hover:from-success-700 hover:to-success-800 disabled:opacity-50 shadow-soft transition-all duration-200 active:scale-[0.98]">
                      Approve
                    </button>
                    <button onClick={() => decide(v.id, false)} disabled={acting === v.id}
                      className="flex-1 bg-gradient-to-r from-danger-500 to-danger-600 text-white rounded-xl py-3.5 text-sm font-bold hover:from-danger-600 hover:to-danger-700 disabled:opacity-50 shadow-soft transition-all duration-200 active:scale-[0.98]">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

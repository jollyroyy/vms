import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, VisitStatus } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import PreApproveForm from './PreApproveForm';
import { formatDateTime, formatTime, formatDuration } from '../../lib/formatDate';
import VisitorDetails from '../../components/VisitorDetails';

type Tab = 'pending' | 'approved' | 'rejected' | 'pre-approve';

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pending Approvals', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'approved', label: 'Approved', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'rejected', label: 'Rejected', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> },
  { key: 'pre-approve', label: 'Pre-Approve', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', label: 'Pending' },
  approved:         { bg: 'bg-success-50', text: 'text-success-700', label: 'Pre-Approved' },
  walkin_approved:  { bg: 'bg-brand-50',   text: 'text-brand-700',  label: 'Approved' },
  rejected:         { bg: 'bg-danger-50',  text: 'text-danger-700', label: 'Rejected' },
};

export default function HODApprovals(): React.ReactElement {
  const [tab,        setTab]        = useState<Tab>('pending');
  const [visits,     setVisits]     = useState<Visit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [reasons,    setReasons]    = useState<Record<string, string>>({});
  const [acting,     setActing]     = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setError('Not authenticated.'); return; }
      const deptId = user.app_metadata?.department_id as string | undefined;
      if (!deptId) {
        console.warn('[HOD] No department_id in JWT app_metadata.');
        setError('Your account is not assigned to any department. Contact admin.');
        return;
      }
      setUserDeptId(deptId);
    });
  }, []);

  const loadVisits = useCallback(async (statuses: readonly VisitStatus[]) => {
    if (!userDeptId) { return; }
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('department_id', userDeptId)
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    let raw = ((data as unknown as Visit[]) ?? []);
    raw = await attachHostNames(raw);
    setVisits(raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    setLoading(false);
  }, [userDeptId]);

  useEffect(() => {
    if (!userDeptId) return;
    if (tab === 'pending') void loadVisits(['pending_approval'] as const);
    else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
    else if (tab === 'rejected') void loadVisits(['rejected'] as const);
  }, [tab, userDeptId]);

  useEffect(() => {
    if (!userDeptId) return;
    const ch = supabase.channel('hod-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        if (tab === 'pending') void loadVisits(['pending_approval'] as const);
        else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
        else if (tab === 'rejected') void loadVisits(['rejected'] as const);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tab, userDeptId]);

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
      if (err) { setError(safeErrorMessage(err, 'Action failed.')); return; }
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
      setSuccessMsg(approved ? 'Visitor approved successfully.' : 'Visit rejected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(safeErrorMessage(err, 'Action failed.'));
    } finally {
      setActing(null);
    }
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
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Manage visitor requests</p>
        </div>
        <button onClick={() => {
          if (tab === 'pending') void loadVisits(['pending_approval'] as const);
          else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
          else if (tab === 'rejected') void loadVisits(['rejected'] as const);
        }} className="btn-icon" title="Refresh">
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

      {/* Approved tab */}
      {tab === 'approved' && (
        <div className="space-y-4 animate-fade-in">
          {loading && <div className="text-center py-12 text-navy-400">Loading...</div>}
          {!loading && visits.length === 0 && (
            <div className="empty-state py-20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 mb-4">
                <svg className="w-8 h-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-lg font-semibold text-navy-700">No approved visitors</p>
              <p className="text-sm text-navy-400 mt-1">Approved visitors will appear here</p>
            </div>
          )}
          {visits.map((v) => {
            const style = STATUS_STYLES[v.status === 'approved' ? 'approved' : 'walkin_approved'] ?? { bg: 'bg-surface-50', text: 'text-navy-700', label: v.status };
            return (
              <div key={v.id} className="card p-5 cursor-pointer animate-fade-in border-l-4 border-l-success-400 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200" onClick={() => setDetailVisit(v)}>
                <div className="flex gap-4">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="w-16 h-20 object-cover rounded-xl shrink-0" style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.1), 0 0 0 2px rgba(34,197,94,0.1)' }} />
                  ) : (
                    <div className="w-16 h-20 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-navy-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-navy-950">{v.visitor?.full_name ?? '—'}</p>
                      <span className={`status-badge ${style.bg} ${style.text}`}>{style.label}</span>
                    </div>
                    <p className="text-sm text-navy-500">{v.visitor?.company ?? ''}</p>
                    <p className="text-xs text-navy-400">{v.department?.name} · {v.host?.full_name}</p>
                    <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                    <p className="text-[10px] text-navy-300">Approved: {formatTime(v.checked_in_at ?? v.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejected tab */}
      {tab === 'rejected' && (
        <div className="space-y-4 animate-fade-in">
          {loading && <div className="text-center py-12 text-navy-400">Loading...</div>}
          {!loading && visits.length === 0 && (
            <div className="empty-state py-20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
                <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </div>
              <p className="text-lg font-semibold text-navy-700">No rejected visitors</p>
              <p className="text-sm text-navy-400 mt-1">Rejected visits will appear here</p>
            </div>
          )}
          {visits.map((v) => (
            <div key={v.id} className="card p-5 cursor-pointer animate-fade-in border-l-4 border-l-danger-400 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200" style={{ background: 'linear-gradient(135deg, white, rgba(254,242,242,0.3))' }} onClick={() => setDetailVisit(v)}>
              <div className="flex gap-4">
                {v.photo_url ? (
                  <img src={v.photo_url} alt="" className="w-16 h-20 object-cover rounded-xl shrink-0" style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.1)' }} />
                ) : (
                  <div className="w-16 h-20 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-navy-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-navy-950">{v.visitor?.full_name ?? '—'}</p>
                    <span className="status-badge bg-danger-50 text-danger-700">Rejected</span>
                  </div>
                  <p className="text-sm text-navy-500">{v.visitor?.company ?? ''}</p>
                  <p className="text-xs text-navy-400">{v.department?.name} · {v.host?.full_name}</p>
                  {v.rejection_reason && (
                    <div className="mt-2 rounded-xl bg-danger-50/50 px-3 py-2.5 text-xs text-danger-700 border border-danger-100 flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-danger-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                      Reason: {v.rejection_reason}
                    </div>
                  )}
                  <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  <div className="flex gap-4">
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

          {visits.map((v, idx) => {
            const esc = escalationLabel(v);
            return (
              <div key={v.id} className="card overflow-hidden animate-fade-in cursor-pointer hover:shadow-elevated transition-all duration-200" style={{ animationDelay: `${idx * 0.05}s` }} onClick={() => setDetailVisit(v)}>
                {/* Urgency banner with gradient */}
                <div className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 ${
                  esc.urgent
                    ? 'text-white border-b border-danger-600/20'
                    : 'bg-warning-50 text-warning-700 border-b border-warning-100'
                }`} style={esc.urgent ? { background: 'linear-gradient(135deg, #dc2626, #ef4444, #dc2626)', backgroundSize: '200% 200%', animation: 'hologram 3s ease infinite' } : undefined}>
                  <span className={`h-2 w-2 rounded-full ${esc.urgent ? 'bg-white animate-pulse' : 'bg-warning-500'}`} />
                  {esc.text}
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex gap-4">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="Visitor" className="w-20 h-28 object-cover rounded-2xl shrink-0" style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12), 0 0 0 3px rgba(51,150,255,0.08)' }} />
                    ) : (
                      <div className="w-20 h-28 bg-gradient-to-br from-surface-100 to-surface-200 rounded-2xl shrink-0 flex items-center justify-center">
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
                        <p className="text-[10px] text-navy-300">Reg: {formatTime(v.created_at)}</p>
                      </div>
                      {v.checked_in_at && (
                        <p className="text-[10px] text-navy-300 mt-0.5">Checked in: {formatTime(v.checked_in_at)}</p>
                      )}
                      {v.checked_out_at && (
                        <p className="text-[10px] text-navy-300 mt-0.5">Checked out: {formatTime(v.checked_out_at)}</p>
                      )}
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    {/* Rejection reason input with enhanced styling */}
                    <input
                      type="text"
                      placeholder="Reason for rejection (required if rejecting)"
                      value={reasons[v.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [v.id]: e.target.value }))}
                      className="input mb-3"
                    />

                    {/* Action buttons with gradient effects and icons */}
                    <div className="flex gap-3">
                      <button onClick={() => decide(v.id, true)} disabled={acting === v.id}
                        className="flex-1 bg-gradient-to-r from-success-600 to-success-700 text-white rounded-xl py-3.5 text-sm font-bold hover:from-success-700 hover:to-success-800 disabled:opacity-50 shadow-soft transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Approve
                      </button>
                      <button onClick={() => decide(v.id, false)} disabled={acting === v.id}
                        className="flex-1 bg-gradient-to-r from-danger-500 to-danger-600 text-white rounded-xl py-3.5 text-sm font-bold hover:from-danger-600 hover:to-danger-700 disabled:opacity-50 shadow-soft transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        Reject
                      </button>
                    </div>
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

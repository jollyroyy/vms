import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, VisitStatus } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import PreApproveForm from './PreApproveForm';
import { formatTime } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';
import VisitorDetails from '../../components/VisitorDetails';

/* ── Types ─────────────────────────────────────────── */
type Tab = 'pending' | 'approved' | 'rejected' | 'pre-approve';

/* ── Tab config ────────────────────────────────────── */
const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending',     label: 'Pending',     icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'approved',    label: 'Approved',    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'rejected',    label: 'Rejected',    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> },
  { key: 'pre-approve', label: 'Pre-Approve', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

/* ── Helpers ────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDuration(minutes: number | null): string {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function purposeLabel(p: string): string {
  const map: Record<string, string> = {
    meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
    delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
  };
  return map[p] ?? p;
}

/* ── Notification dot color by status ── */
function notifDot(status: string): string {
  if (status === 'pending_approval') return 'bg-warning-500 animate-pulse';
  if (status === 'approved' || status === 'walkin_approved') return 'bg-success-500';
  if (status === 'checked_in') return 'bg-accent-500';
  if (status === 'rejected') return 'bg-danger-500';
  return 'bg-navy-300';
}

function notifTitle(status: string): string {
  if (status === 'pending_approval') return 'New approval request';
  if (status === 'approved') return 'Visit pre-approved';
  if (status === 'walkin_approved') return 'Walk-in approved';
  if (status === 'checked_in') return 'Visitor checked in';
  if (status === 'checked_out') return 'Visitor checked out';
  if (status === 'rejected') return 'Visit rejected';
  return 'Visit update';
}

/* ── Component ─────────────────────────────────────── */
export default function HODApprovals(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('pending');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisitsToday, setAllVisitsToday] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());

  /* auth */
  useEffect(() => {
    try {
      supabase.auth.getUser().then((res) => {
        const user = res?.data?.user;
        if (!user) { setError('Not authenticated.'); return; }
        const deptId = user.app_metadata?.department_id as string | undefined;
        if (!deptId) {
          console.warn('[HOD] No department_id in JWT app_metadata.');
          setError('Your account is not assigned to any department. Contact admin.');
          return;
        }
        setUserDeptId(deptId);
      });
    } catch { /* auth not available */ }
  }, []);

  /* load visits for active tab */
  const loadVisits = useCallback(async (statuses: readonly VisitStatus[]) => {
    if (!userDeptId) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('department_id', userDeptId)
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (err) { setError(safeErrorMessage(err, 'Failed to load approvals.')); setLoading(false); return; }
    let raw = ((data as unknown as Visit[]) ?? []);
    raw = await attachHostNames(raw);
    setVisits(raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    setLoading(false);
  }, [userDeptId]);

  /* load today's visits — full join so notifications can open details */
  const loadTodayStats = useCallback(async () => {
    if (!userDeptId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('department_id', userDeptId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });
    if (data) {
      let raw = data as unknown as Visit[];
      raw = await attachHostNames(raw);
      setAllVisitsToday(raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    }
  }, [userDeptId]);

  useEffect(() => {
    if (!userDeptId) return;
    if (tab === 'pending') void loadVisits(['pending_approval'] as const);
    else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
    else if (tab === 'rejected') void loadVisits(['rejected'] as const);
  }, [tab, userDeptId, loadVisits]);

  useEffect(() => {
    if (userDeptId) {
      void loadTodayStats();
    }
  }, [userDeptId, loadTodayStats]);

  /* realtime */
  useEffect(() => {
    if (!userDeptId) return;
    const ch = supabase.channel('hod-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        if (tab === 'pending') void loadVisits(['pending_approval'] as const);
        else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
        else if (tab === 'rejected') void loadVisits(['rejected'] as const);
        void loadTodayStats();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tab, userDeptId, loadVisits, loadTodayStats]);

  /* pending count for badge */
  const pendingCount = useMemo(() =>
    allVisitsToday.filter((v) => v.status === 'pending_approval').length,
  [allVisitsToday]);

  /* notifications derived from today's visits */
  const notifications = useMemo(() => {
    return allVisitsToday
      .filter((v) => !dismissedNotifs.has(v.id))
      .slice(0, 10);
  }, [allVisitsToday, dismissedNotifs]);

  /* approve/reject */
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
      if (remaining <= 0) return { text: 'Escalation imminent', urgent: true };
      return { text: `${remaining}m left`, urgent: remaining <= 2 };
    }
    if (target === 'delegate') return { text: 'Escalated to delegate', urgent: true };
    if (target === 'admin') return { text: 'Escalated to Admin', urgent: true };
    return { text: 'Pending', urgent: false };
  };

  const refreshTab = () => {
    if (tab === 'pending') void loadVisits(['pending_approval'] as const);
    else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
    else if (tab === 'rejected') void loadVisits(['rejected'] as const);
  };

  const cancelVisit = async (visitId: string) => {
    if (!confirm('Cancel this pre-approval? The visitor will no longer be able to check in.')) return;
    setActing(visitId);
    try {
      const { error: err } = await supabase.from('visits').update({ status: 'cancelled' as any }).eq('id', visitId);
      if (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); return; }
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
      setSuccessMsg('Pre-approval cancelled.');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadTodayStats();
    } catch (err) { setError(safeErrorMessage(err, 'Failed to cancel.')); }
    finally { setActing(null); }
  };

  const clearAllApproved = async () => {
    if (!confirm('Cancel ALL pre-approved visitors? They will no longer be able to check in.')) return;
    setActing('clear-all');
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { error: err } = await supabase
        .from('visits')
        .update({ status: 'cancelled' as any })
        .eq('department_id', userDeptId!)
        .eq('status', 'approved')
        .gte('created_at', todayStart.toISOString());
      if (err) { setError(safeErrorMessage(err, 'Failed to clear.')); return; }
      setVisits([]);
      setSuccessMsg('All pre-approvals cancelled.');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadTodayStats();
    } catch (err) { setError(safeErrorMessage(err, 'Failed to clear.')); }
    finally { setActing(null); }
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="animate-fade-in space-y-6">
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Approvals</h1>
            <p className="page-subtitle">Visitor approvals &amp; activity</p>
          </div>
        </div>
        <button onClick={refreshTab} className="btn-icon" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* ── Alerts ────────────────────────────────────── */}
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

      {/* ── Main layout ───────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Left: tabs + visit list ─────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Tabs */}
          <div className="tab-group w-full mb-5">
            {TAB_CONFIG.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 flex-1 justify-center ${tab === key ? 'tab-active' : 'tab-inactive'}`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
                {key === 'pending' && pendingCount > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-sm">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Pending tab ───────────────────────────── */}
          {tab === 'pending' && (
            <div className="space-y-3 animate-fade-in">
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card p-4">
                      <div className="flex gap-3">
                        <div className="w-12 h-12 skeleton rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 skeleton w-2/3" />
                          <div className="h-3 skeleton w-1/2" />
                          <div className="h-3 skeleton w-1/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && visits.length === 0 && !error && (
                <div className="empty-state py-16">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 mb-3">
                    <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-base font-semibold text-navy-700">All caught up</p>
                  <p className="text-sm text-navy-400 mt-1">No pending approvals right now</p>
                </div>
              )}

              {visits.map((v, idx) => {
                const esc = escalationLabel(v);
                return (
                  <div
                    key={v.id}
                    className="card overflow-hidden animate-fade-in"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    {/* Escalation ribbon */}
                    <div className={`px-4 py-2 text-[11px] font-semibold flex items-center gap-2 ${
                      esc.urgent
                        ? 'bg-danger-600 text-white'
                        : 'bg-surface-100/60 text-navy-500 border-b border-surface-200/60 dark:border-white/[0.06]'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${esc.urgent ? 'bg-white animate-pulse' : 'bg-warning-500'}`} />
                      {esc.text}
                      <span className="ml-auto text-[10px] opacity-70 font-mono">{v.ref_number}</span>
                    </div>

                    <div className="p-4">
                      {/* Visit card header — time left, visitor, chips */}
                      <div className="flex gap-3 cursor-pointer" onClick={() => setDetailVisit(v)}>
                        {v.photo_url ? (
                          <img src={v.photo_url} alt="" className="w-11 h-11 object-cover rounded-xl shrink-0 ring-2 ring-surface-100" />
                        ) : (
                          <div className="w-11 h-11 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl shrink-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-brand-600">
                              {(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-navy-950">{v.visitor?.full_name ?? '--'}</p>
                            <span className="status-badge bg-warning-50 text-warning-700">Pending</span>
                          </div>
                          <p className="text-xs text-navy-400 truncate mt-0.5">
                            {v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.host?.full_name ? `${v.host.full_name}` : ''}
                          </p>
                          {/* Chips row */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-brand-100">
                              {purposeLabel(v.purpose)}
                            </span>
                            {v.expected_duration_minutes && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-navy-400 px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200/60">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" /></svg>
                                {fmtDuration(v.expected_duration_minutes)}
                              </span>
                            )}
                            <span className="text-[10px] text-navy-300 ml-auto">{timeAgo(v.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          maxLength={500}
                          placeholder="Rejection reason (required to reject)"
                          value={reasons[v.id] ?? ''}
                          onChange={(e) => setReasons((r) => ({ ...r, [v.id]: e.target.value }))}
                          className="input mb-2.5"
                        />
                        <div className="flex gap-2.5">
                          <button
                            onClick={() => setDetailVisit(v)}
                            className="px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Details
                          </button>
                          <button
                            onClick={() => decide(v.id, true)}
                            disabled={acting === v.id}
                            className="btn-accent flex-1 !py-2.5 flex items-center justify-center gap-1.5"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            Approve
                          </button>
                          <button
                            onClick={() => decide(v.id, false)}
                            disabled={acting === v.id}
                            className="flex-1 rounded-xl border border-danger-500/30 bg-danger-50/60 text-danger-700 hover:bg-danger-100 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
                          >
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

          {/* ── Approved tab ──────────────────────────── */}
          {tab === 'approved' && (
            <div className="space-y-3 animate-fade-in">
              {loading && <div className="text-center py-12 text-navy-400">Loading...</div>}
              {!loading && visits.length === 0 && (
                <div className="empty-state py-16">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 mb-3">
                    <svg className="w-7 h-7 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-base font-semibold text-navy-700">No approved visitors</p>
                  <p className="text-sm text-navy-400 mt-1">Approved visitors will appear here</p>
                </div>
              )}
              {!loading && visits.length > 0 && (
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-sm font-bold text-navy-700">{visits.length} Approved</p>
                  <button
                    onClick={clearAllApproved}
                    disabled={acting === 'clear-all'}
                    className="text-xs font-semibold text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Clear All
                  </button>
                </div>
              )}
              {visits.map((v) => {
                const style = STATUS_STYLES[v.status] ?? { bg: 'bg-surface-50', text: 'text-navy-700', label: v.status };
                return (
                  <div key={v.id} className="card p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-success-500 hover:shadow-sm transition-shadow" onClick={() => setDetailVisit(v)}>
                    <div className="flex gap-3 items-center">
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0 ring-2 ring-success-100" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-success-50 to-success-100 rounded-lg shrink-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-success-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-navy-950 text-sm">{v.visitor?.full_name ?? '--'}</p>
                          <span className={`status-badge ${style.bg} ${style.text}`}>{style.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-100 text-navy-400">{purposeLabel(v.purpose)}</span>
                          <span className="text-xs text-navy-400 truncate">{v.host?.full_name ?? ''}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                        <p className="text-[10px] text-navy-300">{formatTime(v.checked_in_at ?? v.created_at)}</p>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailVisit(v); }}
                            className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 flex items-center gap-0.5"
                          >
                            Open details
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelVisit(v.id); }}
                            disabled={acting === v.id}
                            className="text-[10px] font-semibold text-danger-500 hover:text-danger-700 flex items-center gap-0.5 disabled:opacity-50"
                          >
                            Cancel
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Rejected tab ──────────────────────────── */}
          {tab === 'rejected' && (
            <div className="space-y-3 animate-fade-in">
              {loading && <div className="text-center py-12 text-navy-400">Loading...</div>}
              {!loading && visits.length === 0 && (
                <div className="empty-state py-16">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                    <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  </div>
                  <p className="text-base font-semibold text-navy-700">No rejected visitors</p>
                  <p className="text-sm text-navy-400 mt-1">Rejected visits will appear here</p>
                </div>
              )}
              {visits.map((v) => (
                <div key={v.id} className="card p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-danger-500 hover:shadow-sm transition-shadow" onClick={() => setDetailVisit(v)}>
                  <div className="flex gap-3 items-start">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-danger-50 to-danger-100 rounded-lg shrink-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-danger-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-navy-950 text-sm">{v.visitor?.full_name ?? '--'}</p>
                        <span className="status-badge bg-danger-50 text-danger-700">Rejected</span>
                      </div>
                      <p className="text-xs text-navy-400 truncate mt-0.5">
                        {v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.host?.full_name ?? ''}
                      </p>
                      {v.rejection_reason && (
                        <div className="mt-2 rounded-lg bg-danger-50/60 px-2.5 py-2 text-xs text-danger-700 border border-danger-100 flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-danger-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          {v.rejection_reason}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-navy-300 font-mono shrink-0">{v.ref_number}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Pre-approve tab ───────────────────────── */}
          {tab === 'pre-approve' && (
            <div className="animate-fade-in">
              <PreApproveForm onPreApproved={(name, refNumber) => {
                setSuccessMsg(`"${name}" pre-approved — ref ${refNumber}`);
                setTimeout(() => setSuccessMsg(''), 6000);
              }} />
            </div>
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* Notifications panel */}
          <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-surface-200/60 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-navy-950">Notifications</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
                </span>
                <span className="text-[10px] font-semibold text-navy-400">Live</span>
              </div>
            </div>

            {/* Notification items */}
            <div className="divide-y divide-surface-200/50 dark:divide-white/[0.05] max-h-[420px] overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 mb-2">
                    <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                  </div>
                  <p className="text-xs text-navy-300">No activity today</p>
                </div>
              )}
              {notifications.map((v) => (
                <div key={v.id} className="px-4 py-3 hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1 shrink-0">
                      <span className={`h-2 w-2 rounded-full block ${notifDot(v.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-navy-500 uppercase tracking-wide leading-none mb-0.5">
                        {notifTitle(v.status)}
                      </p>
                      <p className="text-sm font-semibold text-navy-950 truncate">
                        {v.visitor?.full_name ?? 'Visitor'}
                      </p>
                      <p className="text-[10px] text-navy-300 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {timeAgo(v.created_at)}
                        {v.ref_number && <span className="font-mono opacity-60">· {v.ref_number}</span>}
                      </p>
                      <button
                        className="text-[11px] font-semibold text-brand-500 hover:text-brand-700 mt-1.5 flex items-center gap-0.5 transition-colors"
                        onClick={() => setDetailVisit(v)}
                      >
                        More information
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        title="View details"
                        onClick={() => setDetailVisit(v)}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-navy-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button
                        title="Dismiss"
                        onClick={() => setDismissedNotifs((s) => new Set([...s, v.id]))}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-navy-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {dismissedNotifs.size > 0 && (
              <div className="px-4 py-2.5 border-t border-surface-200/60 dark:border-white/[0.06]">
                <button
                  onClick={() => setDismissedNotifs(new Set())}
                  className="text-[11px] font-semibold text-navy-400 hover:text-brand-500 transition-colors w-full text-center"
                >
                  Show {dismissedNotifs.size} dismissed
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

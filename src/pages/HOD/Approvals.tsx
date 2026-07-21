import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, VisitStatus } from '../../types/index';
import { getEscalationTarget } from '../../lib/escalation';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import PreApproveForm from './PreApproveForm';
import { formatTime } from '../../lib/formatDate';
import VisitorDetails from '../../components/VisitorDetails';

/* ── Types ─────────────────────────────────────────── */
type Tab = 'pending' | 'approved' | 'rejected' | 'pre-approve';

interface DashboardStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgResponseMin: number | null;
}

/* ── Stat card config ──────────────────────────────── */
const STAT_CARDS: {
  key: keyof DashboardStats;
  label: string;
  icon: React.ReactNode;
  iconClass: string;
}[] = [
  {
    key: 'pending',
    label: 'Pending',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    iconClass: 'bg-warning-50 text-warning-600',
  },
  {
    key: 'approvedToday',
    label: 'Approved Today',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    iconClass: 'bg-success-50 text-success-600',
  },
  {
    key: 'rejectedToday',
    label: 'Rejected Today',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    iconClass: 'bg-danger-50 text-danger-600',
  },
  {
    key: 'avgResponseMin',
    label: 'Avg. Response',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
    iconClass: 'bg-brand-50 text-brand-600',
  },
];

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pending', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
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
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ── Component ─────────────────────────────────────── */
export default function HODApprovals(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('pending');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<Visit[]>([]);
  const [allVisitsToday, setAllVisitsToday] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

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

  /* load all today's visits for stats */
  const loadTodayStats = useCallback(async () => {
    if (!userDeptId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('visits')
      .select(`id, status, created_at`)
      .eq('department_id', userDeptId)
      .gte('created_at', todayStart.toISOString());
    if (data) setAllVisitsToday(data as unknown as Visit[]);
  }, [userDeptId]);

  /* load upcoming pre-approved visitors */
  const loadUpcoming = useCallback(async () => {
    if (!userDeptId) return;
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('department_id', userDeptId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(5);
    if (data) {
      let raw = data as unknown as Visit[];
      raw = await attachHostNames(raw);
      setUpcomingVisits(raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
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
      void loadUpcoming();
    }
  }, [userDeptId, loadTodayStats, loadUpcoming]);

  /* realtime */
  useEffect(() => {
    if (!userDeptId) return;
    const ch = supabase.channel('hod-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        if (tab === 'pending') void loadVisits(['pending_approval'] as const);
        else if (tab === 'approved') void loadVisits(['approved', 'walkin_approved'] as const);
        else if (tab === 'rejected') void loadVisits(['rejected'] as const);
        void loadTodayStats();
        void loadUpcoming();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tab, userDeptId, loadVisits, loadTodayStats, loadUpcoming]);

  /* computed stats */
  const stats = useMemo<DashboardStats>(() => {
    const pending = allVisitsToday.filter((v) => v.status === 'pending_approval').length;
    const approvedToday = allVisitsToday.filter((v) => ['approved', 'walkin_approved'].includes(v.status as string)).length;
    const rejectedToday = allVisitsToday.filter((v) => v.status === 'rejected').length;

    const withResponse = allVisitsToday.filter((v) => v.created_at);
    let avgResponseMin: number | null = null;
    if (withResponse.length > 0) {
      avgResponseMin = null;
    }

    return { pending, approvedToday, rejectedToday, avgResponseMin };
  }, [allVisitsToday]);

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

  const formatStatValue = (key: keyof DashboardStats, val: number | null): string => {
    if (val === null) return '--';
    if (key === 'avgResponseMin') return `${val}m`;
    return String(val);
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="animate-fade-in">
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* ── Header row ────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Visitor approvals & activity</p>
          </div>
        </div>
        <button onClick={refreshTab} className="btn-icon" title="Refresh">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* ── Stats cards row ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map(({ key, label, icon, iconClass }, idx) => (
          <div
            key={key}
            className={`stat-card group hover:-translate-y-0.5 animate-slide-up stagger-${idx + 1}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{label}</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${iconClass}`}>
                {icon}
              </div>
            </div>
            <p className="stat-value text-2xl">
              {formatStatValue(key, stats[key])}
            </p>
          </div>
        ))}
      </div>

      {/* ── Alerts ────────────────────────────────────── */}
      {successMsg && (
        <div className="alert-success mb-4">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-success-500 hover:text-success-700 text-xs font-medium">Dismiss</button>
        </div>
      )}
      {error && (
        <div className="alert-error mb-4">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* ── Main layout: content + right sidebar ─────── */}
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
                {key === 'pending' && stats.pending > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-sm">
                    {stats.pending}
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
                    className="card overflow-hidden animate-fade-in card-hover"
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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-navy-950 truncate">{v.visitor?.full_name ?? '--'}</p>
                            <span className="status-badge bg-warning-50 text-warning-700">Pending</span>
                          </div>
                          <p className="text-xs text-navy-400 truncate mt-0.5">
                            {v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.department?.name ?? ''} · {v.host?.full_name ?? ''}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-navy-300">
                            <span className="capitalize">{v.purpose}</span>
                            <span>{timeAgo(v.created_at)}</span>
                          </div>
                        </div>
                      </div>

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
              {visits.map((v) => {
                const style = STATUS_STYLES[v.status === 'approved' ? 'approved' : 'walkin_approved'] ?? { bg: 'bg-surface-50', text: 'text-navy-700', label: v.status };
                return (
                  <div key={v.id} className="card card-hover p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-success-500" onClick={() => setDetailVisit(v)}>
                    <div className="flex gap-3 items-center">
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0 ring-2 ring-success-100" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-success-50 to-success-100 rounded-lg shrink-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-success-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-navy-950 truncate text-sm">{v.visitor?.full_name ?? '--'}</p>
                          <span className={`status-badge ${style.bg} ${style.text}`}>{style.label}</span>
                        </div>
                        <p className="text-xs text-navy-400 truncate mt-0.5">{v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.department?.name} · {v.host?.full_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                        <p className="text-[10px] text-navy-300 mt-0.5">{formatTime(v.checked_in_at ?? v.created_at)}</p>
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
                <div key={v.id} className="card card-hover p-4 cursor-pointer animate-fade-in border-l-[3px] border-l-danger-500" onClick={() => setDetailVisit(v)}>
                  <div className="flex gap-3 items-start">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-danger-50 to-danger-100 rounded-lg shrink-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-danger-600">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy-950 truncate text-sm">{v.visitor?.full_name ?? '--'}</p>
                        <span className="status-badge bg-danger-50 text-danger-700">Rejected</span>
                      </div>
                      <p className="text-xs text-navy-400 truncate mt-0.5">{v.visitor?.company ? `${v.visitor.company} · ` : ''}{v.department?.name} · {v.host?.full_name}</p>
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
        <div className="w-full lg:w-80 shrink-0 space-y-4">

          {/* Upcoming Visitors card */}
          <div className="card-premium overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-surface-200/60 dark:border-white/[0.06]">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="section-title">Upcoming Visitors</p>
            </div>
            <div className="divide-y divide-surface-200/50 dark:divide-white/[0.05]">
              {upcomingVisits.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-navy-300">No upcoming visitors</p>
                </div>
              )}
              {upcomingVisits.map((v) => (
                <div
                  key={v.id}
                  className="px-4 py-3 hover:bg-surface-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => setDetailVisit(v)}
                >
                  <div className="flex gap-3 items-center">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="" className="w-9 h-9 object-cover rounded-lg shrink-0 ring-2 ring-brand-500/20" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-brand-50">
                        <span className="text-xs font-bold text-brand-600">
                          {(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-950 truncate">{v.visitor?.full_name ?? '--'}</p>
                      <p className="text-[11px] text-navy-400 truncate">
                        {v.host?.full_name ?? '--'} · <span className="capitalize">{v.purpose}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="glass-chip inline-flex items-center gap-1 !px-2 !py-1 text-[10px] font-semibold text-brand-600">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" />
                        </svg>
                        {fmtDuration(v.expected_duration_minutes)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity feed */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-200/60 dark:border-white/[0.06]">
              <p className="section-title">Recent Activity</p>
            </div>
            <div className="divide-y divide-surface-200/50 dark:divide-white/[0.05]">
              {allVisitsToday.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-navy-300">No activity today</p>
                </div>
              )}
              {allVisitsToday.slice(0, 8).map((v) => {
                const isApproved = v.status === 'approved' || v.status === 'walkin_approved';
                const isRejected = v.status === 'rejected';
                const isPending = v.status === 'pending_approval';
                return (
                  <div key={v.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-surface-100/60 dark:hover:bg-white/[0.03] transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      isApproved ? 'bg-success-500' :
                      isRejected ? 'bg-danger-500' :
                      isPending  ? 'bg-warning-500 animate-pulse' :
                      'bg-navy-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-navy-700 truncate">
                        {(v as any).visitor?.full_name ??
                          (isApproved ? 'Visit approved' :
                           isRejected ? 'Visit rejected' :
                           'New request')}
                      </p>
                      <p className="text-[10px] text-navy-300">
                        {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Awaiting review'}
                      </p>
                    </div>
                    <span className="text-[10px] text-navy-300 shrink-0">{timeAgo(v.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Summary */}
          <div className="card p-4">
            <p className="section-title mb-3">Today's Summary</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning-500" />
                  <span className="text-xs text-navy-400">Pending</span>
                </div>
                <span className="text-xs font-bold text-navy-950">{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success-500" />
                  <span className="text-xs text-navy-400">Approved</span>
                </div>
                <span className="text-xs font-bold text-navy-950">{stats.approvedToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-danger-500" />
                  <span className="text-xs text-navy-400">Rejected</span>
                </div>
                <span className="text-xs font-bold text-navy-950">{stats.rejectedToday}</span>
              </div>
              {/* Progress bar */}
              <div className="pt-1">
                <div className="h-1.5 rounded-full overflow-hidden flex bg-surface-200/70 dark:bg-white/[0.06]">
                  {(() => {
                    const total = stats.approvedToday + stats.rejectedToday + stats.pending;
                    if (total === 0) return <div className="w-full rounded-full bg-surface-200 dark:bg-white/[0.08]" />;
                    const aPct = (stats.approvedToday / total) * 100;
                    const rPct = (stats.rejectedToday / total) * 100;
                    const pPct = (stats.pending / total) * 100;
                    return (
                      <>
                        {aPct > 0 && <div className="bg-success-500 rounded-l-full transition-all duration-500" style={{ width: `${aPct}%` }} />}
                        {rPct > 0 && <div className="bg-danger-500 transition-all duration-500" style={{ width: `${rPct}%` }} />}
                        {pPct > 0 && <div className="bg-warning-500 rounded-r-full transition-all duration-500" style={{ width: `${pPct}%` }} />}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

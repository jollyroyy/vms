import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit, Notification, RecurringVisit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { formatRecurrenceLabel } from '../../lib/recurringVisits';

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

interface Stats {
  inside: number;
  approvedToday: number;
  pending: number;
  rejectedToday: number;
}

export default function HODOverview(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 });
  const [upcoming, setUpcoming] = useState<Visit[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [recurringVisits, setRecurringVisits] = useState<RecurringVisit[]>([]);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      supabase.from('profiles').select('department_id').eq('id', uid).maybeSingle().then(({ data: p }) => {
        setDeptId(p?.department_id ?? null);
      });
    });
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    if (!deptId || !userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: todayData } = await supabase
        .from('visits')
        .select('id, status')
        .eq('department_id', deptId)
        .gte('created_at', `${today}T00:00:00Z`);

      const todayRows = (todayData ?? []) as Array<{ id: string; status: string }>;

      setStats({
        inside: todayRows.filter(r => r.status === 'checked_in').length,
        approvedToday: todayRows.filter(r => r.status === 'approved' || r.status === 'walkin_approved').length,
        pending: todayRows.filter(r => r.status === 'pending_approval').length,
        rejectedToday: todayRows.filter(r => r.status === 'rejected').length,
      });

      const { data: upcomingData } = await supabase
        .from('visits')
        .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId)
        .in('status', ['pending_approval', 'approved'])
        .order('created_at', { ascending: true })
        .limit(15);

      let rows = ((upcomingData as unknown as Visit[]) ?? []);
      rows = await attachHostNames(rows);
      setUpcoming(rows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));

      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setNotifs((notifData ?? []) as Notification[]);

      const { data: recurringData } = await supabase
        .from('recurring_visits')
        .select('*')
        .eq('department_id', deptId)
        .order('visitor_name', { ascending: true });

      setRecurringVisits((recurringData ?? []) as RecurringVisit[]);
    } catch {
      // silent — dashboard is read-only and defensive
    }
    setLoading(false);
  }, [deptId, userId, today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!deptId || !userId) return;
    const ch = supabase.channel('hod-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, () => { void load(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [deptId, userId, load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const dismiss = (id: string) => {
    void supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtTime24 = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-950 dark:text-white tracking-tight">Overview</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500 dark:text-brand-300 mt-0.5">
            {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          <span className="text-sm font-bold text-navy-400 tabular-nums">
            {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Stats — 4 simple cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/approvals" className="bg-white rounded-xl border border-surface-200 p-4 hover:shadow-sm transition-shadow">
          <p className="text-3xl font-bold text-brand-600 tabular-nums">{loading ? '—' : stats.inside}</p>
          <p className="text-xs text-navy-400 font-medium mt-0.5">Inside</p>
        </Link>
        <Link to="/approvals" className="bg-white rounded-xl border border-surface-200 p-4 hover:shadow-sm transition-shadow">
          <p className="text-3xl font-bold text-success-600 tabular-nums">{loading ? '—' : stats.approvedToday}</p>
          <p className="text-xs text-navy-400 font-medium mt-0.5">Approved</p>
        </Link>
        <Link to="/approvals" className="bg-white rounded-xl border border-surface-200 p-4 hover:shadow-sm transition-shadow">
          <p className="text-3xl font-bold text-amber-600 tabular-nums">{loading ? '—' : stats.pending}</p>
          <p className="text-xs text-navy-400 font-medium mt-0.5">Pending</p>
        </Link>
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <p className="text-3xl font-bold text-danger-600 tabular-nums">{loading ? '—' : stats.rejectedToday}</p>
          <p className="text-xs text-navy-400 font-medium mt-0.5">Rejected</p>
        </div>
      </div>

      {/* Regular Visitors section */}
      {!loading && recurringVisits.length > 0 && (
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
            <div>
              <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Regular Visitors</h2>
              <p className="text-xs text-navy-400 mt-0.5">
                {recurringVisits.filter(r => r.is_active).length} active · recurring maids, vendors &amp; contractors
              </p>
            </div>
            <Link to="/approvals" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              Manage
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-white/[0.05]">
                  <th className="text-left text-[11px] font-bold text-navy-400 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-[11px] font-bold text-navy-400 uppercase tracking-wider px-5 py-3">Phone</th>
                  <th className="text-left text-[11px] font-bold text-navy-400 uppercase tracking-wider px-5 py-3">Schedule</th>
                  <th className="text-left text-[11px] font-bold text-navy-400 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-right text-[11px] font-bold text-navy-400 uppercase tracking-wider px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-white/[0.04]">
                {recurringVisits.slice(0, 5).map((r) => (
                  <tr key={r.id} className="hover:bg-surface-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-navy-900 dark:text-white">{r.visitor_name}</td>
                    <td className="px-5 py-3.5 text-navy-400">{r.visitor_phone}</td>
                    <td className="px-5 py-3.5 text-navy-500">{formatRecurrenceLabel(r)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.is_active
                          ? 'bg-success-50 text-success-700'
                          : 'bg-surface-100 text-navy-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${r.is_active ? 'bg-success-500 animate-pulse-soft' : 'bg-navy-300'}`} />
                        {r.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={async () => {
                          await supabase.from('recurring_visits').update({ is_active: !r.is_active }).eq('id', r.id);
                          void load();
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                          r.is_active
                            ? 'text-danger-600 hover:bg-danger-50 border border-danger-200/60'
                            : 'text-success-600 hover:bg-success-50 border border-success-200/60'
                        }`}
                      >
                        {r.is_active ? 'Pause' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recurringVisits.length > 5 && (
            <div className="px-5 py-3 border-t border-surface-100 dark:border-white/[0.05] text-center">
              <Link to="/approvals" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View all {recurringVisits.length} regular visitors
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">

        {/* Upcoming visits */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
            <div>
              <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Upcoming visits</h2>
              <p className="text-xs text-navy-400 mt-0.5">
                Pending &amp; pre-approved · up to 30 days ahead, max 15 entries
              </p>
            </div>
            {!loading && (
              <span className="text-[11px] font-bold text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
                {upcoming.length} visit{upcoming.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[0, 1, 2].map(i => <div key={i} className="skeleton h-[72px] w-full rounded-xl" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center text-center">
              <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
              <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No upcoming visits</p>
              <p className="text-xs text-navy-400 mt-1">Scheduled and pre-approved visits will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-white/[0.04]">
              {upcoming.map((v) => {
                const timeStr = fmtTime24(v.created_at);
                const dateStr = fmtDate(v.created_at).slice(0, 5); // DD/MM
                const isApproved = v.status === 'approved' || v.status === 'walkin_approved';
                return (
                  <div
                    key={v.id}
                    className="flex items-stretch hover:bg-surface-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Time block */}
                    <div className="shrink-0 w-[72px] flex flex-col items-center justify-center py-4 px-2">
                      <span className="font-display font-bold text-[15px] text-navy-900 dark:text-white tabular-nums leading-none">
                        {timeStr}
                      </span>
                      <span className="text-[11px] text-navy-400 mt-0.5 tabular-nums">{dateStr}</span>
                    </div>
                    {/* Separator */}
                    <div className="w-px bg-surface-200/70 dark:bg-white/[0.07] self-stretch my-3 shrink-0" />
                    {/* Content */}
                    <div className="flex-1 min-w-0 py-4 px-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-navy-900 dark:text-white leading-snug">
                            {PURPOSE_LABELS[v.purpose] ?? v.purpose}
                            {v.visitor?.company && (
                              <span className="text-navy-400 font-normal"> — {v.visitor.company}</span>
                            )}
                          </p>
                          <p className="text-xs text-navy-400 mt-0.5">
                            {v.host?.full_name ? `Host: ${v.host.full_name}` : 'Host: —'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25'}`}>{isApproved ? 'Pre-Approved' : 'Pending'}</span>
                          <Link
                            to="/approvals"
                            className="text-[11px] font-semibold text-navy-600 dark:text-navy-300 bg-surface-100 dark:bg-white/[0.06] hover:bg-surface-200 dark:hover:bg-white/[0.10] border border-surface-200 dark:border-white/[0.08] px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Open details
                          </Link>
                        </div>
                      </div>
                      {/* Participant tags */}
                      {v.visitor && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <span className="inline-flex items-center text-[11px] font-medium bg-surface-100 dark:bg-white/[0.06] text-navy-600 dark:text-navy-300 px-2.5 py-0.5 rounded-full border border-surface-200/70 dark:border-white/[0.08]">
                            {v.visitor.full_name}
                          </span>
                          {v.visitor.company && (
                            <span className="inline-flex items-center text-[11px] font-medium bg-surface-100 dark:bg-white/[0.06] text-navy-500 dark:text-navy-400 px-2.5 py-0.5 rounded-full border border-surface-200/70 dark:border-white/[0.08]">
                              {v.visitor.company}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
            <div>
              <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Status &amp; Notifications</h2>
              <p className="text-xs text-navy-400 mt-0.5">Real-time visitor arrivals</p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
              </span>
              Live
            </span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="skeleton h-[84px] w-full rounded-xl" />)}
            </div>
          ) : notifs.length === 0 ? (
            <div className="py-14 px-5 flex flex-col items-center text-center">
              <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No notifications</p>
              <p className="text-xs text-navy-400 mt-1">Visitor arrivals will appear here in real-time.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-white/[0.04] overflow-y-auto max-h-[520px]">
              {notifs.map((n) => {
                const isArrival = n.type === 'visitor_checked_in';
                const isUnread = !n.is_read;
                return (
                  <div
                    key={n.id}
                    className={`px-5 py-4 transition-colors ${isUnread ? 'bg-brand-50/40 dark:bg-brand-500/[0.04]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${isArrival ? 'bg-success-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-bold text-navy-900 dark:text-white truncate">{n.title}</span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => void markRead(n.id)}
                          title="Mark as read"
                          className="p-1.5 rounded-lg text-navy-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => dismiss(n.id)}
                          title="Dismiss"
                          className="p-1.5 rounded-lg text-navy-300 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-navy-400 ml-4">
                      {fmtDate(n.created_at)} {fmtTime24(n.created_at)}
                    </p>
                    <p className="text-xs text-navy-600 dark:text-navy-300 mt-1.5 ml-4 leading-relaxed">{n.body}</p>
                    <Link
                      to="/approvals"
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline mt-1.5 ml-4 block"
                    >
                      More information →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
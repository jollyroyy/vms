import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { UserRole, Visit } from '../types/index';
import { attachHostNames } from '../lib/hostNames';
import { formatTime } from '../lib/formatDate';

interface Props {
  role: UserRole | null;
}

interface StatDef {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  tint: string; // gradient classes for the icon tile
  to?: string;
}

const STATUS_CHIP: Record<Visit['status'], { label: string; cls: string }> = {
  pending_approval: { label: 'Pending',      cls: 'bg-warning-500/15 text-warning-600 dark:text-warning-400 border-warning-500/25' },
  approved:         { label: 'Pre-Approved', cls: 'bg-success-500/15 text-success-600 dark:text-success-400 border-success-500/25' },
  walkin_approved:  { label: 'Approved',     cls: 'bg-brand-500/15 text-brand-600 dark:text-brand-300 border-brand-500/25' },
  checked_in:       { label: 'Inside',       cls: 'bg-brand-500/15 text-brand-600 dark:text-brand-300 border-brand-500/25' },
  checked_out:      { label: 'Left',         cls: 'bg-navy-500/10 text-navy-400 border-navy-500/20' },
  rejected:         { label: 'Rejected',     cls: 'bg-danger-500/15 text-danger-600 dark:text-danger-400 border-danger-500/25' },
};

const ICONS = {
  users:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  clock:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  check:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  doc:     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  out:     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
  chart:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  arrow:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>,
};

export default function DashboardPage({ role }: Props): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Visit[]>([]);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    setLoading(true);
    const next: Record<string, number> = {};
    try {
      // Today's visits (all statuses)
      const visitsToday = await supabase
        .from('visits')
        .select('id, status, created_at', { count: 'exact' })
        .gte('created_at', `${today}T00:00:00Z`);
      const rows = (visitsToday.data ?? []) as Array<{ id: string; status: Visit['status']; created_at: string }>;
      next.today = visitsToday.count ?? rows.length;
      next.inside = rows.filter((r) => r.status === 'checked_in').length;
      next.pending = rows.filter((r) => r.status === 'pending_approval').length;
      next.checkedOut = rows.filter((r) => r.status === 'checked_out').length;
      next.preApproved = rows.filter((r) => r.status === 'approved' || r.status === 'walkin_approved').length;
      next.rejected = rows.filter((r) => r.status === 'rejected').length;

      // Gate passes
      const passes = await supabase.from('gate_passes').select('id, status', { count: 'exact' });
      const passRows = (passes.data ?? []) as Array<{ id: string; status: string }>;
      next.passesTotal = passes.count ?? passRows.length;
      next.passesPending = passRows.filter((p) => p.status === 'pending_approval').length;
      next.passesOpen = passRows.filter((p) => ['approved', 'dispatched', 'awaiting_return', 'partially_returned'].includes(p.status)).length;

      // Profiles (admin overview)
      if (role === 'admin' || role === 'super_admin') {
        const prof = await supabase.from('profiles').select('id', { count: 'exact', head: true });
        next.users = prof.count ?? 0;
      }

      // Recent activity
      const recentRes = await supabase
        .from('visits')
        .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .order('created_at', { ascending: false })
        .limit(6);
      let recentRows = ((recentRes.data as unknown as Visit[]) ?? []);
      recentRows = await attachHostNames(recentRows);
      setRecent(recentRows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    } catch {
      // Dashboard is read-only and defensive — never block the user.
    }
    setCounts(next);
    setLoading(false);
  }, [today, role]);

  useEffect(() => {
    void load();
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const stats: StatDef[] = useMemo(() => {
    const c = counts;
    switch (role) {
      case 'guard':
        return [
          { label: "Today's Visits", value: c.today ?? 0, icon: ICONS.chart, tint: 'from-brand-500 to-brand-700', to: '/guard' },
          { label: 'Currently Inside', value: c.inside ?? 0, icon: ICONS.users, tint: 'from-accent-500 to-accent-700', to: '/whos-inside' },
          { label: 'Pending Approval', value: c.pending ?? 0, icon: ICONS.clock, tint: 'from-amber-500 to-orange-600', to: '/guard' },
          { label: 'Checked Out', value: c.checkedOut ?? 0, icon: ICONS.out, tint: 'from-emerald-500 to-teal-600', to: '/guard' },
        ];
      case 'hod':
        return [
          { label: 'Pending Approvals', value: c.pending ?? 0, icon: ICONS.clock, tint: 'from-amber-500 to-orange-600', to: '/approvals' },
          { label: 'Pre-Approved', value: c.preApproved ?? 0, icon: ICONS.check, tint: 'from-emerald-500 to-teal-600', to: '/approvals' },
          { label: 'Inside Now', value: c.inside ?? 0, icon: ICONS.users, tint: 'from-accent-500 to-accent-700', to: '/whos-inside' },
          { label: "Today's Visits", value: c.today ?? 0, icon: ICONS.chart, tint: 'from-brand-500 to-brand-700', to: '/reports' },
        ];
      case 'staff':
        return [
          { label: 'Inside Now', value: c.inside ?? 0, icon: ICONS.users, tint: 'from-accent-500 to-accent-700', to: '/whos-inside' },
          { label: "Today's Visits", value: c.today ?? 0, icon: ICONS.chart, tint: 'from-brand-500 to-brand-700', to: '/whos-inside' },
          { label: 'Open Gate Passes', value: c.passesOpen ?? 0, icon: ICONS.doc, tint: 'from-amber-500 to-orange-600', to: '/gate-passes' },
          { label: 'Passes Pending', value: c.passesPending ?? 0, icon: ICONS.clock, tint: 'from-emerald-500 to-teal-600', to: '/gate-passes' },
        ];
      case 'admin':
      case 'super_admin':
        return [
          { label: "Today's Visits", value: c.today ?? 0, icon: ICONS.chart, tint: 'from-brand-500 to-brand-700', to: '/reports' },
          { label: 'Inside Now', value: c.inside ?? 0, icon: ICONS.users, tint: 'from-accent-500 to-accent-700', to: '/reports' },
          { label: 'Gate Passes', value: c.passesTotal ?? 0, icon: ICONS.doc, tint: 'from-amber-500 to-orange-600', to: '/reports' },
          { label: 'System Users', value: c.users ?? 0, icon: ICONS.check, tint: 'from-emerald-500 to-teal-600', to: '/admin' },
        ];
      default:
        return [
          { label: "Today's Visits", value: c.today ?? 0, icon: ICONS.chart, tint: 'from-brand-500 to-brand-700' },
          { label: 'Inside Now', value: c.inside ?? 0, icon: ICONS.users, tint: 'from-accent-500 to-accent-700' },
        ];
    }
  }, [counts, role]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top bar: date + live clock */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-300">
          {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          <span className="text-xs font-semibold text-navy-400 tabular-nums">
            {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Asymmetric stat grid — first card spans 2 cols on xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const isFeatured = i === 0;
          const inner = (
            <div className={`flex flex-col gap-3 ${isFeatured ? 'xl:col-span-2' : ''}`}>
              <div className={`${isFeatured ? 'flex items-center justify-between' : ''}`}>
                <div className={`${isFeatured ? 'h-14 w-14' : 'h-11 w-11'} rounded-2xl bg-gradient-to-br ${s.tint} flex items-center justify-center text-white shadow-md ring-1 ring-white/20`}>
                  <div className={`${isFeatured ? 'scale-125' : ''}`}>{s.icon}</div>
                </div>
                {s.to && <span className="text-navy-300 group-hover:text-navy-500 transition-colors text-xs">{ICONS.arrow}</span>}
              </div>
              {loading ? (
                <div className="skeleton h-8 w-20" />
              ) : (
                <div className={`font-display font-bold tracking-tight text-navy-950 ${isFeatured ? 'text-4xl' : 'text-2xl'}`}>
                  {s.value ?? '—'}
                </div>
              )}
              <p className="text-xs text-navy-400 font-medium">{s.label}</p>
            </div>
          );
          const cls = `p-5 rounded-2xl border border-surface-200/70 dark:border-white/[0.06] ${isFeatured ? 'xl:col-span-2 row-span-2' : ''} ${isFeatured ? 'bg-gradient-to-br from-white to-surface-50 dark:from-white/5 dark:to-white/[0.02]' : 'bg-white dark:bg-white/[0.04]'} hover:shadow-sm transition-shadow duration-200`;
          return s.to ? (
            <Link key={s.label} to={s.to} className={cls}>{inner}</Link>
          ) : (
            <div key={s.label} className={cls}>{inner}</div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="font-display text-sm font-bold text-navy-950 tracking-tight">Recent Activity</h2>
            <p className="text-xs text-navy-400 mt-0.5">Latest events</p>
          </div>
          <span className="text-[11px] font-semibold text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
            </span>
            Live
          </span>
        </div>
        {loading ? (
          <div className="px-6 pb-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 w-full" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="px-6 pb-8 pt-2 text-center">
            <p className="text-xs text-navy-400">No recent activity yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-200/40 dark:divide-white/[0.05]">
            {recent.map((v) => {
              const chip = STATUS_CHIP[v.status];
              const name = v.visitor?.full_name ?? 'Visitor';
              const initial = name.slice(0, 1).toUpperCase();
              return (
                <div key={v.id} className="flex items-center gap-3 px-6 py-3 hover:bg-surface-100/50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500/20 to-accent-500/20 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900 truncate">{name}</p>
                    <p className="text-xs text-navy-400 truncate">
                      {v.ref_number}{v.department?.name ? ` · ${v.department.name}` : ''}
                    </p>
                  </div>
                  <div className="hidden sm:block text-xs text-navy-400 tabular-nums mr-2">{formatTime(v.created_at)}</div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border ${chip.cls}`}>{chip.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

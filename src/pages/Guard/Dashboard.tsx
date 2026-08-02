import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useExpectedToday } from '../../lib/useExpectedToday';
import { useInsideNow } from '../../lib/useInsideNow';
import type { ReportVisit } from '../../lib/reportRow';
import GuardExpectedToday from './GuardExpectedToday';
import GuardInsideNow from './GuardInsideNow';
import VisitorDetails from '../../components/VisitorDetails';

interface Stats {
  inside: number;
  expectedToday: number;
  checkedOut: number;
  noShow: number;
  totalToday: number;
  rejected: number;
}

export default function GuardDashboard(): React.ReactElement {
  const [stats, setStats] = useState<Stats>({ inside: 0, expectedToday: 0, checkedOut: 0, noShow: 0, totalToday: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const { visits: expectedToday, loading: expectedLoading } = useExpectedToday(today);
  // On-site data lives on this page now — there is no separate "On-site" tile
  // to click through to, so the cards render inline below the KPI grid.
  const { visits: insideVisits, loading: insideLoading } = useInsideNow(today);
  const [showInside, setShowInside] = useState(true);
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: visits } = await supabase.from('visits').select('id, status').gte('created_at', `${today}T00:00:00Z`);
    const v = (visits ?? []) as Array<{ id: string; status: string }>;
    setStats({
      inside: v.filter(r => r.status === 'checked_in').length,
      expectedToday: v.filter(r => ['approved', 'walkin_approved'].includes(r.status)).length,
      checkedOut: v.filter(r => r.status === 'checked_out').length,
      noShow: v.filter(r => r.status === 'no_show').length,
      totalToday: v.length,
      rejected: v.filter(r => r.status === 'rejected' || r.status === 'cancelled').length,
    });
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('guard-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const cards = [
    { label: 'Inside Now', value: stats.inside, color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-500/10', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', link: null },
    { label: 'Expected Today', value: stats.expectedToday, color: 'text-success-600', bg: 'bg-success-50', ring: 'ring-success-500/10', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', link: '/visitors?tab=expected' },
    { label: 'Checked Out', value: stats.checkedOut, color: 'text-navy-600', bg: 'bg-surface-100', ring: 'ring-navy-500/10', icon: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9', link: '/visitors?tab=checked-out' },
    { label: 'No Show', value: stats.noShow, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500/10', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', link: '/visitors?tab=no-show' },
    { label: 'Total Visits Today', value: stats.totalToday, color: 'text-brand-700', bg: 'bg-brand-50/60', ring: 'ring-brand-500/10', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', link: '/visitors?tab=all' },
    { label: 'Cancelled / Rejected', value: stats.rejected, color: 'text-danger-600', bg: 'bg-danger-50/60', ring: 'ring-danger-500/10', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', link: '/visitors?tab=rejected' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          {/* "Security Gate" carries the page heading — the redundant
              "Dashboard" title was removed at the user's request. */}
          <h1 className="font-display text-2xl font-bold text-navy-950 dark:text-white tracking-tight">Security Gate</h1>
          <p className="text-sm text-navy-400 mt-0.5">
            Today at a glance &middot; {clock.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card, idx) => {
          const body = (
            <>
              <div className={`h-9 w-9 rounded-xl ${card.bg} flex items-center justify-center mb-2 ring-1 ${card.ring}`}>
                <svg className={`w-4.5 h-4.5 ${card.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{loading ? '—' : card.value}</p>
              <p className="text-xs text-navy-400 font-medium mt-0.5">{card.label}</p>
            </>
          );
          const shell = 'bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 dark:border-white/[0.06] p-4 hover:shadow-sm transition-all animate-slide-up';
          const style = { animationDelay: `${idx * 0.04}s` };
          // Inside Now has no destination — its detail cards are on this page,
          // so the tile toggles them instead of navigating away.
          if (card.link === null) {
            return (
              <button key={card.label} type="button" aria-expanded={showInside}
                onClick={() => setShowInside((prev) => !prev)}
                className={`${shell} text-left`} style={style}>
                {body}
              </button>
            );
          }
          return <Link key={card.label} to={card.link} className={shell} style={style}>{body}</Link>;
        })}
      </div>

      {/* On-site visitors, inline — replaces the old "On-site" tile that linked
          out to /whos-inside. Toggled by the Inside Now tile above. */}
      {showInside && (
        <GuardInsideNow loading={insideLoading} visits={insideVisits} onSelect={setDetailVisit} />
      )}

      {/* Expected today, with arrival times */}
      <GuardExpectedToday loading={expectedLoading} visits={expectedToday} />

      {detailVisit && (
        <VisitorDetails visit={detailVisit} viewerRole="guard" onClose={() => setDetailVisit(null)} />
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import PreRegisteredCard, { type PreRegisteredPill } from './PreRegisteredCard';
import GlanceRail from './GlanceRail';
import OverdueBanner from './OverdueBanner';

// Pre-Registered Arrivals — reference screen 3.
//
// Filter chips (All / Arriving Today / Arrived / Missed / Late) with live
// counts, a visitor-or-host search box, the three-column card grid (circular
// headshot, name, company, host, clocked time, ARRIVED/WAITING/EXPECTED pill)
// and the right-rail "Today at a Glance" (morning arrivals, afternoon
// expected, VIP count, schedule list) exactly as framed in the attachment.
//
// Data is the single today-visits subscription; chips and counts are derived
// slices of it so the pills can never disagree with the rail numbers.
// "Missed" = approved today whose scheduled time has already passed with no
// check-in; "Late" = missed AND the slot is more than 30 minutes in the past.

type ChipKey = 'all' | 'arriving' | 'arrived' | 'missed' | 'late';

const CHIP_ORDER: { key: ChipKey; label: string; cls: string }[] = [
  { key: 'all', label: 'All', cls: '' },
  { key: 'arriving', label: 'Arriving Today', cls: '' },
  { key: 'arrived', label: 'Arrived', cls: '' },
  { key: 'missed', label: 'Missed', cls: '' },
  { key: 'late', label: 'Late', cls: '' },
];

const ARRIVAL = 'approved' as const;
const WALKIN_APPROVED = 'walkin_approved' as const;
const CHECKED_IN = 'checked_in' as const;

function isPreRegistered(v: ReportVisit): boolean {
  // Pre-registered = raised BEFORE walking in. approved slots and any slot the
  // host already cleared (walkin_approved) are the pre-registered universe;
  // pending_approval rows live on the HOD's desk, not at the gate's board.
  return v.status === ARRIVAL || v.status === WALKIN_APPROVED || v.status === CHECKED_IN;
}

function pillFor(v: ReportVisit, now: Date): PreRegisteredPill {
  if (v.status === CHECKED_IN) {
    return { label: 'ARRIVED', cls: 'bg-success-600/15 text-success-500 border-success-500/30' };
  }
  const slot = v.scheduled_for ? new Date(v.scheduled_for).getTime() : null;
  if (slot && slot < now.getTime()) {
    const minutesPast = (now.getTime() - slot) / 60000;
    return {
      label: minutesPast > 30 ? 'LATE' : 'MISSED',
      cls: minutesPast > 30 ? 'bg-warning-500/15 text-warning-400 border-warning-400/30' : 'bg-danger-600/15 text-danger-400 border-danger-500/30',
    };
  }
  return { label: 'EXPECTED', cls: 'bg-brand-600/15 text-brand-400 border-brand-500/30' };
}

export default function GuardPreRegistered(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [chip, setChip] = useState<ChipKey>('all');
  const [query, setQuery] = useState('');
  const today = istDateKey(clock);
  const { visits, loading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const preReg = useMemo(() => visits.filter(isPreRegistered), [visits]);
  const now = clock.getTime();

  const counts = useMemo(() => {
    const arrived = preReg.filter((v) => v.status === CHECKED_IN).length;
    const missed = preReg.filter((v) => v.status !== CHECKED_IN && v.scheduled_for && new Date(v.scheduled_for).getTime() < now && (now - new Date(v.scheduled_for).getTime()) / 60000 <= 30).length;
    const late = preReg.filter((v) => v.status !== CHECKED_IN && v.scheduled_for && (now - new Date(v.scheduled_for).getTime()) / 60000 > 30).length;
    const arriving = preReg.length - arrived - missed - late;
    return { all: preReg.length, arriving, arrived, missed, late };
  }, [preReg, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (v: ReportVisit) =>
      !q ||
      (v.visitor?.full_name ?? '').toLowerCase().includes(q) ||
      (v.visitor?.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.host?.full_name ?? '').toLowerCase().includes(q) ||
      (v.department?.name ?? '').toLowerCase().includes(q);
    let list = preReg.filter(matchesQuery);
    if (chip === 'arriving') list = list.filter((v) => v.status !== CHECKED_IN && v.scheduled_for && new Date(v.scheduled_for).getTime() >= now && (now - new Date(v.scheduled_for).getTime()) / 60000 <= 30);
    else if (chip === 'arrived') list = list.filter((v) => v.status === CHECKED_IN);
    else if (chip === 'missed') list = list.filter((v) => v.status !== CHECKED_IN && v.scheduled_for && new Date(v.scheduled_for).getTime() < now && (now - new Date(v.scheduled_for).getTime()) / 60000 <= 30);
    else if (chip === 'late') list = list.filter((v) => v.status !== CHECKED_IN && v.scheduled_for && (now - new Date(v.scheduled_for).getTime()) / 60000 > 30);
    // Board order: scheduled time asc, walk-ins without a slot last.
    return [...list].sort((a, b) => (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at));
  }, [preReg, chip, query, now]);

  // Today at a Glance: morning window (before noon), afternoon window (from
  // noon), VIP = visits whose purpose mentions VIP/VIP-escorted/important.
  const morning = preReg.filter((v) => v.scheduled_for && new Date(v.scheduled_for).getHours() < 12).length;
  const afternoon = preReg.filter((v) => v.scheduled_for && new Date(v.scheduled_for).getHours() >= 12).length;
  const vipCount = preReg.filter((v) => /(vip|important|executive)/i.test(v.purpose ?? '')).length;
  const overdue = counts.missed + counts.late;

  const chipBadgeCls = (k: ChipKey) =>
    k === 'arriving' ? 'text-brand-400' : k === 'arrived' ? 'text-success-500' : k === 'missed' ? 'text-danger-400' : k === 'late' ? 'text-warning-400' : 'text-navy-400';

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <header className="revamp-greeting">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="revamp-greeting-eyebrow">Pre-Registered</p>
            <p className="revamp-greeting-title">Pre-Registered Arrivals</p>
            <p className="revamp-greeting-sub">{counts.all} visitors expected to arrive today.</p>
          </div>
          <span className="flex items-center gap-3">
            <span className="glass-chip !py-1 !px-2.5 !gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-success-700">Live</span>
            </span>
            <span className="font-bold text-navy-700 dark:text-navy-200 text-lg tabular-nums">
              {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
        </div>
      </header>

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center gap-2.5">
        {CHIP_ORDER.map((c) => {
          const active = chip === c.key;
          const n = counts[c.key as keyof typeof counts];
          return (
            <button
              key={c.key}
              onClick={() => setChip(c.key)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-brand-600 border-brand-500 text-white shadow-glow-sm'
                  : 'border-surface-200/60 dark:border-white/[0.08] bg-surface-100/60 dark:bg-white/[0.03] text-navy-700 dark:text-navy-200 hover:bg-brand-600/10'
              }`}>
              {c.label}
              <span className={`text-xs font-bold tabular-nums ${active ? 'text-white/90' : chipBadgeCls(c.key)}`}>{n}</span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visitor or host…"
            className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/60 dark:bg-white/[0.03] pl-9 pr-4 py-2 text-sm text-navy-950 dark:text-navy-100 placeholder:text-navy-400 w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">
        {/* Card grid */}
        <div className="xl:col-span-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-4 h-44 animate-pulse" />
              ))}
            {!loading && filtered.map((v, i) => (
              <PreRegisteredCard key={v.id} visit={v} index={i} pill={pillFor(v, clock)} />
            ))}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-10 text-center text-navy-400 text-sm">
                No pre-registered visitors match this filter.
              </div>
            )}
          </div>

          <OverdueBanner count={overdue} />
        </div>

        {/* Right rail — Today at a Glance */}
        <GlanceRail filtered={filtered} morning={morning} afternoon={afternoon} vipCount={vipCount} pillFor={pillFor} clock={clock} />
      </div>
    </div>
  );
}

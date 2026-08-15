import React, { useEffect, useMemo, useState } from 'react';
import { usePreRegisteredVisits } from '../../lib/usePreRegisteredVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import {
  chipCounts,
  chipVisits,
  isScheduledToday,
  preRegisteredPill,
  type PreRegisteredChip,
} from '../../lib/preRegisteredBoard';
import PreRegisteredCard from './PreRegisteredCard';
import GlanceRail from './GlanceRail';
import OverdueBanner from './OverdueBanner';
import VisitorCheckInFlow from './VisitorCheckInFlow';
import SuccessToast from '../../components/SuccessToast';

// Pre-Registered Arrivals — reference screen 3.
//
// Filter chips (All / Arriving Today / Arrived / Missed / Late) with live
// counts, a visitor-or-host search box, the three-column card grid (circular
// headshot, name, company, host, clocked time, ARRIVED/WAITING/EXPECTED pill)
// and the right-rail "Today at a Glance" (morning arrivals, afternoon
// expected, VIP count, schedule list) exactly as framed in the attachment.
//
// THE BOARD IS THE WHOLE PRE-REGISTRATION RECORD, not today's slice (client
// instruction, 2026-08-15). It read `useTodayVisits`, so a visitor who was
// pre-registered last week was simply absent from the tab named after them.
// `usePreRegisteredVisits` fetches every pre-approved visit, whatever became of
// it, and today-ness moved to where it belongs: the four dated chips and the
// Today at a Glance rail, each of which says "today" on its face.
//
// The chip predicates and the card pills live in `lib/preRegisteredBoard.ts` —
// one rule per chip, so a badge's number is the length of the list it opens.

const CHIP_ORDER: { key: PreRegisteredChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'arriving', label: 'Arriving Today' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'missed', label: 'Missed' },
  { key: 'late', label: 'Late' },
];

export default function GuardPreRegistered(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [chip, setChip] = useState<PreRegisteredChip>('all');
  const [query, setQuery] = useState('');
  // The visitor currently being checked in. It is a mode of this page rather
  // than a separate route: the guard is standing in front of the person, and
  // this board is where they were just reading that person's name.
  // The hook subscribes to `visits`, so the board refreshes once check-in writes.
  const [checkingIn, setCheckingIn] = useState<ReportVisit | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { visits: preReg, loading, truncated } = usePreRegisteredVisits();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Recomputed on the minute, not the second: every rule on this board turns on
  // whole minutes past a slot, so a per-second identity would re-slice the whole
  // list sixty times for nothing.
  const minuteKey = `${istDateKey(clock)}T${clock.getHours()}:${clock.getMinutes()}`;
  const now = useMemo(() => new Date(clock), [minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => chipCounts(preReg, now), [preReg, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (v: ReportVisit) =>
      !q ||
      (v.visitor?.full_name ?? '').toLowerCase().includes(q) ||
      (v.visitor?.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.host?.full_name ?? '').toLowerCase().includes(q) ||
      (v.department?.name ?? '').toLowerCase().includes(q);
    const list = chipVisits(chip, preReg, now).filter(matchesQuery);
    // Board order: most recent slot first, so the whole-history "All" view opens
    // on the arrivals a guard is actually likely to be asked about.
    return [...list].sort((a, b) => (b.scheduled_for ?? b.created_at).localeCompare(a.scheduled_for ?? a.created_at));
  }, [preReg, chip, query, now]);

  // Today at a Glance is TODAY's, whatever chip is showing — the rail's own
  // heading says so, and it is the one panel on this page that did not change
  // meaning when the board widened to all history.
  // Ascending, unlike the board: a schedule is read forwards.
  const todays = useMemo(
    () => preReg
      .filter((v) => isScheduledToday(v, now))
      .sort((a, b) => (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at)),
    [preReg, now],
  );
  const morning = todays.filter((v) => v.scheduled_for && new Date(v.scheduled_for).getHours() < 12).length;
  const afternoon = todays.filter((v) => v.scheduled_for && new Date(v.scheduled_for).getHours() >= 12).length;
  const vipCount = todays.filter((v) => /(vip|important|executive)/i.test(v.purpose ?? '')).length;
  const overdue = counts.missed + counts.late;

  const chipBadgeCls = (k: PreRegisteredChip) =>
    k === 'arriving' ? 'text-brand-400'
      : k === 'arrived' ? 'text-success-500'
        : k === 'missed' ? 'text-danger-400'
          : k === 'late' ? 'text-warning-400' : 'text-navy-400';

  if (checkingIn) {
    return (
      <div className="animate-fade-in pb-4">
        <VisitorCheckInFlow
          visit={checkingIn}
          onDone={(name) => {
            setCheckingIn(null);
            setToast(`"${name}" checked in.`);
            setTimeout(() => setToast(null), 4000);
          }}
          onCancel={() => setCheckingIn(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <SuccessToast message={toast} onDismiss={() => setToast(null)} />
      <header className="revamp-greeting">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="revamp-greeting-eyebrow">Pre-Registered</p>
            <p className="revamp-greeting-title">Pre-Registered Arrivals</p>
            {/* Two numbers, because the board now holds two spans of time and a
                single figure could only ever have been one of them. */}
            <p className="revamp-greeting-sub">
              {counts.all} pre-registered visitor{counts.all === 1 ? '' : 's'} on record
              {' · '}
              {todays.length} expected today.
            </p>
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
              <span className={`text-xs font-bold tabular-nums ${active ? 'text-white/90' : chipBadgeCls(c.key)}`}>
                {counts[c.key]}
              </span>
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
              <PreRegisteredCard key={v.id} visit={v} index={i} pill={preRegisteredPill(v, now)} onCheckIn={setCheckingIn} />
            ))}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-10 text-center text-navy-400 text-sm">
                No pre-registered visitors match this filter.
              </div>
            )}
          </div>

          {/* The record is capped, and saying so is not optional: a truncated
              list presented as the whole one is the sort of thing a guard would
              later be asked to account for. */}
          {!loading && truncated && (
            <p className="mt-3 text-xs text-navy-400 dark:text-navy-500 text-center">
              Showing the most recent pre-registrations. Older records are in Reports.
            </p>
          )}

          <OverdueBanner count={overdue} />
        </div>

        {/* Right rail — Today at a Glance. It is fed today's rows, never the
            filtered board, so switching a chip cannot rewrite the day. */}
        <GlanceRail
          filtered={todays}
          morning={morning}
          afternoon={afternoon}
          vipCount={vipCount}
          pillFor={preRegisteredPill}
          clock={now}
        />
      </div>
    </div>
  );
}

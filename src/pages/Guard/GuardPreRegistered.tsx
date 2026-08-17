import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import {
  chipCounts,
  chipVisits,
  isPreRegisteredArrival,
  preRegisteredPill,
  type PreRegisteredChip,
} from '../../lib/preRegisteredBoard';
import { arrivalWindows } from '../../lib/preRegisteredBoard';
import PreRegisteredCard from './PreRegisteredCard';
import GlanceRail from './GlanceRail';
import OverdueBanner from './OverdueBanner';
import VisitorCheckInFlow from './VisitorCheckInFlow';
import SuccessToast from '../../components/SuccessToast';

// Pre-Registered Arrivals — reference screen 3.
//
// TODAY'S PRE-APPROVALS WHO HAVE NOT ARRIVED YET (client instruction,
// 2026-08-15). Both halves of that are load-bearing, and `isPreRegisteredArrival`
// in lib/preRegisteredBoard.ts is the one place they are decided:
//
//   * Today only. This board briefly held every pre-registration ever made,
//     which turned a list of people to expect at the gate into an archive.
//     Reports is the archive.
//   * Not yet checked in. Once a visitor walks through they stop being an
//     arrival and become a person on site — the Entry & Exit tab's subject,
//     which carries their entry time, their exit time and their pass. A visitor
//     on both boards is one visitor rendered twice, and the guard is left
//     deciding which screen is authoritative.
//
// There is therefore **no Arrived chip**: an arrived visitor is not on this
// board at all, so a chip for them could only ever read 0.
//
// The rest is the reference frame: filter chips with live counts, a
// visitor-or-host search box, the three-column card grid and the right-rail
// "Today at a Glance".

const CHIP_ORDER: { key: PreRegisteredChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'arriving', label: 'Arriving' },
  { key: 'missed', label: 'Missed' },
  { key: 'late', label: 'Late' },
];

export default function GuardPreRegistered(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clock, setClock] = useState(() => new Date());
  const [chip, setChip] = useState<PreRegisteredChip>('all');
  const [query, setQuery] = useState('');
  // The visitor currently being checked in. It is a mode of this page rather
  // than a separate route: the guard is standing in front of the person, and
  // this board is where they were just reading that person's name. The hook
  // subscribes to `visits`, so once the check-in writes, the visitor drops off
  // this board and appears on Entry & Exit — which is the whole point.
  const [checkingIn, setCheckingIn] = useState<ReportVisit | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const today = istDateKey(clock);
  const { visits, loading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Recomputed on the minute, not the second: every rule on this board turns on
  // whole minutes past a slot, so a per-second identity would re-slice the whole
  // list sixty times for nothing.
  const minuteKey = `${today}T${clock.getHours()}:${clock.getMinutes()}`;
  const now = useMemo(() => new Date(clock), [minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The board's population, decided once. Everything below slices this.
  const board = useMemo(
    () => visits
      .filter((v) => isPreRegisteredArrival(v, now))
      .sort((a, b) => (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at)),
    [visits, now],
  );

  // `/guard/preregistered?checkin=<visitId>` opens that visitor's check-in
  // flow directly. The dashboard's "Verify ID" used to land here; since
  // 2026-08-15 it opens the same flow IN PLACE on the dashboard (the ID scan
  // overlay starts immediately), and the Glance rail's schedule list — the
  // param's other producer — was removed the same day. Nothing in the app emits
  // it now, but it stays honoured: it is in guards' bookmarks and in every
  // `?checkin=` link the dashboard has already handed out, and landing on the
  // board with the flow open is still exactly what those links promised.
  useEffect(() => {
    const id = searchParams.get('checkin');
    if (!id || checkingIn) return;
    const found = board.find((v) => v.id === id);
    if (found) setCheckingIn(found);
  }, [searchParams, board, checkingIn]);

  // `?chip=late` preselects a filter — the Overdue banner uses it to narrow
  // this board in place rather than navigating somewhere the overdue visitors
  // are not. Read once, on mount, so it seeds the chip without fighting the
  // guard every time they click a different one.
  useEffect(() => {
    const c = searchParams.get('chip');
    if (c && CHIP_ORDER.some((x) => x.key === c)) setChip(c as PreRegisteredChip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeCheckIn = () => {
    setCheckingIn(null);
    // Drop the param, or coming back to the board would immediately reopen the
    // flow the guard just cancelled out of.
    if (searchParams.get('checkin')) setSearchParams({});
  };

  const counts = useMemo(() => chipCounts(board, now), [board, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (v: ReportVisit) =>
      !q ||
      (v.visitor?.full_name ?? '').toLowerCase().includes(q) ||
      (v.visitor?.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.host?.full_name ?? '').toLowerCase().includes(q) ||
      (v.department?.name ?? '').toLowerCase().includes(q);
    // Already sorted by slot, ascending — a list of people still to arrive is
    // read forwards, soonest first.
    return chipVisits(chip, board, now).filter(matchesQuery);
  }, [board, chip, query, now]);

  // How many are due in each block of the day, computed in IST — never
  // `new Date(...).getHours()`, which reads the BROWSER's zone. This is the one
  // place in the guard surface where the wrong timezone changes a NUMBER rather
  // than a rendered string, so it would be wrong with nothing on screen saying
  // so. Every booking lands in exactly one bucket (see `arrivalWindows`).
  const windows = useMemo(() => arrivalWindows(board), [board]);
  const overdue = counts.missed + counts.late;

  const chipBadgeCls = (k: PreRegisteredChip) =>
    k === 'arriving' ? 'text-brand-400'
      : k === 'missed' ? 'text-danger-400'
        : k === 'late' ? 'text-warning-400' : 'text-navy-700';

  if (checkingIn) {
    return (
      <div className="animate-fade-in pb-4">
        <VisitorCheckInFlow
          visit={checkingIn}
          onDone={(name) => {
            closeCheckIn();
            setToast(`"${name}" checked in.`);
            setTimeout(() => setToast(null), 4000);
          }}
          onCancel={closeCheckIn}
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
            <p className="revamp-greeting-sub">
              {counts.all} visitor{counts.all === 1 ? '' : 's'} still to arrive today.
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
            {/* No clock here. The topbar renders one, pinned to IST, a few
                pixels above this header — a second clock computed a different
                way (this one read the browser's zone) could disagree with it on
                the same screen. The Live pill stays: that says the page is
                subscribed, which the topbar cannot tell you. */}
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
                  : 'border-surface-200/60 dark:border-white/[0.08] bg-surface-100/60 dark:bg-white/[0.03] text-navy-800 hover:bg-brand-600/10'
              }`}>
              {c.label}
              <span className={`text-xs font-bold tabular-nums ${active ? 'text-white/90' : chipBadgeCls(c.key)}`}>
                {counts[c.key]}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visitor or host…"
            className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] bg-surface-100/60 dark:bg-white/[0.03] pl-9 pr-4 py-2 text-sm text-navy-950 placeholder:text-navy-600 w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
              <div className="col-span-full rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-10 text-center text-navy-700 text-sm">
                Nobody is still expected under this filter. Visitors who have already
                arrived are on the Entry &amp; Exit tab.
              </div>
            )}
          </div>

          <OverdueBanner count={overdue} />
        </div>

        {/* Right rail — Today at a Glance, fed the same board so the two panels
            can never describe different days. */}
        <GlanceRail windows={windows} />
      </div>
    </div>
  );
}

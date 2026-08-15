import React, { useEffect, useMemo, useState } from 'react';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { escalateWatchlistMatch } from '../../lib/notifyWatchlistEscalation';
import { istDateKey } from '../../lib/visitExpiry';
import { safeErrorMessage } from '../../lib/errors';
import WatchlistMatchCard, { type WatchlistMatch } from './WatchlistMatchCard';
import CctvFeedCard from './CctvFeedCard';

// Watchlist & Alerts — reference screen 4.
//
// Left: "Flagged Visitor Matches" — one card per visit whose visitor row is
// blacklisted, styled by severity (HIGH red / MEDIUM amber, derived from
// blacklist_reason), with photo, match reason, and the three action buttons
// (Dispatch Security / Notify Admin / Dismiss). A bottom strip tallies High /
// Medium / Low counts.
//
// Right: the "Live CCTV Feed" placeholder. No camera integration exists in
// this build, so the frame is a styled placeholder with the camera selector
// and Record Clip / Full Screen controls — functional chrome, no fabricated
// footage. Full Screen uses the real Fullscreen API on the card.
//
// Severity is derived, never stored: HIGH = reason mentions trespass/violent
// /banned/assault; MEDIUM = anything else on the list; LOW = reserved for a
// reason field that is currently empty.

export default function GuardWatchlist(): React.ReactElement {
  const [clock, setClock] = useState(() => new Date());
  const [camera, setCamera] = useState('CAM 02 - Main Lobby');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState('');
  const today = istDateKey(clock);
  const { visits, loading } = useTodayVisits(today);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Flagged matches = today's visits whose visitor is blacklisted, plus any
  // visit that was declined today with a blacklist reason on the visitor.
  const rows = useMemo<WatchlistMatch[]>(() => {
    const out: WatchlistMatch[] = [];
    for (const v of visits) {
      if (v.visitor?.is_blacklisted !== true) continue;
      const t = v.checked_in_at ?? v.created_at;
      if (out.some((r) => r.visitId === v.id)) continue;
      out.push({
        id: `flag-${v.id}`,
        visitId: v.id,
        name: v.visitor.full_name,
        reason: v.visitor.blacklist_reason ?? null,
        photo: v.photo_path ?? v.photo_data ?? null,
        time: new Date(t),
        dismissed: false,
      });
    }
    return out.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [visits]);

  const visible = rows.filter((r) => !dismissed.has(r.visitId));
  const counts = useMemo(() => {
    const c = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const r of visible) {
      const sev =
        r.reason && /trespass|violent|banned|assault|criminal|danger|threat/i.test(r.reason.toLowerCase())
          ? 'HIGH'
          : r.reason && r.reason.trim()
            ? 'MEDIUM'
            : 'LOW';
      c[sev] += 1;
    }
    return c;
  }, [visible]);

  const act = async (row: WatchlistMatch, action: 'dispatch' | 'notify' | 'dismiss') => {
    setError('');
    if (action === 'dismiss') {
      setDismissed((prev) => new Set(prev).add(row.visitId));
      setToast('Match dismissed on this screen.');
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // Escalation is a message to a person, so it goes to the notifications
    // table the bell already reads (migration 079). It used to overwrite
    // `visits.remarks` — the HOD's approval note that Reports prints — with a
    // magic suffix string. See lib/notifyWatchlistEscalation.ts.
    const res = await escalateWatchlistMatch({
      visitId: row.visitId,
      visitorName: row.name,
      reason: row.reason,
      action,
    });
    if (!res.ok) { setError(res.message); return; }
    // Say what actually happened. "Security team dispatched" claimed an event
    // this system cannot cause; what it can do is put the alert in front of the
    // people who can.
    setToast(
      action === 'dispatch'
        ? `Dispatch requested — ${res.recipients} admin${res.recipients === 1 ? '' : 's'} alerted.`
        : `Flagged for review — ${res.recipients} admin${res.recipients === 1 ? '' : 's'} alerted.`,
    );
    setTimeout(() => setToast(null), 4000);
  };

  const requestFullscreen = async (card: HTMLElement | null) => {
    if (!card) return;
    try {
      await card.requestFullscreen();
    } catch (err) {
      setError(safeErrorMessage(err, 'Full screen is not available in this browser.'));
    }
  };

  const severityNumCls = (s: 'HIGH' | 'MEDIUM' | 'LOW') =>
    s === 'HIGH' ? 'text-danger-400' : s === 'MEDIUM' ? 'text-warning-400' : 'text-success-500';

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <header className="revamp-greeting">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="revamp-greeting-eyebrow">Watchlist</p>
            <p className="revamp-greeting-title">Watchlist &amp; Alerts</p>
            <p className="revamp-greeting-sub">Flagged visitors spotted at the gate today.</p>
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

      {toast && (
        <p className="rounded-xl border border-brand-500/40 bg-[rgb(23_37_84)] px-4 py-3 text-sm text-brand-200">{toast}</p>
      )}
      {error && (
        <p className="rounded-xl border border-danger-500/40 bg-[rgb(50_20_24)] px-4 py-3 text-sm text-danger-300">{error}</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        {/* Flagged Visitor Matches */}
        <div className="xl:col-span-3 rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-h2 text-navy-950 dark:text-white flex items-center gap-2.5">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Flagged Visitor Matches
            </h2>
            <button className="text-navy-400 hover:text-navy-200 transition-colors" aria-label="Alerts settings">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>
          </div>

          {loading && <p className="py-10 text-center text-sm text-navy-400">Loading flagged matches…</p>}

          {!loading && visible.length === 0 && (
            <div className="py-10 text-center">
              <span className="mx-auto w-14 h-14 rounded-full border border-success-500/40 flex items-center justify-center mb-3 text-success-500">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <p className="text-sm text-navy-400">No flagged visitor matches right now.</p>
            </div>
          )}

          <div className="space-y-4">{visible.map((row, i) => (
            <WatchlistMatchCard key={row.id} row={row} index={i} onAct={act} />
          ))}</div>

          {/* Severity counts */}
          <div className="mt-5 pt-4 border-t border-surface-200/60 dark:border-white/[0.07] flex flex-wrap gap-3">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
              <span
                key={s}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  s === 'HIGH'
                    ? 'border-danger-500/30 bg-danger-600/10'
                    : s === 'MEDIUM'
                      ? 'border-warning-400/30 bg-warning-500/10'
                      : 'border-success-500/30 bg-success-600/10'
                }`}>
                <svg className={`w-4 h-4 ${severityNumCls(s)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={severityNumCls(s)}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                <span className={`font-display text-kpi tabular-nums ${severityNumCls(s)}`}>{counts[s]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Live CCTV Feed (placeholder frame) */}
        <CctvFeedCard
          camera={camera}
          onChangeCamera={setCamera}
          onRequestFullscreen={requestFullscreen}
          onUnavailable={(m) => setToast(m)}
        />
      </div>
    </div>
  );
}

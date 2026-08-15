import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGateActivity } from '../../lib/useGateActivity';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import { safeErrorMessage } from '../../lib/errors';
import QRCode from 'qrcode';
import { buildQrPayload } from '../../lib/qrToken';
import SuccessToast from '../../components/SuccessToast';
import { notifyHostOnCheckIn } from '../../lib/notifyHostCheckIn';
import CheckInFrame from './CheckInFrame';
import LiveQueueTable from './LiveQueueTable';
import CardReturnConfirm from './CardReturnConfirm';
import { logVisitExit } from '../../lib/checkOutFlow';

// Entry & Exit — the guard's second tab (/guard/inside-now).
//
// Named "Live Queue" until 2026-08-14, then "Inside Now" until 2026-08-15. It
// lists everyone who has been through the gate: those still inside, and those
// who have checked out since the IST day began. Neither older name survived the
// widening — "Live Queue" described the dashboard's Live Arrival Queue (people
// still waiting, who are not on this page at all), and "Inside Now" was a claim
// the list stopped making the moment it carried departures. "Entry & Exit" is
// the two events the tab actually records and nothing more.
//
// The FILE keeps its old name, as it did through the last rename: renaming a
// component half the guard surface imports buys nothing the route and the label
// do not already say. Both /guard/inside-now and /guard/live-queue stay
// routable — they are in guards' bookmarks and in every ?verify= link the
// dashboard has emitted.
//
// SPLIT VIEW, exactly as the approved frame: the queue stays visible on the
// LEFT while the SELECTED visitor's check-in frame renders on the RIGHT —
// Check-In Details, the green-ringed photo + step timeline, and the white
// visitor pass + Print Badge. The guard flips between visitors by clicking
// rows; the right panel updates live for each of them.
//
// Per the guard's instruction this tab shows ONLY visitors who have already
// checked in — un-checked-in arrivals stay on the dashboard's Live Arrival
// Queue, where the guard starts the check-in work from. This page therefore
// STARTS no check-in: the "N arrivals still at the gate" banner and the
// photo + OCR overlay it opened were removed 2026-08-14 (client instruction),
// leaving one route into a check-in rather than two that could disagree.
//
// It does END one. /visitors/inside was the only place a visitor could be
// checked out, so retiring that surface would have meant nobody could ever
// leave. The exit lands here because this is the list of people who are
// actually inside — and it goes through the same CardReturnConfirm dialog and
// the same lib/checkOutFlow write the old surface used, so "did a human
// witness this exit" and "did the card come back" keep one answer each.

// The two times the tab is named for. A row always has an entry time (the
// query requires `checked_in_at`); the exit is an em dash until it happens,
// never a blank — blank reads as "not recorded", and on this list it means
// "still here", which is the difference the guard is looking for.
function timeOf(v: ReportVisit): string {
  if (v.checked_in_at) return new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (v.scheduled_for) return new Date(v.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function exitTimeOf(v: ReportVisit): string {
  if (!v.checked_out_at) return '—';
  return new Date(v.checked_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusPill(v: ReportVisit) {
  if (v.status === 'checked_out') return { label: 'CHECKED OUT', cls: 'bg-navy-500/15 text-navy-400 border-navy-400/30' };
  if (v.checked_in_at) return { label: 'CHECKED IN', cls: 'bg-success-600/15 text-success-500 border-success-500/30' };
  if (v.status === 'approved') return { label: 'PRE-REGISTERED', cls: 'bg-brand-600/15 text-brand-400 border-brand-500/30' };
  return { label: 'WAITING', cls: 'bg-warning-500/15 text-warning-400 border-warning-400/30' };
}

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

export default function GuardLiveQueue(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clock, setClock] = useState(() => new Date());
  const today = istDateKey(clock);
  const { visits, loading: visitsLoading } = useGateActivity(today);

  // The visitor whose details render in the right-hand frame. Selecting a
  // queue row updates it live; arriving at /guard/inside-now?verify=<id>
  // (from the dashboard's ID Verification card) preselects that visitor.
  const [activeVisit, setActiveVisit] = useState<ReportVisit | null>(null);

  // The visitor the guard has asked to check out. Holding the visit here (not
  // a boolean) means the confirm dialog always names the row that was clicked,
  // even if the live subscription reorders the table underneath it.
  const [exitTarget, setExitTarget] = useState<ReportVisit | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = searchParams.get('verify');
    if (id && !activeVisit) {
      const found = visits.find((v) => v.id === id) ?? null;
      if (found) setActiveVisit(found);
    }
  }, [searchParams, visits, activeVisit]);

  // Refresh the selected row against the freshest subscription data so the
  // right panel can never show a stale status (e.g. right after check-in).
  const liveActive = activeVisit ? (visits.find((v) => v.id === activeVisit.id) ?? activeVisit) : null;
  useEffect(() => {
    if (!liveActive) return;
    const payload = liveActive.qr_token
      ? buildQrPayload(liveActive.qr_token)
      : `vms://visit/${liveActive.ref_number}`;
    QRCode.toDataURL(payload, { width: 128, color: { dark: '#111827', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [liveActive]);

  // Entry & Exit = everyone through the gate: still inside, plus today's
  // departures. Un-checked-in arrivals are not here at all — they live on the
  // dashboard's Live Arrival Queue, which is where a check-in starts.
  //
  // STILL INSIDE FIRST, each group by its own clock: the people on site are the
  // ones a guard can still act on, and putting a departure above them would
  // bury the only actionable rows on the page. Inside sorts by arrival (oldest
  // first — longest on site, closest to an overstay); departures sort by exit,
  // most recent first, because "who just left?" is the question asked of them.
  const inside = visits
    .filter((v) => v.status === 'checked_in')
    .sort((a, b) => (a.checked_in_at ?? a.created_at).localeCompare(b.checked_in_at ?? b.created_at));
  const departed = visits
    .filter((v) => v.status === 'checked_out')
    .sort((a, b) => (b.checked_out_at ?? b.created_at).localeCompare(a.checked_out_at ?? a.created_at));
  const queue = [...inside, ...departed];

  const selectVisit = (v: ReportVisit) => {
    setActiveVisit(v);
  };

  const notifyHost = async (v: ReportVisit) => {
    // Notify = send the host a real notification, through the `notifications`
    // table the bell icon already reads.
    //
    // This used to APPEND ' - host notified on arrival' to `visits.remarks` and
    // call that the signal. `remarks` is the walk-in note an HOD reads when
    // deciding whether to approve someone — free prose, written by a guard, and
    // surfaced to another role — so guard bookkeeping stuffed into it showed up
    // inside a colleague's approval card, and Reports printed it. A magic
    // substring in a prose column is also not a flag: nothing stops a visitor's
    // genuine note from containing it.
    //
    // The toast wording changed with it, and deliberately. "acknowledged
    // arrival" claimed the HOST had done something; nothing here can know that.
    // We know only that the notice was delivered.
    setError('');
    const res = await notifyHostOnCheckIn({
      id: v.id,
      host_id: v.host_id ?? null,
      visitor_name: v.visitor?.full_name ?? null,
    });
    if (res.notified) {
      setToast(`Host notified: ${v.host?.full_name ?? 'the host'} has been sent the arrival notice`);
      setTimeout(() => setToast(null), 5000);
      return;
    }
    setError(
      res.error
        ? safeErrorMessage(res.error, 'Could not notify the host.')
        : 'No host is recorded on this visit, so there is nobody to notify.',
    );
  };

  const printBadge = () => {
    // The printed pass is the existing Badge component in a print-only media
    // query — the reference's white card is the same asset the kiosk prints,
    // so guards and kiosk can never disagree about what a pass looks like.
    if (!liveActive) return;
    const el = document.getElementById('vms-print-badge');
    if (el) {
      const w = window.open('', '_blank', 'width=480,height=720');
      if (w) {
        w.document.write(`<html><head><title>Visitor Pass</title><style>body{margin:0}img{max-width:100%}</style></head><body>${el.outerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
      }
    }
  };

  // The exit WRITE, reached only through CardReturnConfirm — the dialog names
  // the card the guard has to collect and stays disabled until it is ticked
  // back, so a completed check-out is the record of a witnessed handover.
  const confirmExit = async (visit: ReportVisit) => {
    setError('');
    const res = await logVisitExit(visit);
    if (!res.ok) { setError(res.message); return; }
    setExitTarget(null);
    // The right-hand frame described someone who is no longer inside; the
    // realtime subscription is about to drop them from the table too.
    setActiveVisit(null);
    setSearchParams({});
    setToast(`"${visit.visitor?.full_name ?? 'Visitor'}" checked out.`);
    setTimeout(() => setToast(null), 5000);
  };

  const closeSplitSelection = () => {
    setActiveVisit(null);
    setSearchParams({});
    setError('');
    setQrDataUrl(null);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <SuccessToast message={toast} onDismiss={() => setToast(null)} />

      {error && (
        <p className="rounded-xl border border-danger-500/30 bg-danger-600/10 px-4 py-3 text-sm text-danger-400">{error}</p>
      )}

      {/* Left column — arrival queue (always visible) */}
      <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-success-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Entry &amp; Exit</h2>
          </div>
          {/* Two numbers, not one total. "12 visitors" on a list holding both
              groups answers neither of the questions this tab is opened with —
              how many are on site, and how many have gone. */}
          <span className="text-sm text-navy-500 dark:text-navy-400 tabular-nums">
            {visitsLoading ? '…' : `${inside.length} inside · ${departed.length} left today`}
          </span>
        </div>

        <LiveQueueTable
          queue={queue}
          loading={visitsLoading}
          initialsOf={initialsOf}
          statusPill={statusPill}
          timeOf={timeOf}
          exitTimeOf={exitTimeOf}
          onSelect={selectVisit}
          selectedId={liveActive?.id ?? null}
          onCheckOut={setExitTarget}
        />
      </div>

      {/* Right column — check-in frame of the selected visitor. Rendered for
          every visitor, awaiting or already checked in, so the guard sees
          details · photo + timeline · pass for anyone in the queue. */}
      {liveActive && (
        <CheckInFrame
          activeVisit={liveActive}
          qrDataUrl={qrDataUrl}
          onNotifyHost={notifyHost}
          onPrintBadge={printBadge}
          onClose={closeSplitSelection}
          // Only somebody actually inside can leave. Every row in this table is
          // checked_in, but the frame is reused elsewhere, so the guard is
          // explicit rather than assumed.
          onCheckOut={liveActive.status === 'checked_in' ? () => setExitTarget(liveActive) : undefined}
        />
      )}

      {exitTarget && (
        <CardReturnConfirm
          visit={exitTarget}
          onConfirm={() => { void confirmExit(exitTarget); }}
          onClose={() => setExitTarget(null)}
        />
      )}
    </div>
  );
}

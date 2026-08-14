import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTodayVisits } from '../../lib/useTodayVisits';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import VisitorCheckInFlow from './VisitorCheckInFlow';
import { supabase } from '../../supabaseClient';
import { safeErrorMessage } from '../../lib/errors';
import type { Visit } from '../../types/index';
import QRCode from 'qrcode';
import { buildQrPayload } from '../../lib/qrToken';
import SuccessToast from '../../components/SuccessToast';
import CheckInFrame from './CheckInFrame';
import LiveQueueTable from './LiveQueueTable';

// Live Queue — reference screen 2 (vms.company.com/guard/queue/check-in).
//
// SPLIT VIEW, exactly as the approved frame: the arrival queue stays visible
// on the LEFT while the SELECTED visitor's check-in frame renders on the
// RIGHT — Check-In Details, the green-ringed photo + 4-step timeline, and the
// Steps rail with the visitor pass + Print Badge. The guard flips between
// visitors by clicking rows; the right panel updates live for each of them,
// including visitors who have already checked in (their timeline shows all
// steps done, and Host Notified / Print Badge are the optional finishing
// actions).
//
// Only when the guard hits "Check In" / "Verify" for an un-checked-in visitor
// does the full-screen photo+OCR flow open — that overlay is the existing
// VisitorCheckInFlow, which remains sacred.

function timeOf(v: ReportVisit): string {
  if (v.checked_in_at) return new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (v.scheduled_for) return new Date(v.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusPill(v: ReportVisit) {
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
  const { visits, loading: visitsLoading } = useTodayVisits(today);

  // The visitor whose details render in the right-hand frame. Selecting a
  // queue row updates it live; arriving at /guard/live-queue?verify=<id>
  // (from the dashboard's ID Verification card) preselects that visitor.
  const [activeVisit, setActiveVisit] = useState<ReportVisit | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [flowVisit, setFlowVisit] = useState<ReportVisit | null>(null);

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

  const queue = visits
    .filter((v) => v.status === 'approved' || v.status === 'walkin_approved' || v.status === 'checked_in')
    .sort((a, b) => (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at));

  const selectVisit = (v: ReportVisit) => {
    setError('');
    if (v.status !== 'checked_in' && !v.status.match(/checked_out/)) {
      // Un-checked-in row → full-screen photo + OCR flow.
      setFlowVisit(v);
      setActiveVisit(v);
    } else {
      setActiveVisit(v);
    }
  };

  const notifyHost = async (v: ReportVisit) => {
    // Notify = mark the host as pinged for this check-in. Host contact is not
    // modelled on the visit row, so the "host notified" signal is carried by
    // the remarks-style `remarks` field the guard lanes already use for
    // context. It is informational only.
    setError('');
    try {
      const suffix = ' - host notified on arrival';
      const remarks = (v.remarks ?? '').replace(/ - host notified on arrival$/, '');
      const { error: err } = await supabase
        .from('visits')
        .update({ remarks: (remarks + suffix).slice(0, 1000) })
        .eq('id', v.id);
      if (err) throw err;
      setToast(`Host notified: ${v.host?.full_name ?? 'your host'} acknowledged arrival`);
      setTimeout(() => setToast(null), 5000);
      setActiveVisit({ ...v, remarks: (remarks + suffix).slice(0, 1000) } as ReportVisit);
    } catch (err) {
      setError(safeErrorMessage(err, 'Could not notify the host.'));
    }
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

  const closeSplitSelection = () => {
    setActiveVisit(null);
    setSearchParams({});
    setError('');
    setQrDataUrl(null);
  };

  // ── Photo + OCR check-in overlay (sacred flow, untouched visually) ────────
  if (flowVisit && flowVisit.status !== 'checked_in' && !flowVisit.status.match(/checked_out/)) {
    return (
      <VisitorCheckInFlow
        visit={flowVisit as Visit}
        onDone={(name) => {
          setToast(`Checked in: ${name}`);
          setTimeout(() => setToast(null), 5000);
          setFlowVisit(null);
          // Keep the just-checked-in visitor selected so the right panel now
          // shows their completed timeline and pass — same page, no reload.
        }}
        onCancel={() => setFlowVisit(null)}
      />
    );
  }

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
            <span className="text-brand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 0 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 0 015.25 0z" />
              </svg>
            </span>
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Arrival Queue</h2>
          </div>
          <span className="text-sm text-navy-500 dark:text-navy-400 tabular-nums">
            {visitsLoading ? '…' : queue.length} visitor{queue.length === 1 ? '' : 's'}
          </span>
        </div>

        <LiveQueueTable
          queue={queue}
          loading={visitsLoading}
          initialsOf={initialsOf}
          statusPill={statusPill}
          timeOf={timeOf}
          onSelect={selectVisit}
          selectedId={liveActive?.id ?? null}
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
        />
      )}
    </div>
  );
}

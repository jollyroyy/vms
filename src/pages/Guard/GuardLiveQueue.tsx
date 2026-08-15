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
import { notifyHostOnCheckIn } from '../../lib/notifyHostCheckIn';
import CheckInFrame from './CheckInFrame';
import LiveQueueTable from './LiveQueueTable';

// Live Queue — reference screen 2 (vms.company.com/guard/queue/check-in).
//
// SPLIT VIEW, exactly as the approved frame: the queue stays visible on the
// LEFT while the SELECTED visitor's check-in frame renders on the RIGHT —
// Check-In Details, the green-ringed photo + step timeline, and the Steps
// rail with the white visitor pass + Print Badge. The guard flips between
// visitors by clicking rows; the right panel updates live for each of them.
//
// Per the guard's instruction this tab shows ONLY visitors who have already
// checked in — un-checked-in arrivals stay on the dashboard's Live Arrival
// Queue, where the guard starts the check-in work from.

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
  // Visits the guard can still check in right from this tab (kept as a
  // shortcut, not part of the queue itself).
  const awaiting = visits.filter((v) => v.status === 'approved' || v.status === 'walkin_approved');
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

  // Live Queue = checked-in visitors only (un-checked-in arrivals live on the
  // dashboard's Live Arrival Queue).
  const queue = visits
    .filter((v) => v.status === 'checked_in')
    .sort((a, b) => (a.checked_in_at ?? a.created_at).localeCompare(b.checked_in_at ?? b.created_at));

  const selectVisit = (v: ReportVisit) => {
    // Every row in this queue is checked in — show their completed frame.
    setActiveVisit(v);
  };

  const startCheckIn = (v: ReportVisit) => {
    // Shortcut from the awaiting list: open the sacred photo + OCR flow.
    setError('');
    setFlowVisit(v);
    setActiveVisit(v);
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
    // The print window has no Tailwind, so anything sized only with utility
    // classes (photo ring, QR) renders at its natural — potentially huge —
    // size. A small self-contained stylesheet fixes the sizes: the photo
    // stays a circle with object-fit: cover, so its aspect ratio never
    // distorts.
    if (!liveActive) return;
    const el = document.getElementById('vms-print-badge');
    if (el) {
      const w = window.open('', '_blank', 'width=480,height=720');
      if (w) {
        const html = el.outerHTML
          .replace('class="rounded-2xl bg-white p-5 shadow-lg border border-surface-200 dark:border-white/20 flex flex-col items-center"', 'class="bp-pass"')
          .replace('class="w-16 h-3.5 rounded-full bg-[#111827] mb-3"', 'class="bp-notch"')
          .replace('class="w-8 h-8"', 'class="bp-logo"')
          .replace('class="w-20 h-20 rounded-full overflow-hidden border-[3px] border-brand-500 p-0.5 bg-white"', 'class="bp-photo"')
          .replace('class="font-display font-bold text-[#111827] text-lg leading-tight text-center"', 'class="bp-name"')
          .replace('class="text-[13px] font-bold text-brand-600"', 'class="bp-passnum"')
          .replace('class="text-[11px] font-medium text-[#5a6070]"', 'class="bp-valid"')
          .replace('class="mt-1 w-24 h-24"', 'class="bp-qr"')
          .replace('class="mt-1 w-24 h-24 border-2 border-[#d9dde5] rounded-lg flex items-center justify-center text-xs font-bold text-[#8b93a5]"', 'class="bp-qrfallback"')
          .replace('class="w-full h-full rounded-full overflow-hidden"', 'class="bp-photo-inner"')
          .replace('class="w-full h-full object-cover"', 'class="bp-photo-img"')
          .replace('class="w-full h-full flex items-center justify-center text-sm font-bold text-[#8b93a5]"', 'class="bp-photo-initials"');
        w.document.write(`<html><head><title>Visitor Pass</title><style>
body{margin:0;background:#fff;display:flex;justify-content:center;padding:16px}
*{box-sizing:border-box}
.bp-pass{width:280px;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 4px 24px -4px rgba(0,0,0,0.12);display:flex;flex-direction:column;align-items:center;padding:20px}
.bp-notch{width:64px;height:14px;border-radius:9999px;background:#111827;margin:0 0 12px}
.bp-logo{width:32px;height:32px;fill:#2563eb}
.bp-brand{color:#111827;font-family:Poppins,ui-sans-serif,sans-serif;font-weight:800;font-size:18px;letter-spacing:0.04em}
.bp-park{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:#5a6070}
.bp-band{margin-top:12px;width:100%;border-radius:8px;background:#1d4ed8;padding:10px 16px;text-align:center}
.bp-band p{color:#fff;font-family:Poppins,ui-sans-serif,sans-serif;font-weight:700;letter-spacing:0.14em;font-size:16px;text-transform:uppercase}
.bp-body{display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:16px;width:100%}
.bp-photo{width:80px;height:80px;border-radius:9999px;border:3px solid #3b82f6;padding:2px;background:#fff;overflow:hidden}
.bp-photo-inner{width:100%;height:100%;border-radius:9999px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.bp-photo-img{width:100%;height:100%;object-fit:cover;display:block}
.bp-photo-initials{font-size:14px;font-weight:700;color:#8b93a5}
.bp-name{color:#111827;font-family:Poppins,ui-sans-serif,sans-serif;font-weight:700;font-size:18px;text-align:center}
.bp-passnum{font-size:13px;font-weight:700;color:#2563eb}
.bp-valid{font-size:11px;font-weight:500;color:#5a6070}
.bp-qr{width:96px;height:96px}
.bp-qrfallback{width:96px;height:96px;border:2px solid #d9dde5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#8b93a5}
@media print{body{padding:0}}
</style></head><body>${html}</body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
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

          // Automatic reminder to the host who made the pre-approval: a red
          // bell entry appears in the host's own VMS session, and the guard
          // sees the green tick once the notification lands.
          void notifyHostOnCheckIn({
            id: flowVisit.id,
            host_id: (flowVisit as ReportVisit).host_id ?? null,
            visitor_name: (flowVisit as ReportVisit).visitor?.full_name ?? name,
          }).then((res) => {
            if (res.notified) {
              setToast(`Host reminded: ${(flowVisit as ReportVisit).host?.full_name ?? 'the host'} was notified of the check-in`);
              setTimeout(() => setToast(null), 5000);
            }
          });
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
            <span className="text-success-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="font-display text-h2 text-navy-950 dark:text-white">Checked-In Visitors</h2>
          </div>
          <span className="text-sm text-navy-500 dark:text-navy-400 tabular-nums">
            {visitsLoading ? '…' : queue.length} visitor{queue.length === 1 ? '' : 's'}
          </span>
        </div>

        {awaiting.length > 0 && !visitsLoading && (
          <p className="mb-3 text-xs text-navy-500 dark:text-navy-400">
            {awaiting.length} arrival{awaiting.length === 1 ? '' : 's'} still at the gate — check them in from the dashboard's Live Arrival Queue, or{' '}
            <button
              type="button"
              onClick={() => { const first = awaiting[0]; if (first) startCheckIn(first); }}
              className="font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-2">
              start with {awaiting[0]?.visitor?.full_name ?? 'the next visitor'}
            </button>
          </p>
        )}

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

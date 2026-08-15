// The other half of the walk-in lane: requests the host has now said yes to.
//
// Without this tab an approved walk-in had nowhere to go. CheckInPanel — the
// only other way into `checked_in` from the guard surface — moved to
// /guard/pre-approvals, and it searches pre-approvals, so a visitor who was
// never booked could be approved and then never checked in. This is their gate.
//
// A photo is taken here rather than at registration because at registration
// nobody knows yet whether the visitor is coming in: WalkInRequest deliberately
// inserts photo_path/photo_data as null. Capturing it at the moment of entry is
// also what the pre-approved lane does, so every checked-in visit carries a
// photo taken at the gate, however the visitor got approved.
//
// The ID scan and the visitor card number are UNCONDITIONAL here, exactly as on
// the pre-approved photo step (CheckInPhotoStep): a walk-in is the one arrival
// the guard has never seen a pass for, so reading the document at the gate is
// not optional polish, it is the identity check.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import PhotoCapture from '../../components/PhotoCapture';
import { formatDateTime } from '../../lib/formatDate';
import { namesMatch } from '../../lib/ai/nameMatch';
import { isValidCardNumber } from '../../lib/cardNumber';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';

// The shape moved to lib/checkInWalkInApproved.ts with the write it describes,
// so the form and the mutation cannot drift apart.
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';

type Props = {
  loading: boolean;
  /** Walk-ins the host approved, not yet at the gate. */
  approved: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
};

export default function GuardWalkInApproved({ loading, approved, busyId, onCheckIn }: Props): React.ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<IdScanResult | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');

  const reset = () => {
    setOpenId(null); setPhotoBlob(null); setScanResult(null); setCardNumber(''); setCarrying(false); setRemarks('');
  };

  const cardBad = !isValidCardNumber(cardNumber);
  const canConfirm = (v: Visit): boolean => {
    if (!photoBlob || cardBad || busyId === v.id) return false;
    if (!scanResult?.name) return true;
    return namesMatch(scanResult.name, v.visitor?.full_name ?? '');
  };

  const scanSection = (v: Visit) => {
    const status = scanResult
      ? scanResult.name
        ? namesMatch(scanResult.name, v.visitor?.full_name ?? '') ? 'match' : 'mismatch'
        : 'no-name'
      : null;
    if (!scanResult) {
      return (
        <button type="button" onClick={() => setScanOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
          Scan ID card
        </button>
      );
    }
    if (status === 'match') {
      return (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-4 py-2.5 text-sm flex items-center justify-between gap-2">
          <span className="font-bold text-success-700">Identity verified</span>
          <span className="text-xs text-success-700/80">{scanResult.idType} •••• {scanResult.idLast4}</span>
        </div>
      );
    }
    if (status === 'mismatch') {
      return (
        <div className="rounded-xl bg-danger-50 border border-danger-200 dark:border-danger-500/25 px-4 py-2.5 text-sm space-y-1.5">
          <p className="font-bold text-danger-700">Name doesn't match the approved visitor</p>
          <p className="text-xs text-danger-700/80">Card shows {scanResult.name} — approved as {v.visitor?.full_name}</p>
          <button type="button" onClick={() => setScanResult(null)}
            className="text-xs font-bold text-danger-700 underline underline-offset-2">Discard scan</button>
        </div>
      );
    }
    return (
      <div className="rounded-xl bg-accent-50 border border-accent-200 dark:bg-accent-500/10 dark:border-accent-500/25 px-4 py-2.5 text-sm flex items-center justify-between gap-2">
        <span className="font-bold text-accent-700 dark:text-accent-300">ID recorded — no name could be read</span>
        <span className="text-xs text-accent-700/80">{scanResult.idType} •••• {scanResult.idLast4}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="gate-section-title">Approved, waiting to enter</h2>
        <span className="glass-chip !py-1 tabular-nums">{approved.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : approved.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">No approved walk-ins waiting.</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            Once a person to meet approves a walk-in, they appear here ready to check in.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approved.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <VisitorCard
                visit={v}
                timeLabel={formatDateTime(v.created_at)}
                action={openId === v.id ? undefined : { label: 'Check In', onClick: () => { reset(); setOpenId(v.id); } }}
              />

              {openId === v.id && (
                <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-5 mt-2 shadow-sm border border-surface-100 dark:border-white/[0.07] space-y-4">
                  {scanOpen && (
                    <IdScanOverlay
                      onScanned={(r) => { setScanResult(r); setScanOpen(false); }}
                      onClose={() => setScanOpen(false)}
                    />
                  )}
                  {/* Same rule as CheckInPhotoStep: ONE camera at a time. This
                      lane still mounted PhotoCapture underneath the open scan
                      overlay, so the scan's rear camera and the photo's front
                      camera were both live at once — the scan fails to start on
                      phones, and the second feed shows through the translucent
                      backdrop as what looks like a second scan page. */}
                  <div>
                    <p className="text-sm font-bold text-navy-950">Photo of the visitor</p>
                    <p className="text-[11px] text-navy-700 mt-0.5">
                      Point the camera at the visitor, not at the ID card.
                    </p>
                  </div>
                  {!scanOpen && <PhotoCapture onCapture={setPhotoBlob} />}
                  {scanSection(v)}

                  <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] p-3.5 space-y-2">
                    <label htmlFor="walkin-card" className="block">
                      <span className="block text-sm font-bold text-navy-800 dark:text-white">Visitor card number *</span>
                      <span className="block text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">
                        The number printed on the physical card handed to the visitor. It must be returned at check-out.
                      </span>
                    </label>
                    <input
                      id="walkin-card"
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="e.g. C-104"
                      maxLength={20}
                      aria-invalid={cardBad}
                      aria-describedby="walkin-card-hint"
                      className="input w-full"
                    />
                    {cardBad && (
                      <p id="walkin-card-hint" className="text-[11px] text-danger-600 font-semibold">
                        {cardNumber.trim() === ''
                          ? 'Enter the card number before checking in.'
                          : 'Letters, digits and hyphens only — e.g. C-104.'}
                      </p>
                    )}
                  </div>

                  {/* A tick box, never inferred from whether remarks were typed —
                      an empty box must mean "carrying nothing", not "the guard
                      was interrupted". Unticking discards the text so no orphaned
                      description survives on a visit flagged as carrying nothing. */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carrying}
                      onChange={(e) => { setCarrying(e.target.checked); if (!e.target.checked) setRemarks(''); }}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                    <span className="text-sm font-semibold text-navy-700">Carrying material</span>
                  </label>
                  {carrying && (
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="What are they carrying?"
                      className="input"
                    />
                  )}

                  <div className="flex gap-2.5">
                    <button type="button" onClick={reset}
                      className="flex-1 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 py-2.5 text-sm font-semibold transition-all">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canConfirm(v)}
                      onClick={() => { if (photoBlob) { onCheckIn(v, { photoBlob, carrying, remarks, idScan: scanResult, cardNumber }); reset(); } }}
                      className="btn-accent flex-1 !py-2.5 disabled:opacity-50"
                    >
                      {busyId === v.id ? 'Checking in…' : 'Confirm Check In'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
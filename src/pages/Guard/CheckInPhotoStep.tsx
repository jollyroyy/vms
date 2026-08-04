import React, { useState } from 'react';
import PhotoCapture from '../../components/PhotoCapture';
import { isFeatureEnabled } from '../../lib/featureFlags';
import { namesMatch } from '../../lib/ai/nameMatch';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';
import CheckInVisitorSummary from './CheckInVisitorSummary';
import type { MatchItem } from './CheckInPanel';

type Props = {
  selectedMatch: MatchItem;
  photoBlob: Blob | null;
  error: string;
  checkingIn: boolean;
  carrying: boolean;
  onCarryingChange: (value: boolean) => void;
  remarks: string;
  onRemarksChange: (value: string) => void;
  onBack: () => void;
  onCapture: (blob: Blob) => void;
  onRetake: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onScanResult: (result: IdScanResult | null) => void;
};

export default function CheckInPhotoStep({
  selectedMatch, photoBlob, error, checkingIn, carrying, onCarryingChange,
  remarks, onRemarksChange, onBack, onCapture, onRetake, onCancel, onConfirm, onScanResult,
}: Props): React.ReactElement {
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<IdScanResult | null>(null);

  const matchStatus = scanResult
    ? scanResult.name
      ? namesMatch(scanResult.name, selectedMatch.visitorName)
        ? 'match'
        : 'mismatch'
      : 'no-name'
    : null;

  const scanSection = isFeatureEnabled('ocr') && (
    <div className="space-y-2">
      {!scanResult ? (
        <button type="button" onClick={() => setScanOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01M10 12a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z" /></svg>
          Scan ID card
        </button>
      ) : matchStatus === 'match' ? (
        <div className="rounded-xl bg-success-50 border border-success-200 dark:border-success-500/25 px-4 py-2.5 text-sm flex items-center justify-between gap-2">
          <span className="font-bold text-success-700">Identity verified</span>
          <span className="text-xs text-success-700/80">{scanResult.idType} •••• {scanResult.idLast4}</span>
        </div>
      ) : matchStatus === 'mismatch' ? (
        <div className="rounded-xl bg-danger-50 border border-danger-200 dark:border-danger-500/25 px-4 py-2.5 text-sm space-y-1.5">
          <p className="font-bold text-danger-700">Name doesn't match the approved visitor</p>
          <p className="text-xs text-danger-700/80">Card shows {scanResult.name} — approved as {selectedMatch.visitorName}</p>
          <button type="button" onClick={() => { setScanResult(null); onScanResult(null); }}
            className="text-xs font-bold text-danger-700 underline underline-offset-2">Discard scan</button>
        </div>
      ) : (
        <div className="rounded-xl bg-accent-50 border border-accent-200 dark:bg-accent-500/10 dark:border-accent-500/25 px-4 py-2.5 text-sm flex items-center justify-between gap-2">
          <span className="font-bold text-accent-700 dark:text-accent-300">ID recorded — no name could be read</span>
          <span className="text-xs text-accent-700/80">{scanResult.idType} •••• {scanResult.idLast4}</span>
        </div>
      )}
    </div>
  );

  if (photoBlob === null) {
    return (
      <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
        {scanOpen && (
          <IdScanOverlay
            onScanned={(r) => { setScanResult(r); onScanResult(r); setScanOpen(false); }}
            onClose={() => setScanOpen(false)}
          />
        )}
        <button onClick={onBack} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to search
        </button>
        <div className="bg-white dark:bg-white/[0.06] dark:border-white/[0.07] rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
          <CheckInVisitorSummary match={selectedMatch} />
          {scanSection}
          <p className="text-sm font-semibold text-navy-700">Take a photo to check in</p>
          <PhotoCapture onCapture={onCapture} />
        </div>
        {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
      {scanOpen && (
        <IdScanOverlay
          onScanned={(r) => { setScanResult(r); onScanResult(r); setScanOpen(false); }}
          onClose={() => setScanOpen(false)}
        />
      )}
      <div className="bg-white dark:bg-white/[0.06] dark:border-white/[0.07] rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
        <div className="flex items-center gap-3">
          <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl ring-2 ring-success-200" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy-900">{selectedMatch.visitorName}</p>
            <p className="text-sm text-navy-400 truncate">{selectedMatch.departmentName}</p>
            <p className="text-xs text-success-600 font-semibold mt-1">Photo captured</p>
          </div>
          <button onClick={onRetake} className="text-danger-600 hover:text-danger-700 text-sm font-semibold shrink-0">Retake</button>
        </div>
        {scanSection}
        {/* The tick box is the record, the textarea only describes it.
            `carrying_material` used to be inferred from "did the guard type
            anything?", which silently made an empty box mean "carrying
            nothing" — indistinguishable from a guard who ticked the box and
            got interrupted before writing the list. The flag is now an
            explicit answer, and the remarks are gated behind it so the field
            only appears once there is something to describe. */}
        <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] p-3.5 space-y-3">
          <label htmlFor="carrying-material" className="flex items-start gap-3 cursor-pointer">
            <input
              id="carrying-material"
              type="checkbox"
              checked={carrying}
              onChange={(e) => onCarryingChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-300 text-brand-600 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-navy-800 dark:text-white">Carrying material</span>
              <span className="block text-[11px] text-navy-400 mt-0.5">
                Tick if the visitor is bringing anything in that has to be checked back out.
              </span>
            </span>
          </label>

          {carrying && (
            <div className="animate-fade-in">
              <label className="label" htmlFor="carrying-remarks">What are they carrying?</label>
              <textarea
                id="carrying-remarks"
                value={remarks}
                onChange={(e) => onRemarksChange(e.target.value)}
                placeholder="e.g. 1 Dell Latitude laptop, 2 Samsung phones, 1 toolbox"
                rows={3}
                maxLength={500}
                className="input w-full resize-none"
                aria-describedby="carrying-remarks-hint"
              />
              {/* Free text on purpose: a fixed device list would be wrong within
                  a week, and what matters on the way out is that the guard wrote
                  down enough to match the item back to the visitor. */}
              <p id="carrying-remarks-hint" className="text-[10px] text-navy-300 mt-1">
                List each device or item with quantity and brand, so it can be checked back out.
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-3 text-sm transition-all">Cancel</button>
          <button onClick={onConfirm} disabled={checkingIn || matchStatus === 'mismatch'}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {checkingIn ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
            ) : 'Check In'}
          </button>
        </div>
      </div>
      {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
    </div>
  );
}

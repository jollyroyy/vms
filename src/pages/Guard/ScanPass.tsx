// Scanning is UNCONDITIONAL — there is no feature flag on this page. It used
// to sit behind `isFeatureEnabled('qr')`, which was a trap rather than a
// safeguard: Vite inlines env vars at BUILD time and .env is git-ignored, so
// every deployed build had the flag compiled to false and the guard was shown
// "QR scanning is unavailable on this deployment" forever, with no way to fix
// it from the running app. A scanner the deployment cannot turn on is not a
// feature behind a flag, it is a broken page. Do not re-gate this.
//
// The camera lane of the two arrival routes. /guard/pre-approvals is the
// list-and-search desk; this page is scan-first: a pass held up to the camera
// resolves straight to the visitor and the whole check-in happens here. The
// QR gate is GuardQRScan's job (it rejects expired / spent / unknown codes
// before this page ever sees the Visit), and the check-in WRITE is the same
// shared mutation the search desk uses — lib/checkInFlow.ts — so the two
// surfaces can never drift apart on the security-relevant moment.
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { checkInScannedVisit } from '../../lib/checkInFlow';
import GuardQRScan from './GuardQRScan';
import ScanPassLookup from './ScanPassLookup';
import ScanPassSearchBar from './ScanPassSearchBar';
import CheckInPhotoStep from './CheckInPhotoStep';
import CheckInVisitorSummary from './CheckInVisitorSummary';
import { visitToMatchItem } from './qrMatchItem';
import type { MatchItem } from './checkInTypes';
import type { IdScanResult } from './IdScanOverlay';

export default function GuardScanPass(): React.ReactElement {
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchItem | null>(null);
  // A pass that resolved to a real visit but may not be honoured. It is held
  // separately from `match` on purpose: `match` means "this person is checking
  // in", and merging the two would put a photo step under a visitor who is
  // already inside.
  const [blocked, setBlocked] = useState<{ match: MatchItem; reason: string } | null>(null);
  // Owned here, not in the box: the box is in the header and the results render
  // below it, so the two halves of one search live on either side of the title.
  const [query, setQuery] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backToScanner = useCallback(() => {
    setMatch(null); setBlocked(null); setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const handleResolved = useCallback(async (visit: Visit) => {
    // Host names are not part of the QR lookup, so attach them the same way
    // CheckInPanel does — the summary the guard checks the visitor against
    // needs the person they are here to meet.
    const [withHost] = await attachHostNames([visit]);
    setMatch(visitToMatchItem(withHost ?? visit));
    setBlocked(null);
    setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
  }, []);

  // A pass the gate refused. It goes through the SAME host-name attachment and
  // the SAME `visitToMatchItem` as an accepted one, so the record a guard reads
  // off a refused scan is field-for-field the record they would have read off
  // an accepted one — the refusal changes what they may DO, never what they are
  // told. Anything less and "already checked in" is a dead end: the guard
  // cannot see when, or who the visitor is here to meet, or whether the person
  // in front of them is even the right one.
  const handleBlocked = useCallback(async (visit: Visit, reason: string) => {
    const [withHost] = await attachHostNames([visit]);
    setBlocked({ match: visitToMatchItem(withHost ?? visit), reason });
    setMatch(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!match || !photoBlob) return;
    setCheckingIn(true); setError('');
    const outcome = await checkInScannedVisit({
      match, visit: null, photoBlob, carrying, remarks, idScan, cardNumber,
    });
    if (!outcome.ok) { setError(outcome.message); setCheckingIn(false); return; }
    setSuccessMsg(`"${outcome.visitorName}" checked in successfully.`);
    backToScanner();
    setTimeout(() => setSuccessMsg(''), 6000);
    setCheckingIn(false);
  }, [match, photoBlob, carrying, remarks, idScan, cardNumber, backToScanner]);

  return (
    <div className="space-y-5">
      {/* NO PAGE TITLE AND NO SUBTITLE (client instruction, 2026-08-17). The
          sidebar item the guard just clicked already says "Scan Pass", and the
          line under it described the two controls that are on screen directly
          beneath it — a search box that says Search and a button that says Scan
          QR code. The same rule that took the heading off the guard dashboard:
          a page does not spend its widest line restating its own name.

          The search box survives and keeps its place at the top right — it is
          the fallback route, and it used to be a card BELOW the scanner, i.e.
          under the fold of a full-height camera frame, hidden behind the thing
          that had just failed the guard. */}
      {!match && !blocked && (
        <div className="flex justify-end">
          <ScanPassSearchBar onQueryChange={setQuery} />
        </div>
      )}

      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {blocked ? (
        /* The record, then the refusal — in that order. A guard holding a
           scanner is identifying a person first and adjudicating second, and a
           red bar with no name under it cannot be checked against anybody.
           The same summary the accepted path renders, with no photo step and no
           Check In button, because the one thing this scan may not do is admit
           them. */
        <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
          <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-5 shadow-sm border border-surface-100 dark:border-white/[0.07] space-y-4">
            <CheckInVisitorSummary match={blocked.match} />
            <div className="rounded-xl bg-danger-50 border border-danger-200 dark:border-danger-500/25 px-4 py-3">
              <p className="text-sm font-bold text-danger-700">Cannot check this pass in</p>
              <p className="text-sm text-danger-700/90 mt-0.5">{blocked.reason}</p>
            </div>
            <button type="button" onClick={backToScanner} className="btn-secondary w-full py-2.5 text-sm">
              Scan another pass
            </button>
          </div>
        </div>
      ) : match ? (
        <CheckInPhotoStep
          selectedMatch={match}
          photoBlob={photoBlob}
          error={error}
          checkingIn={checkingIn}
          carrying={carrying}
          onCarryingChange={setCarrying}
          remarks={remarks}
          onRemarksChange={setRemarks}
          cardNumber={cardNumber}
          onCardNumberChange={setCardNumber}
          onBack={backToScanner}
          onCapture={setPhotoBlob}
          onRetake={() => setPhotoBlob(null)}
          onCancel={backToScanner}
          onConfirm={handleConfirm}
          onScanResult={setIdScan}
        />
      ) : (
        <div className="space-y-5">
          {/* The other way in, for the ordinary cases the camera cannot serve:
              a flat phone, a pass left at home, a printout that will not focus,
              a browser that hides mediaDevices on an insecure origin. Its
              results sit directly under the box that asked for them — above the
              scanner, not below it. It searches every status, and the rows it
              returns are non-actionable unless the pass is genuinely honourable
              today. Renders nothing until a search is submitted. */}
          <ScanPassLookup query={query} onSelect={setMatch} />
          {/* autoStart={false}: this is a TAB, not a modal somebody pressed
              Scan to open, and it is the search desk as well. The camera used
              to come on the moment the tab was clicked — webcam light and a
              live picture of the guard — for the very common case of looking
              a visitor up by mobile number. Nothing acquires the device until
              they press Scan QR code. */}
          <GuardQRScan
            autoStart={false}
            onResolved={(v) => void handleResolved(v)}
            onBlocked={(v, reason) => void handleBlocked(v, reason)}
            onCancel={() => navigate('/guard/pre-approvals')}
          />
        </div>
      )}
    </div>
  );
}
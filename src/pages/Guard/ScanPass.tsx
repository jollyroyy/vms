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
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { checkInScannedVisit } from '../../lib/checkInFlow';
import { fetchVisitForExit, logVisitExit } from '../../lib/checkOutFlow';
import CardReturnConfirm from './CardReturnConfirm';
import GuardQRScan from './GuardQRScan';
import ScanPassLookup from './ScanPassLookup';
import ScanPassDetail from './ScanPassDetail';
import ScanPassEntryBar from './ScanPassEntryBar';
import CheckInPhotoStep from './CheckInPhotoStep';
import CheckInVisitorSummary from './CheckInVisitorSummary';
import { visitToMatchItem } from './qrMatchItem';
import type { MatchItem } from './checkInTypes';
import type { IdScanResult } from './IdScanOverlay';

export default function GuardScanPass(): React.ReactElement {
  const [match, setMatch] = useState<MatchItem | null>(null);
  // THE CAMERA IS NOT ON THIS PAGE UNTIL IT IS ASKED FOR (client instruction,
  // 2026-08-18: give a link to scan below the search, and only then show the
  // camera). `GuardQRScan` is not RENDERED while this is false — the arming is
  // owned here rather than inside the scanner, so what the guard lands on is a
  // search box and one line under it, not a scanner card standing by. The
  // component keeps its own `autoStart` placeholder for any other caller; on
  // this page the press has already happened by the time it mounts, the same
  // reasoning `CheckInScanGate` uses.
  const [scanOpen, setScanOpen] = useState(false);
  // THE VISITOR THE GUARD CLICKED (client instruction, 2026-08-18: opening a
  // result must render everything Entry & Exit renders, with the button on it).
  // Only the id is held: `ScanPassDetail` re-reads the row itself, so the frame
  // can never describe a visitor a second device has moved since the search ran.
  const [detailId, setDetailId] = useState<string | null>(null);
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
  // Whether the guard waved a name mismatch through (migration 097). Held
  // beside `idScan` and cleared with it, because it is a decision about that
  // reading and must never outlive it.
  const [idOverride, setIdOverride] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  // THE VISITOR WHO IS ALREADY INSIDE (client instruction, 2026-08-17). A
  // search that finds somebody who is checked in has exactly one useful next
  // move, and it is not "go to another tab". The whole exit — the card-return
  // gate and the write — is the same `CardReturnConfirm` + `logVisitExit` pair
  // Entry & Exit uses, so the two surfaces cannot disagree about whether a
  // human witnessed the departure or whether the card came back.
  const [exitTarget, setExitTarget] = useState<Visit | null>(null);
  const [exiting, setExiting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backToScanner = useCallback(() => {
    setMatch(null); setBlocked(null); setDetailId(null); setPhotoBlob(null); setIdScan(null); setIdOverride(false); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const handleResolved = useCallback(async (visit: Visit) => {
    // Host names are not part of the QR lookup, so attach them the same way
    // CheckInPanel does — the summary the guard checks the visitor against
    // needs the person they are here to meet.
    const [withHost] = await attachHostNames([visit]);
    setMatch(visitToMatchItem(withHost ?? visit));
    setBlocked(null);
    setPhotoBlob(null); setIdScan(null); setIdOverride(false); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
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

  // Check Out pressed on the OPEN RECORD. The row is already the freshly read
  // one — `ScanPassDetail` fetched it — so this is the same guard the list
  // route applies, without a second round trip a keystroke later.
  const startCheckOutVisit = useCallback((visit: Visit) => {
    setError('');
    if (visit.status !== 'checked_in') { setError('That visitor has already been checked out.'); return; }
    setExitTarget(visit);
  }, []);

  // Check In pressed on the open record. It does NOT write: it hands the guard
  // to CheckInPhotoStep, which is where the photo, the mandatory ID scan and
  // the visitor card number are collected on every other route in.
  const startCheckInVisit = useCallback(async (visit: Visit) => {
    const [withHost] = await attachHostNames([visit]);
    setDetailId(null);
    setMatch(visitToMatchItem(withHost ?? visit));
    setBlocked(null);
    setPhotoBlob(null); setIdScan(null); setIdOverride(false); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const startCheckOut = useCallback(async (m: MatchItem) => {
    if (!m.visitId) return;
    setError('');
    const visit = await fetchVisitForExit(m.visitId);
    if (!visit) { setError('Could not open that visit. Try the search again.'); return; }
    // Re-read, not the list's copy: another device may have checked them out
    // while this search sat on screen, and the dialog must not offer to collect
    // a card that has already come back.
    if (visit.status !== 'checked_in') { setError('That visitor has already been checked out.'); return; }
    setExitTarget(visit);
  }, []);

  const confirmCheckOut = useCallback(async () => {
    if (!exitTarget) return;
    setExiting(true);
    const outcome = await logVisitExit(exitTarget);
    setExiting(false);
    if (!outcome.ok) { setError(outcome.message); setExitTarget(null); return; }
    setSuccessMsg(`"${exitTarget.visitor?.full_name ?? 'Visitor'}" checked out successfully.`);
    setExitTarget(null);
    // The open record described somebody who is inside; they are not any more.
    setDetailId(null);
    setTimeout(() => setSuccessMsg(''), 6000);
  }, [exitTarget]);

  const handleConfirm = useCallback(async () => {
    if (!match || !photoBlob) return;
    setCheckingIn(true); setError('');
    const outcome = await checkInScannedVisit({
      idOverride,
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
      {!match && !blocked && !detailId && (
        <ScanPassEntryBar
          onQueryChange={setQuery}
          scanOpen={scanOpen}
          onOpenScanner={() => setScanOpen(true)}
        />
      )}

      {exitTarget && (
        <CardReturnConfirm
          visit={exitTarget}
          onConfirm={() => { if (!exiting) void confirmCheckOut(); }}
          onClose={() => setExitTarget(null)}
        />
      )}

      {/* A failure from either direction, above the results that produced it.
          CheckInPhotoStep prints its own copy of `error` while a check-in is on
          screen; this branch is the one place a check-out failure can be said. */}
      {!match && error && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
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
          onOverrideChange={setIdOverride}
        />
      ) : detailId ? (
        /* THE FULL RECORD, in the Entry & Exit frame, instead of the results —
           not beside them. The frame is a two-column page of its own, and a
           list of other visitors under it would invite a click that silently
           swapped the subject of the buttons above. "Back to results" returns. */
        <ScanPassDetail
          visitId={detailId}
          onBack={() => { setDetailId(null); setError(''); }}
          onCheckOut={startCheckOutVisit}
          onCheckIn={(v) => { void startCheckInVisit(v); }}
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
          <ScanPassLookup
            query={query}
            onSelect={setMatch}
            onCheckOut={(m) => void startCheckOut(m)}
            onOpen={(m) => { if (m.visitId) { setError(''); setDetailId(m.visitId); } }}
          />
          {/* MOUNTED ONLY ONCE THE GUARD HAS ASKED FOR IT. Nothing above
              acquires a camera device, because nothing above exists until this
              branch renders — which is a stronger guarantee than the old
              `autoStart={false}`, where the component was on screen with its
              placeholder and its own arming button.

              `onCancel` returns to the search rather than navigating to
              /guard/pre-approvals: "Search Manually" now means the search box
              at the top of THIS page, which is where the guard started. */}
          {scanOpen && (
            <GuardQRScan
              onResolved={(v) => void handleResolved(v)}
              onBlocked={(v, reason) => void handleBlocked(v, reason)}
              onCancel={() => setScanOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
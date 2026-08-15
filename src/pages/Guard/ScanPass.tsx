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
import CheckInPhotoStep from './CheckInPhotoStep';
import { visitToMatchItem } from './qrMatchItem';
import type { MatchItem } from './checkInTypes';
import type { IdScanResult } from './IdScanOverlay';

export default function GuardScanPass(): React.ReactElement {
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchItem | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backToScanner = useCallback(() => {
    setMatch(null); setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const handleResolved = useCallback(async (visit: Visit) => {
    // Host names are not part of the QR lookup, so attach them the same way
    // CheckInPanel does — the summary the guard checks the visitor against
    // needs the person they are here to meet.
    const [withHost] = await attachHostNames([visit]);
    setMatch(visitToMatchItem(withHost ?? visit));
    setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); setError('');
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
      <div>
        <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white">Scan Pass</h1>
        <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">Scan a visitor's entry pass to check them in — or find them by name or mobile number.</p>
      </div>

      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {match ? (
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
          <GuardQRScan onResolved={(v) => void handleResolved(v)} onCancel={() => navigate('/guard/pre-approvals')} />
          {/* The other way in, for the ordinary cases the camera cannot serve:
              a flat phone, a pass left at home, a printout that will not focus,
              a browser that hides mediaDevices on an insecure origin. See
              ScanPassLookup — it searches every status, and the rows it returns
              are non-actionable unless the pass is genuinely honourable today. */}
          <ScanPassLookup onSelect={setMatch} />
        </div>
      )}
    </div>
  );
}
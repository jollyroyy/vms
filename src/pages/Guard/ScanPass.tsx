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
import { isFeatureEnabled } from '../../lib/featureFlags';
import { attachHostNames } from '../../lib/hostNames';
import { checkInScannedVisit } from '../../lib/checkInFlow';
import GuardQRScan from './GuardQRScan';
import CheckInPhotoStep from './CheckInPhotoStep';
import { visitToMatchItem } from './qrMatchItem';
import type { MatchItem } from './CheckInPanel';
import type { IdScanResult } from './IdScanOverlay';

export default function GuardScanPass(): React.ReactElement {
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchItem | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backToScanner = useCallback(() => {
    setMatch(null); setPhotoBlob(null); setIdScan(null); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const handleResolved = useCallback(async (visit: Visit) => {
    // Host names are not part of the QR lookup, so attach them the same way
    // CheckInPanel does — the summary the guard checks the visitor against
    // needs the person they are here to meet.
    const [withHost] = await attachHostNames([visit]);
    setMatch(visitToMatchItem(withHost ?? visit));
    setPhotoBlob(null); setIdScan(null); setCarrying(false); setRemarks(''); setError('');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!match || !photoBlob) return;
    setCheckingIn(true); setError('');
    const outcome = await checkInScannedVisit({
      match, visit: null, photoBlob, carrying, remarks, idScan,
    });
    if (!outcome.ok) { setError(outcome.message); setCheckingIn(false); return; }
    setSuccessMsg(`"${outcome.visitorName}" checked in successfully.`);
    backToScanner();
    setTimeout(() => setSuccessMsg(''), 6000);
    setCheckingIn(false);
  }, [match, photoBlob, carrying, remarks, idScan, backToScanner]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-950 dark:text-white">Scan Pass</h1>
        <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">Scan a visitor's entry pass to check them in.</p>
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
          onBack={backToScanner}
          onCapture={setPhotoBlob}
          onRetake={() => setPhotoBlob(null)}
          onCancel={backToScanner}
          onConfirm={handleConfirm}
          onScanResult={setIdScan}
        />
      ) : isFeatureEnabled('qr') ? (
        <GuardQRScan onResolved={(v) => void handleResolved(v)} onCancel={() => navigate('/guard/pre-approvals')} />
      ) : (
        <div className="card p-5 max-w-lg">
          <p className="text-sm font-semibold text-navy-700">QR scanning is unavailable on this deployment.</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 mt-1">Find the visitor by phone number on the Pre-Approvals desk instead.</p>
          <button type="button" onClick={() => navigate('/guard/pre-approvals')}
            className="mt-4 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
            Open Pre-Approvals
          </button>
        </div>
      )}
    </div>
  );
}
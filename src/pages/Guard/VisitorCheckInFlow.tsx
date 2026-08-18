import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import CheckInPhotoStep from './CheckInPhotoStep';
import { visitToMatchItem } from './qrMatchItem';
import { checkInScannedVisit } from '../../lib/checkInFlow';
import { isAlreadyInsideError, ALREADY_INSIDE_FALLBACK } from '../../lib/activeVisit';
import { safeErrorMessage } from '../../lib/errors';
import type { IdScanResult } from './IdScanOverlay';

type Props = {
  visit: Visit;
  onDone: (visitorName: string) => void;
  onCancel: () => void;
  /** Open the ID scan overlay immediately (see CheckInPhotoStep.autoScan).
   *  The dashboard's Verify ID button passes this: a click that promised a
   *  scan must land on a scan, not on a form with a scan button in it. */
  autoScan?: boolean;
};

// Checking in a visitor picked from the Expected list.
//
// This is the same two pieces the Scan Pass lane and CheckInPanel's search desk
// already use — visitToMatchItem to shape the row, checkInScannedVisit to write
// it — with nothing between them. That matters: moving a visit to `checked_in`
// is the security-relevant moment of the whole gate, and a third hand-rolled
// copy of that mutation is a third place for it to drift.
//
// A photo is structurally mandatory, but it is not taken twice (client
// instruction, 2026-08-18). `performCheckIn` returns early when the visit has
// neither a freshly captured blob nor a face already on the row, and
// CheckInPhotoStep renders no confirm control in that state — an approval says
// who was expected, the photo is the record of who actually walked in. When the
// row DOES carry one (every walk-in does), the step shows it and the camera
// never opens.
export default function VisitorCheckInFlow({ visit, onDone, onCancel, autoScan = false }: Props): React.ReactElement {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  // Whether the guard waved a name mismatch through (migration 097). Held
  // beside `idScan` and cleared with it, because it is a decision about that
  // reading and must never outlive it.
  const [idOverride, setIdOverride] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');

  const match = visitToMatchItem(visit);

  const performCheckIn = async () => {
    // Null is legitimate when the visit already carries a face — see the note
    // on `photoBlob` in lib/checkInFlow.ts. CheckInPhotoStep never renders a
    // confirm control with neither, so this guard only has to refuse the case
    // where nobody has ever photographed this visitor.
    if (!photoBlob && !match.photoUrl) return;
    setCheckingIn(true); setError('');
    try {
      const outcome = await checkInScannedVisit({ match, visit, photoBlob, carrying, remarks, idScan, cardNumber, idOverride });
      if (!outcome.ok) { setError(outcome.message); return; }
      onDone(outcome.visitorName);
    } catch (err) {
      // The already-inside race is mapped to its named message inside
      // checkInScannedVisit; anything reaching here is unplanned.
      setError(isAlreadyInsideError(err) ? ALREADY_INSIDE_FALLBACK : safeErrorMessage(err, 'Check-in failed.'));
    } finally {
      setCheckingIn(false);
    }
  };

  return (
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
      onBack={onCancel}
      onCapture={setPhotoBlob}
      onRetake={() => setPhotoBlob(null)}
      onCancel={onCancel}
      onConfirm={() => { void performCheckIn(); }}
      onScanResult={setIdScan}
      onOverrideChange={setIdOverride}
      autoScan={autoScan}
    />
  );
}

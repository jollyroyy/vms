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
};

// Checking in a visitor picked from the Expected list.
//
// This is the same two pieces the Scan Pass lane and CheckInPanel's search desk
// already use — visitToMatchItem to shape the row, checkInScannedVisit to write
// it — with nothing between them. That matters: moving a visit to `checked_in`
// is the security-relevant moment of the whole gate, and a third hand-rolled
// copy of that mutation is a third place for it to drift.
//
// A photo is structurally mandatory. `performCheckIn` returns early without
// one, and CheckInPhotoStep does not render its confirm control until a photo
// exists — an approval says who was expected, the photo is the record of who
// actually walked in.
export default function VisitorCheckInFlow({ visit, onDone, onCancel }: Props): React.ReactElement {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');

  const match = visitToMatchItem(visit);

  const performCheckIn = async () => {
    if (!photoBlob) return;
    setCheckingIn(true); setError('');
    try {
      const outcome = await checkInScannedVisit({ match, visit, photoBlob, carrying, remarks, idScan });
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
      onBack={onCancel}
      onCapture={setPhotoBlob}
      onRetake={() => setPhotoBlob(null)}
      onCancel={onCancel}
      onConfirm={() => { void performCheckIn(); }}
      onScanResult={setIdScan}
    />
  );
}

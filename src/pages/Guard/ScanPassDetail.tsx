import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import type { Visit } from '../../types/index';
import type { ReportVisit } from '../../lib/reportRow';
import { fetchVisitById } from '../../lib/fetchVisitById';
import { attachHostNames } from '../../lib/hostNames';
import { buildQrPayload } from '../../lib/qrToken';
import { printVisitorBadge } from '../../lib/printBadge';
import { isCheckableStatus } from '../../lib/checkableStatus';
import { isDueToday } from '../../lib/visitExpiry';
import CheckInFrame from './CheckInFrame';

// THE RECORD BEHIND A SEARCH HIT, DRAWN THE WAY ENTRY & EXIT DRAWS IT (client
// instruction, 2026-08-18: clicking a visitor here must render exactly what
// clicking one under Entry & Exit renders, with the Check In or Check Out
// button on it).
//
// It is the SAME COMPONENT, not a second one that looks like it: `CheckInFrame`
// — gate photo and identity ring, the Photo → ID Scan → Host Notified tracker,
// `CheckInTimeline`, the vehicle, and the printable pass with its QR. A
// lookalike built for this page would be the fourth place in this repo where
// one visitor is described twice and the two copies drift.
//
// WHY IT RE-FETCHES rather than being handed the row: the results list holds
// `MatchItem`s, a projection assembled for reading, and the frame needs the
// whole visit — photo_data, the visitor's id_type, the vehicle, the qr_token,
// every timeline stamp. Widening the list to carry all of that so a click can
// render it would put the frame's contents into a shape built for a list. It
// also re-reads a moment before the guard acts, which is the same reason
// `fetchVisitForExit` exists: another device may have moved this visitor while
// these results sat on screen.
//
// IT WRITES NOTHING. Check Out hands back to the page's `CardReturnConfirm` +
// `logVisitExit` pair; Check In hands back to `CheckInPhotoStep`, so the photo,
// the mandatory ID scan and the visitor card number are still collected by the
// one flow that collects them everywhere else.

type Props = {
  visitId: string;
  onBack: () => void;
  /** Offered only when this visitor is genuinely inside. */
  onCheckOut: (visit: Visit) => void;
  /** Offered only when the pass is honourable today and they are outside. */
  onCheckIn: (visit: Visit) => void;
};

export default function ScanPassDetail({ visitId, onBack, onCheckOut, onCheckIn }: Props): React.ReactElement {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void (async () => {
      const row = await fetchVisitById(visitId);
      // The host is who the visitor came to see; it is not on the visit row and
      // every other surface attaches it the same way.
      const [withHost] = row ? await attachHostNames([row]) : [null];
      if (!live) return;
      setVisit((withHost as Visit | null) ?? row);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [visitId]);

  useEffect(() => {
    // The SAME QR the visitor is holding, byte for byte — same payload, width
    // and ink as `PreApprovalPass` and Entry & Exit. A visit with no token
    // renders no code at all rather than an invented one nothing can parse.
    if (!visit?.qr_token) { setQrDataUrl(null); return; }
    QRCode.toDataURL(buildQrPayload(visit.qr_token), {
      width: 240,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [visit]);

  if (loading) return <div className="skeleton h-96 w-full rounded-2xl" />;

  if (!visit) {
    return (
      <div className="card empty-state !py-10">
        <p className="text-sm font-semibold text-navy-800">Could not open that visitor.</p>
        <p className="text-xs text-navy-700 mt-1">The record may have been changed on another device. Search again.</p>
        <button type="button" onClick={onBack} className="btn-secondary mt-4 px-4 py-2 text-sm">Back to results</button>
      </div>
    );
  }

  // EXACTLY ONE OF THE TWO, and the visit's own state decides which — the same
  // rule the result row follows. Check Out is `checked_in` and nothing else;
  // Check In needs a status that may still be honoured AND a slot that is
  // today, so a pass from last week opens fully legible and offers nothing.
  const inside = visit.status === 'checked_in';
  const admissible = !inside && isCheckableStatus(visit.status) && isDueToday(visit);

  return (
    <CheckInFrame
      activeVisit={visit as ReportVisit}
      qrDataUrl={qrDataUrl}
      onPrintBadge={() => printVisitorBadge()}
      onClose={onBack}
      backLabel="Back to results"
      onCheckOut={inside ? () => onCheckOut(visit) : undefined}
      onCheckIn={admissible ? () => onCheckIn(visit) : undefined}
    />
  );
}

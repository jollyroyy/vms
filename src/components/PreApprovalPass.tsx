// On-screen entry-pass preview for a pre-approved visit, with a Download PDF
// action. Lives in components/ (not pages/HOD/) because it is shown from two
// places: PreApproveForm's success popup right after pre-approving, and
// VisitorDetails' "View Pass" toggle for reopening an already-approved visit.
// Deliberately NOT components/Badge: that component is print-only (base.css
// `.print-only { display: none }` outside @media print) and built for the
// physical visitor pass, so reusing it here would render invisibly on screen.
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Visit } from '../types/index';
import { buildQrPayload, evaluateQrVisit } from '../lib/qrToken';
import { downloadQrPassPdf } from '../lib/qrPassPdf';
import { downloadQrPassPng } from '../lib/qrPassImage';
import { dataUrlToFile, canSharePassFile, sharePassFile, waPhone, waMeUrl, passShareMessage } from '../lib/sharePass';
import { formatDateTime } from '../lib/formatDate';
import { istDayEnd } from '../lib/visitExpiry';
import { STATUS_STYLES } from '../lib/statusStyles';
import PassIdentity from './PassIdentity';

type Props = {
  visit: Visit;
  /** Forwarded to PassIdentity. Defaults to true; PreApproveForm's success
   * popup relies on it (its visitor has an ID on record), while callers that
   * pass identityShownElsewhere never render PassIdentity at all. */
  showIdProof?: boolean;
  /** True when the caller already renders the visitor's photo, name and
   * company above this component (VisitorDetails' own header card does,
   * right before its "View Pass" toggle). 2026-08-10 client report: opening
   * a pass from inside VisitorDetails showed the name and company TWICE —
   * once in the header, once again here. When true, this component omits its
   * own identity block (and the Person-to-Meet fact, which VisitorDetails
   * already shows as its own row) and keeps only what is unique to the pass:
   * ref/status, the scheduled time, and the QR. Defaults to false for the
   * other caller, PreApproveForm's success popup, which shows nothing else. */
  identityShownElsewhere?: boolean;
};

export default function PreApprovalPass({ visit, showIdProof = true, identityShownElsewhere = false }: Props): React.ReactElement {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // The PDF has to load and re-encode the photo before it can be written, so
  // the button would otherwise sit there looking inert on a slow photo fetch.
  const [buildingPdf, setBuildingPdf] = useState(false);
  const photo = visit.photo_url ?? visit.photo_data;
  const gate = evaluateQrVisit(visit);

  useEffect(() => {
    setQrDataUrl(null);
    // margin left at the qrcode library's spec default (4 modules) — a
    // tighter quiet zone breaks detection once the code has been printed,
    // screenshotted, or photographed instead of scanned straight off-screen.
    QRCode.toDataURL(buildQrPayload(visit.qr_token), {
      width: 240,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [visit.qr_token]);

  const statusStyle = STATUS_STYLES[visit.status];

  // Sending the pass to the visitor (client instruction, 2026-08-17). Two
  // mechanisms behind one button — see lib/sharePass.ts for why neither alone
  // is enough: the share sheet carries the FILE but not the recipient, wa.me
  // carries the RECIPIENT but can never carry a file.
  //
  // NOTHING IS AWAITED BEFORE `navigator.share`. The QR data URL is already in
  // state, `dataUrlToFile` does no I/O, and the share call is the first await
  // in the handler — an await in front of it spends the user gesture the API
  // requires and the sheet silently refuses to open.
  const recipient = waPhone(visit.visitor?.phone);
  const sendPass = async () => {
    if (!qrDataUrl) return;
    const file = dataUrlToFile(qrDataUrl, `entry-pass-${visit.ref_number}.png`);
    if (canSharePassFile(file) && file) {
      const outcome = await sharePassFile(visit, file);
      // Backed out of the sheet on purpose — they have already decided not to
      // send, and throwing a WhatsApp tab at them would override that.
      if (outcome === 'shared' || outcome === 'dismissed') return;
    }
    // No share sheet, or it would not open. The link opens the visitor's own
    // chat with the details as text; the image comes down beside it so the HOD
    // can attach it in the two taps WhatsApp itself needs. Downloading it is
    // not a nicety — it is the only way the QR reaches the visitor on this path.
    downloadQrPassPng(visit, qrDataUrl);
    window.open(waMeUrl(recipient, passShareMessage(visit)), '_blank', 'noopener,noreferrer');
  };

  return (
    // Its own contained surface, not the bare border-t this used to be — inside
    // the HOD popup's translucent glass modal, content floating with no card of
    // its own had nothing to read against in dark mode. White in light, a low-
    // alpha white lift in dark: `dark:bg-navy-800` looks right until you remember
    // navy is INVERTED in dark mode and would render this near-white-on-white.
    <div className="mt-2 w-full flex flex-col items-center gap-3 rounded-2xl border border-surface-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.06] p-4">
      {/* Ref number + status are the two facts a guard checks first, side by
          side at the top so neither needs scrolling to find. Status reuses the
          app's own STATUS_STYLES tokens — never a parallel palette. */}
      <div className="w-full flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold text-navy-700 uppercase tracking-wide">Entry Pass</p>
          <p className="text-xs text-navy-500 font-mono">{visit.ref_number}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </span>
      </div>

      {/* Visitor identity block. Omitted when the caller already renders the
          photo, name and company above this component — VisitorDetails' own
          header card does, and showing them twice is an error. The QR itself
          carries only an opaque token — never the visitor's name, ID or
          photo. This block is what a *human* checks the pass against;
          scanning it is what pulls the same details out of the database. */}
      {!identityShownElsewhere && (
        <div className="w-full max-w-xs">
          <PassIdentity
            photoUrl={photo}
            name={visit.visitor?.full_name ?? ''}
            vendorName={visit.visitor?.vendor_name}
            idType={visit.visitor?.id_type}
            idLast4={visit.visitor?.id_last4}
            showIdProof={showIdProof}
          />
        </div>
      )}

      {/* Who they're here for, and how long the pass is good for — grouped
          apart from identity so a guard scanning down the card finds each
          fact in its own labelled block, not one undifferentiated list. The
          Person-to-Meet fact is dropped along with the identity block: the
          caller that says it already shows identity also shows it. */}
      <div className="w-full max-w-xs grid grid-cols-1 gap-y-2.5 rounded-xl bg-surface-50 dark:bg-white/[0.04] px-3 py-2.5">
        {!identityShownElsewhere && (
          <PassField label="Person to Meet" value={visit.host?.full_name} sub={visit.department?.name} />
        )}
        {/* SCHEDULED AT and VALID UNTIL are two different facts and the pass now
            says both (client report, 2026-08-15). One "Valid For" row carrying
            `scheduled_for` was mislabelled: when the visitor is expected is not
            how long the pass works, and 071/073 set `qr_expires_at` to the end
            of the DEPARTURE day, which for a multi-day contractor is days
            later. `passValidUntil` is the same resolution the guard's badge
            rail uses, so the two screens cannot disagree about when a pass dies.

            The block is ONE column now, not two. At `text-xs` inside a 320px
            card, half the width could not hold "14 Aug 2026, 10:30 am", so the
            value was clipped mid-date — and `truncate` gave no ellipsis a
            reader could trust, which is how a cut-off time reads as a complete
            one. */}
        <PassField label="Scheduled At" value={formatDateTime(visit.scheduled_for ?? visit.created_at)} />
        <PassField label="Valid Until" value={passValidUntil(visit)} />
      </div>

      {/* A QR is only scannable as dark-on-white, so its tile stays explicitly
          white in both themes — it must never inherit the card's dark lift.
          Size is unchanged from before this redesign: never shrink it for
          aesthetics, it has to actually scan at the gate. */}
      {qrDataUrl ? (
        <div className="bg-white p-2 rounded-xl">
          <img src={qrDataUrl} alt="Entry pass QR code" className="w-32 h-32 rounded-lg ring-1 ring-surface-200" />
        </div>
      ) : (
        <div className="bg-white p-2 rounded-xl">
          <div className="w-32 h-32 rounded-lg bg-surface-50 animate-pulse" />
        </div>
      )}
      {/* Once the visit is checked in the token no longer opens the gate, but
          the pass is still the badge being worn — so it stays downloadable and
          says plainly that the code itself is spent. */}
      {gate.ok ? (
        <p className="text-[10px] text-navy-300">Scan this at the guard console to check in</p>
      ) : (
        <p className="text-[10px] text-warning-600 text-center max-w-xs">{gate.reason}</p>
      )}
      <div className="flex gap-2 flex-wrap justify-center">
        {/* Primary, and first: handing the pass to the visitor is what the
            approver came here to do. The two Download buttons were the only
            way out of this card and both of them end with a file in the HOD's
            downloads folder, which is not where the visitor is. */}
        <button
          type="button"
          onClick={() => void sendPass()}
          disabled={!qrDataUrl}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-60 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
          </svg>
          Send on WhatsApp
        </button>
        <button
          type="button"
          onClick={() => qrDataUrl && downloadQrPassPng(visit, qrDataUrl)}
          disabled={!qrDataUrl}
          className="btn-secondary text-xs px-4 py-2 disabled:opacity-60"
        >
          Download Image
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!qrDataUrl || buildingPdf) return;
            setBuildingPdf(true);
            try {
              await downloadQrPassPdf(visit, qrDataUrl, photo);
            } finally {
              setBuildingPdf(false);
            }
          }}
          disabled={!qrDataUrl || buildingPdf}
          className="btn-secondary text-xs px-4 py-2 disabled:opacity-60"
        >
          {buildingPdf ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
      {/* Says which chat is about to open, because the alternative is the HOD
          finding out after the fact. When there is no usable number the link
          opens WhatsApp's contact picker instead, and the copy says so rather
          than the button appearing to do the wrong thing. */}
      <p className="text-[10px] text-navy-300 text-center">
        {recipient
          ? `Opens WhatsApp to +${recipient}. The image is for uploading at the gate — the PDF is for printing.`
          : 'No mobile number on record — WhatsApp will ask you to pick the visitor. The image is for uploading at the gate; the PDF is for printing.'}
      </p>
    </div>
  );
}

// A single labelled fact in the "who/validity" block. Every value reads as
// intentional — a missing Person to Meet renders "—", never a blank that
// looks broken.
function PassField({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-navy-700 uppercase tracking-wider font-semibold leading-none mb-1">{label}</p>
      {/* `break-words`, never `truncate`. These are the values the visitor is
          handed and the guard reads back; a clipped date is indistinguishable
          from a complete one, and there is no width worth that. */}
      <p className="text-xs font-semibold text-navy-900 break-words">{value || '—'}</p>
      {sub && <p className="text-[10px] text-navy-700 break-words">{sub}</p>}
    </div>
  );
}

/** When this pass stops working. `qr_expires_at` is the authority (migrations
 *  071/073 set it to the end of the departure day); a row written before that
 *  falls back to the approver's stated departure, then to the IST day end of
 *  the visit's own moment — the same ladder `CheckInBadgeRail` climbs. */
function passValidUntil(visit: Visit): string {
  const iso = visit.qr_expires_at ?? visit.expected_departure
    ?? istDayEnd(new Date(visit.scheduled_for ?? visit.created_at)).toISOString();
  return formatDateTime(iso);
}

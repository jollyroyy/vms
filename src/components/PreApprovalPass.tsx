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
import { formatDateTime } from '../lib/formatDate';
import { STATUS_STYLES } from '../lib/statusStyles';
import PassIdentity from './PassIdentity';

type Props = {
  visit: Visit;
  /** Forwarded to PassIdentity. Defaults to true; VisitorDetails turns it off
   * for an HOD viewer, who approves on who/why and never checks the ID itself. */
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
          <p className="text-[10px] font-bold text-navy-500 dark:text-navy-400 uppercase tracking-wide">Entry Pass</p>
          <p className="text-xs text-navy-500 font-mono">{visit.ref_number}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </span>
      </div>

      {/* Visitor identity block. The QR itself carries only an opaque token —
          never the visitor's name, ID or photo. This block is what a *human*
          checks the pass against; scanning it is what pulls the same details
          out of the database. */}
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

      {/* Who they're here for, and how long the pass is good for — grouped
          apart from identity so a guard scanning down the card finds each
          fact in its own labelled block, not one undifferentiated list. */}
      <div className="w-full max-w-xs grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-surface-50 dark:bg-white/[0.04] px-3 py-2.5">
        <PassField label="Person to Meet" value={visit.host?.full_name} sub={visit.department?.name} />
        <PassField label="Valid For" value={formatDateTime(visit.scheduled_for ?? visit.created_at)} />
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
      <p className="text-[10px] text-navy-300 text-center">
        Send the image if the guard will upload it — the PDF is for printing.
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
      <p className="text-[9px] text-navy-500 dark:text-navy-400 uppercase tracking-wider font-semibold leading-none mb-1">{label}</p>
      <p className="text-xs font-semibold text-navy-800 truncate">{value || '—'}</p>
      {sub && <p className="text-[10px] text-navy-500 dark:text-navy-400 truncate">{sub}</p>}
    </div>
  );
}

// Generates a downloadable PDF of a visitor's entry-pass QR — lets an HOD
// hand the pass to a visitor who has no email or way to view the on-screen
// preview (e.g. printing it, or forwarding a file over WhatsApp).
// The pass includes the visitor's photo (if provided) and their redacted ID proof
// next to the QR code. ID is redacted because full ID numbers are never stored
// (NFR-05 / Aadhaar Act).
//
// Async because the photo has to be re-encoded before jsPDF will take it — see
// passPhoto.ts for why. The QR itself is already a PNG data URL and goes
// straight in.
import { jsPDF } from 'jspdf';
import type { Visit } from '../types/index';
import { maskIdProof } from './pii';
import { toPdfSafeImage } from './passPhoto';

const PAGE_WIDTH = 320;
const CENTER_X = PAGE_WIDTH / 2;

// Vertical space the photo occupies, including the gap below it. Everything
// under the header shifts down by this much when a photo is present.
const PHOTO_BLOCK = 84;
const PHOTO_TOP = 72;
const PHOTO_W = 60;
const PHOTO_H = 72;

/**
 * Builds and triggers a browser download of a one-page PDF pass for `visit`.
 * `qrDataUrl` must already be a resolved PNG data URL. `photoSource` may be a
 * data URL or a remote (signed) URL in any browser-decodable format; it is
 * re-encoded to PNG first, and silently omitted if that fails.
 */
export async function downloadQrPassPdf(
  visit: Visit,
  qrDataUrl: string,
  photoSource?: string | null,
): Promise<void> {
  // Resolved before the document is created so a failed photo simply means a
  // shorter page, rather than a gap where the photo should have been.
  const photo = photoSource ? await toPdfSafeImage(photoSource) : null;
  const photoBlock = photo ? PHOTO_BLOCK : 0;

  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, 420 + photoBlock] });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Visitor Entry Pass', CENTER_X, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(visit.ref_number, CENTER_X, 58, { align: 'center' });

  if (photo) {
    // Below the ref number (baseline y=58), not above it — drawing at y=20
    // put the portrait straight through the title.
    try {
      doc.addImage(photo, 'PNG', CENTER_X - PHOTO_W / 2, PHOTO_TOP, PHOTO_W, PHOTO_H);
    } catch {
      // A corrupt photo must never block the pass generation.
    }
  }

  doc.addImage(qrDataUrl, 'PNG', CENTER_X - 80, 80 + photoBlock, 160, 160);

  doc.setFontSize(11);
  doc.text(`Visitor: ${visit.visitor?.full_name ?? '—'}`, CENTER_X, 262 + photoBlock, { align: 'center' });
  doc.text(`Department: ${visit.department?.name ?? '—'}`, CENTER_X, 280 + photoBlock, { align: 'center' });
  doc.text(`ID Proof: ${maskIdProof(visit.visitor?.id_type, visit.visitor?.id_last4)}`, CENTER_X, 298 + photoBlock, { align: 'center' });
  if (visit.scheduled_for) {
    const when = new Date(visit.scheduled_for).toLocaleString('en-IN');
    doc.text(`Scheduled: ${when}`, CENTER_X, 316 + photoBlock, { align: 'center' });
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Scan this at the guard console to check in', CENTER_X, 353 + photoBlock, { align: 'center' });

  doc.save(`entry-pass-${visit.ref_number}.pdf`);
}

// Generates a downloadable PDF of a visitor's entry-pass QR — lets an HOD
// hand the pass to a visitor who has no email or way to view the on-screen
// preview (e.g. printing it, or forwarding a file over WhatsApp).
// The pass includes the visitor's photo (if provided) and their redacted ID proof
// next to the QR code. ID is redacted because full ID numbers are never stored
// (NFR-05 / Aadhaar Act).
import { jsPDF } from 'jspdf';
import type { Visit } from '../types/index';
import { maskIdProof } from './pii';

const PAGE_WIDTH = 320;
const CENTER_X = PAGE_WIDTH / 2;

/** Builds and triggers a browser download of a one-page PDF pass for `visit`. `qrDataUrl` must already be a resolved PNG data URL. Optional `photoDataUrl` adds a portrait photo above the QR. */
export function downloadQrPassPdf(visit: Visit, qrDataUrl: string, photoDataUrl?: string | null): void {
  const photoBlock = photoDataUrl ? 84 : 0;
  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, 420 + photoBlock] });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Visitor Entry Pass', CENTER_X, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(visit.ref_number, CENTER_X, 58, { align: 'center' });

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', CENTER_X - 30, 20, 60, 72);
    } catch {
      // A corrupt photo must never block the pass generation
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

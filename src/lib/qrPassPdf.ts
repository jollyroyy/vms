// Generates a downloadable PDF of a visitor's entry-pass QR — lets an HOD
// hand the pass to a visitor who has no email or way to view the on-screen
// preview (e.g. printing it, or forwarding a file over WhatsApp).
import { jsPDF } from 'jspdf';
import type { Visit } from '../types/index';

const PAGE_WIDTH = 320;
const CENTER_X = PAGE_WIDTH / 2;

/** Builds and triggers a browser download of a one-page PDF pass for `visit`. `qrDataUrl` must already be a resolved PNG data URL. */
export function downloadQrPassPdf(visit: Visit, qrDataUrl: string): void {
  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, 420] });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Visitor Entry Pass', CENTER_X, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(visit.ref_number, CENTER_X, 58, { align: 'center' });

  doc.addImage(qrDataUrl, 'PNG', CENTER_X - 80, 80, 160, 160);

  doc.setFontSize(11);
  doc.text(`Visitor: ${visit.visitor?.full_name ?? '—'}`, CENTER_X, 262, { align: 'center' });
  doc.text(`Department: ${visit.department?.name ?? '—'}`, CENTER_X, 280, { align: 'center' });
  if (visit.scheduled_for) {
    const when = new Date(visit.scheduled_for).toLocaleString('en-IN');
    doc.text(`Scheduled: ${when}`, CENTER_X, 298, { align: 'center' });
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Scan this at the guard console to check in', CENTER_X, 335, { align: 'center' });

  doc.save(`entry-pass-${visit.ref_number}.pdf`);
}

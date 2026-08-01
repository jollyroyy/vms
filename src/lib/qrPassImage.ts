// Downloads a visitor's entry-pass QR as a plain PNG.
//
// This is the file a guard can actually upload at the gate: the guard console's
// "Upload QR Image" runs qr-scanner's scanImage, which decodes images only — a
// PDF is neither selectable under accept="image/*" nor decodable if forced
// through. downloadQrPassPdf stays for printing and handing over a paper pass;
// this one is for anything that ends up back in front of a scanner.
//
// The data URL is saved byte-for-byte as produced by QRCode.toDataURL — no
// re-encode, no resize, no recompression, so the quiet zone and module edges
// survive intact and the code stays readable after a WhatsApp round trip.
import type { Visit } from '../types/index';

/** Triggers a browser download of `qrDataUrl` as `entry-pass-<ref>.png`. `qrDataUrl` must already be a resolved PNG data URL. */
export function downloadQrPassPng(visit: Visit, qrDataUrl: string): void {
  const link = document.createElement('a');
  link.href = qrDataUrl;
  link.download = `entry-pass-${visit.ref_number}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

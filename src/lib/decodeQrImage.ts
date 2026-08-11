// Decodes a QR code from a static image — the fallback when a guard's camera
// can't get a clean read off a printed or on-screen pass (glare, focus,
// distance all defeat the live scanner on a photo held up to the lens).
// Loads qr-scanner lazily, same as useQrScanner, so the decode worker/WASM
// payload stays out of the bundle unless this path actually runs.
//
// The result is deliberately a discriminated union rather than `string | null`.
// Collapsing "this image has no QR code in it" and "the decoder itself is
// broken" into one null cost us a long debugging session: a CSP that blocked
// qr-scanner's blob: worker made every decode fail, and the guard was told the
// visitor's perfectly good pass was unreadable. Those two cases must never be
// indistinguishable again.
import type QrScannerType from 'qr-scanner';

export type QrImageDecode =
  | { ok: true; payload: string }
  /** `no_code`: image decoded fine, held no QR. `engine`: the decoder failed to run. */
  | { ok: false; reason: 'no_code' | 'engine'; detail: string };

// qr-scanner rejects with the bare string `QrScanner.NO_QR_CODE_FOUND` on a
// genuine miss; anything else (worker blocked or crashed, image failed to load,
// 10s decode timeout) arrives as some other value and is an engine fault.
const NO_QR_CODE_FOUND = 'No QR code found';

function describe(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** Decodes the QR payload in `file`. Never throws — failures come back as `ok: false`. */
export async function decodeQrImage(file: File): Promise<QrImageDecode> {
  try {
    const { default: QrScanner } = await import('qr-scanner');
    const result = await (QrScanner as typeof QrScannerType).scanImage(file, {
      alsoTryWithoutScanRegion: true,
    });
    return { ok: true, payload: result.data };
  } catch (err) {
    const detail = describe(err);
    if (detail === NO_QR_CODE_FOUND) {
      return { ok: false, reason: 'no_code', detail };
    }
    // Loud on purpose. An engine fault is an app bug, not a bad photo, and the
    // only reason it ever reached production silently is that it was swallowed.
    console.error('[decodeQrImage] QR decoder failed:', detail);
    return { ok: false, reason: 'engine', detail };
  }
}

// HODs hand visitors a PDF pass (src/lib/qrPassPdf.ts), so "upload the pass"
// must accept a PDF as well as a photo of one. Rendering a PDF page is a
// different failure surface than decoding a QR (a corrupt PDF, a missing
// worker, a pdfjs bug), and none of that is the guard's fault the way a bad
// photo is — so a render failure is reported as our own 'engine' fault, same
// bucket as a broken decoder, never folded into "bad image". Import
// pdfQrPage lazily so pdfjs never loads on the (overwhelmingly common) plain
// image path.
export async function decodeQrFile(file: File): Promise<QrImageDecode> {
  const { isPdfFile, renderPdfFirstPage } = await import('./pdfQrPage');
  if (!isPdfFile(file)) {
    return decodeQrImage(file);
  }
  const rendered = await renderPdfFirstPage(file);
  if (!rendered.ok) {
    return { ok: false, reason: 'engine', detail: rendered.detail };
  }
  const page = new File([rendered.blob], 'pass-page-1.png', { type: 'image/png' });
  return decodeQrImage(page);
}

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

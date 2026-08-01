// On-device OCR: PaddleOCR (Apache-2.0) compiled to WebAssembly, running on the
// guard's own machine. No API key, no per-scan cost, and the ID image never
// leaves the device.
//
// Both the model weights and the WASM runtime are served from our own origin —
// see public/models/ocr/ and scripts/sync-ort-assets.mjs. That is not an
// optimisation: our CSP allows 'self' and Supabase only, so the library's
// default GitHub/CDN URLs would be blocked, and the failure surfaces as an
// opaque load error that says nothing about CSP.
import { env as ortEnv } from 'onnxruntime-web';
import type { ImageSource, OcrEngine, OcrLine, OcrResult } from './types';
import { toArrayBuffer } from './imageSource';

/** Served from public/. Keep in step with scripts/sync-ort-assets.mjs. */
const ORT_WASM_PATH = '/ort/';

/** Served from public/models/ocr/. PP-OCRv5 English mobile: the Latin fields are
 *  the ones we parse, and the mobile weights are a third the size of the server
 *  ones for a small accuracy cost on a document held still against a lens. */
const MODEL_PATHS = {
  detection: '/models/ocr/det.ort',
  recognition: '/models/ocr/rec.ort',
  charactersDictionary: '/models/ocr/dict.txt',
} as const;

export async function createOcrEngine(): Promise<OcrEngine> {
  // Must be set before any session is created, or ORT has already resolved its
  // runtime location and will not look again.
  ortEnv.wasm.wasmPaths = ORT_WASM_PATH;
  // We do not enable cross-origin isolation (COOP/COEP would break loading
  // Supabase images), so SharedArrayBuffer is unavailable and threads must be 1.
  // Saying so explicitly beats letting ORT probe and warn.
  ortEnv.wasm.numThreads = 1;

  const { PaddleOcrService } = await import('ppu-paddle-ocr/web');
  const service = new PaddleOcrService({ model: { ...MODEL_PATHS } });
  await service.initialize();

  return {
    async recognise(image: ImageSource): Promise<OcrResult> {
      const buffer = await toArrayBuffer(image);
      const result = await service.recognize(buffer, { flatten: true });

      const lines: OcrLine[] = result.results.map((r) => ({
        text: r.text,
        confidence: r.confidence,
      }));

      return {
        lines,
        // Join on newline rather than reusing result.text, which is
        // space-separated. The ID parsers key off line structure — a date and
        // the label above it must not merge into one string.
        fullText: lines.map((l) => l.text).join('\n'),
      };
    },
  };
}

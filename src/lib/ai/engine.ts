// getEngine() — the one place in the codebase that decides WHICH inference
// implementation runs. Everything else depends on the interfaces in ./types.
//
// Today: browser WebAssembly, on the guard's own machine. Nothing leaves the
// device, and there is no API key, no per-scan cost and no third-party service
// in the path.
//
// To move inference to a server later (PRODUCTION-GOTCHAS.md GOTCHA-4), add a
// second AiEngine here and choose between them. Do not scatter that decision
// across screens — the moment two places know how to reach a model, they drift.
import type { AiEngine, FaceEngine, OcrEngine } from './types';

/** Cached per engine, so the tens of megabytes of weights load at most once per
 *  page load however many times a screen is opened and closed. */
let ocrPromise: Promise<OcrEngine> | null = null;
let facePromise: Promise<FaceEngine> | null = null;

const browserEngine: AiEngine = {
  id: 'browser-wasm',

  ocr() {
    // Dynamic import, matching src/lib/useQrScanner.ts: keeps the engine and its
    // WASM payload out of the main bundle entirely, so a guard who never opens
    // a scan screen never downloads any of it.
    if (!ocrPromise) {
      ocrPromise = import('./ocrEngine')
        .then((m) => m.createOcrEngine())
        // Don't cache a failure — a transient network error while fetching
        // weights must not permanently disable OCR for the rest of the session.
        .catch((err) => { ocrPromise = null; throw err; });
    }
    return ocrPromise;
  },

  face() {
    if (!facePromise) {
      facePromise = import('./faceEngine')
        .then((m) => m.createFaceEngine())
        .catch((err) => { facePromise = null; throw err; });
    }
    return facePromise;
  },
};

export function getEngine(): AiEngine {
  return browserEngine;
}

/** Test seam: drop cached engines so a suite can swap module mocks between cases. */
export function resetEngineCache(): void {
  ocrPromise = null;
  facePromise = null;
}

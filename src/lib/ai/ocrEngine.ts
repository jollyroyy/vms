// On-device OCR. Implemented in Phase 1; this is the module boundary it must
// fill, created now so ./engine.ts compiles and so the shape is fixed before
// anyone writes against it.
//
// Phase 1 replaces the body with PaddleOCR-WASM (Apache-2.0), loading its
// weights through ./modelLoader. The exported factory signature must not change.
import type { OcrEngine } from './types';

export function createOcrEngine(): Promise<OcrEngine> {
  return Promise.reject(
    new Error('OCR engine not implemented yet (Phase 1). Set VITE_FEATURE_OCR=false.'),
  );
}

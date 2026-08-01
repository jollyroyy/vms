// On-device face detection and embedding. Implemented in Phases 2-3; this is
// the module boundary it must fill, created now so ./engine.ts compiles.
//
// Phase 2 fills detect() with MediaPipe Face Landmarker (Apache-2.0).
// Phase 3 fills embed() with an ONNX face-recognition model run through
// onnxruntime-web.
//
// GOTCHA-1: whichever weights are chosen, record the licence verbatim in
// public/models/LICENSES.md. The research-only InsightFace weights are fine for
// this MVP and must be swapped before the product is sold. This file is the
// only place that has to change.
import type { FaceEngine } from './types';

export function createFaceEngine(): Promise<FaceEngine> {
  return Promise.reject(
    new Error('Face engine not implemented yet (Phase 2). Set VITE_FEATURE_FACE_VERIFY=false.'),
  );
}

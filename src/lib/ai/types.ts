// The contract between the app and whatever performs on-device inference.
//
// Nothing outside src/lib/ai/ may import a model library directly. Screens talk
// to these interfaces only. That is what makes the engine swappable: today it is
// WebAssembly running on the guard's own machine; tomorrow it could be a server,
// or a differently-licensed model, and not one screen changes.
//
// See PRODUCTION-GOTCHAS.md GOTCHA-1 and GOTCHA-4 — both are cheap to fix
// precisely because this file exists.

/** Anything the engines can read pixels from. Video elements are accepted so a
 *  live preview can be analysed frame-by-frame without encoding a Blob each time. */
export type ImageSource = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | Blob;

// ---------------------------------------------------------------- OCR

export type OcrLine = {
  text: string;
  /** 0..1. Engines that cannot report per-line confidence must return 0, never a guess. */
  confidence: number;
};

export type OcrResult = {
  lines: OcrLine[];
  /** All lines joined by newline — the input to src/lib/ai/idParser.ts. */
  fullText: string;
};

export interface OcrEngine {
  recognise(image: ImageSource): Promise<OcrResult>;
}

// ---------------------------------------------------------------- Face

export type FaceBox = { x: number; y: number; width: number; height: number };

/** Normalised 0..1 coordinates, so consumers never need to know the source
 *  resolution. A raw pixel box would silently break the moment a different
 *  camera resolution is negotiated. */
export type FacePoint = { x: number; y: number };

export type FaceDetection = {
  box: FaceBox;
  /** Landmark points, when the engine provides them. Liveness needs these;
   *  plain detection does not, so they are optional by design. */
  landmarks?: FacePoint[];
  /** 0..1 detector confidence. */
  score: number;
};

export type FaceEmbedding = {
  /** The face as numbers. Length must equal `dimensions`. */
  vector: Float32Array;
  dimensions: number;
  /** Which model produced it. Embeddings from different models are NOT
   *  comparable — mixing them silently produces meaningless similarity scores,
   *  so every stored template records this and comparisons must check it. */
  modelVersion: string;
};

export interface FaceEngine {
  detect(image: ImageSource): Promise<FaceDetection[]>;
  /** Assumes a single, roughly-centred face. Callers should detect() first. */
  embed(image: ImageSource): Promise<FaceEmbedding>;
}

// ---------------------------------------------------------------- Engine

/**
 * The single swap point. `id` is recorded in audit rows so a score can always be
 * traced back to the implementation that produced it.
 *
 * Both getters are async and lazy: the model files are tens of megabytes and
 * must not be fetched until a guard actually opens a feature that needs them.
 */
export interface AiEngine {
  readonly id: string;
  ocr(): Promise<OcrEngine>;
  face(): Promise<FaceEngine>;
}

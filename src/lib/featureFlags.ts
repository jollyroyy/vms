// Feature flags for optional AI/automation features (QR, OCR, face verify,
// AI recommendation). Read from Vite env vars, NOT the database: an env-var
// flag needs no migration, so "everything off" is provably identical to
// today's behaviour even against a database that has not been migrated yet.
// Fail-closed: anything other than the exact string 'true' is off, so a typo
// in a .env file can never silently enable an unfinished feature in front of
// a guard.
export type FeatureFlag = 'qr' | 'ocr' | 'faceVerify' | 'aiRecommendation';

// Direct lookup map, not a fuzzy includes() chain — the compiler enforces
// exhaustiveness whenever a new FeatureFlag is added.
//
// Each entry must spell out `import.meta.env.VITE_...` in full, and the reads
// are thunks rather than values for two separate reasons:
//
//  * Vite decides whether a module gets an `import.meta.env` object at all by
//    scanning its source for that literal text. A computed key lookup — and
//    especially a defensive-looking one guarded with optional chaining — never
//    matches the probe, so Vite injects nothing and every flag silently reads
//    undefined in the browser. Unit tests do not catch it, because Vitest
//    populates import.meta.env unconditionally.
//  * Reading inside a thunk keeps the lookup at call time, so tests can stub the
//    environment after this module has been imported.
const FLAG_ENV_VALUE: Record<FeatureFlag, () => unknown> = {
  qr: () => import.meta.env.VITE_FEATURE_QR,
  ocr: () => import.meta.env.VITE_FEATURE_OCR,
  faceVerify: () => import.meta.env.VITE_FEATURE_FACE_VERIFY,
  aiRecommendation: () => import.meta.env.VITE_FEATURE_AI_RECOMMENDATION,
};

/** Returns true only when the flag's env var is the exact string 'true' (case-insensitive, trimmed). Defaults to false. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const raw = FLAG_ENV_VALUE[flag]();
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'true';
}

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
const FLAG_ENV_VAR: Record<FeatureFlag, string> = {
  qr: 'VITE_FEATURE_QR',
  ocr: 'VITE_FEATURE_OCR',
  faceVerify: 'VITE_FEATURE_FACE_VERIFY',
  aiRecommendation: 'VITE_FEATURE_AI_RECOMMENDATION',
};

/** Returns true only when the flag's env var is the exact string 'true' (case-insensitive, trimmed). Defaults to false. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envVar = FLAG_ENV_VAR[flag];
  const raw = import.meta?.env?.[envVar];
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'true';
}

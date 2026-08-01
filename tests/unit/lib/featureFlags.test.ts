import { describe, it, expect, vi, afterEach } from 'vitest';
import { isFeatureEnabled } from '../../../src/lib/featureFlags';

describe('M-FEATURE-FLAGS: isFeatureEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false for qr when VITE_FEATURE_QR is unset', () => {
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('returns false for ocr when VITE_FEATURE_OCR is unset', () => {
    expect(isFeatureEnabled('ocr')).toBe(false);
  });

  it('returns false for faceVerify when VITE_FEATURE_FACE_VERIFY is unset', () => {
    expect(isFeatureEnabled('faceVerify')).toBe(false);
  });

  it('returns false for aiRecommendation when VITE_FEATURE_AI_RECOMMENDATION is unset', () => {
    expect(isFeatureEnabled('aiRecommendation')).toBe(false);
  });

  it('returns true only for the exact string "true"', () => {
    vi.stubEnv('VITE_FEATURE_QR', 'true');
    expect(isFeatureEnabled('qr')).toBe(true);
  });

  it('returns true for "TRUE" (case-insensitive)', () => {
    vi.stubEnv('VITE_FEATURE_OCR', 'TRUE');
    expect(isFeatureEnabled('ocr')).toBe(true);
  });

  it('returns true for " true " (trimmed)', () => {
    vi.stubEnv('VITE_FEATURE_FACE_VERIFY', ' true ');
    expect(isFeatureEnabled('faceVerify')).toBe(true);
  });

  it('returns false for "false"', () => {
    vi.stubEnv('VITE_FEATURE_QR', 'false');
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('returns false for "0"', () => {
    vi.stubEnv('VITE_FEATURE_QR', '0');
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('returns false for "no"', () => {
    vi.stubEnv('VITE_FEATURE_QR', 'no');
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('returns false for an empty string', () => {
    vi.stubEnv('VITE_FEATURE_QR', '');
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('returns false for a garbage value', () => {
    vi.stubEnv('VITE_FEATURE_QR', 'asdf123');
    expect(isFeatureEnabled('qr')).toBe(false);
  });

  it('enabling one flag does not enable any other flag', () => {
    vi.stubEnv('VITE_FEATURE_QR', 'true');
    expect(isFeatureEnabled('qr')).toBe(true);
    expect(isFeatureEnabled('ocr')).toBe(false);
    expect(isFeatureEnabled('faceVerify')).toBe(false);
    expect(isFeatureEnabled('aiRecommendation')).toBe(false);
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFeatureEnabled } from '../../../src/lib/featureFlags';

describe('M-FEATURE-FLAGS: isFeatureEnabled', () => {
  // Vitest loads the project's real .env, so "unset" has to be stated rather
  // than assumed — otherwise these cases only pass while the developer's own
  // .env happens to leave the flag off, and flip to failing the moment someone
  // turns a feature on locally.
  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_OCR', undefined);
    vi.stubEnv('VITE_FEATURE_FACE_VERIFY', undefined);
    vi.stubEnv('VITE_FEATURE_AI_RECOMMENDATION', undefined);
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('returns false for deviceReg when VITE_FEATURE_DEVICE_REG is unset', () => {
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  it('returns true only for the exact string "true"', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', 'true');
    expect(isFeatureEnabled('deviceReg')).toBe(true);
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
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', 'false');
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  it('returns false for "0"', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', '0');
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  it('returns false for "no"', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', 'no');
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  it('returns false for an empty string', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', '');
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  it('returns false for a garbage value', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', 'asdf123');
    expect(isFeatureEnabled('deviceReg')).toBe(false);
  });

  // Vitest populates import.meta.env unconditionally, so no amount of stubbing
  // above can catch the one failure mode that actually shipped: Vite decides
  // whether to inject import.meta.env into a module by scanning the source for
  // the literal text 'import.meta.env'. Written as 'import.meta?.env' the probe
  // never matches, Vite injects nothing, and every flag reads undefined in a
  // real browser while all the tests above still pass. Assert on the source.
  it('reads import.meta.env literally so Vite injects the env object', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/featureFlags.ts'), 'utf8');
    expect(src).not.toMatch(/import\.meta\s*\?\./);
    expect(src).toContain('import.meta.env.VITE_FEATURE_OCR');
    expect(src).toContain('import.meta.env.VITE_FEATURE_FACE_VERIFY');
    expect(src).toContain('import.meta.env.VITE_FEATURE_AI_RECOMMENDATION');
    expect(src).toContain('import.meta.env.VITE_FEATURE_DEVICE_REG');
  });

  it('enabling one flag does not enable any other flag', () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_REG', 'true');
    expect(isFeatureEnabled('deviceReg')).toBe(true);
    expect(isFeatureEnabled('ocr')).toBe(false);
    expect(isFeatureEnabled('faceVerify')).toBe(false);
    expect(isFeatureEnabled('aiRecommendation')).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lastFourOf, maskIdNumber, isRedactionEnabled, redactForStorage } from '../../../../src/lib/ai/redact';

describe('M-AI-REDACT: lastFourOf', () => {
  it('returns the last 4 characters of a 12-digit Aadhaar', () => {
    expect(lastFourOf('2345 6789 0123')).toBe('0123');
  });

  it('strips non-alphanumeric characters before extracting last 4', () => {
    expect(lastFourOf('XXXX-XX-XX-9012')).toBe('9012');
  });

  it('returns fewer than 4 chars when input is shorter', () => {
    expect(lastFourOf('AB12')).toBe('AB12');
  });

  it('returns the whole stripped string when shorter than 4', () => {
    expect(lastFourOf('A1B')).toBe('A1B');
  });

  it('handles empty string', () => {
    expect(lastFourOf('')).toBe('');
  });

  it('handles input with no alphanumeric characters', () => {
    expect(lastFourOf('---- ....')).toBe('');
  });
});

describe('M-AI-REDACT: maskIdNumber', () => {
  it('masks an Aadhaar, keeping last 4 and preserving spacing', () => {
    expect(maskIdNumber('2345 6789 0123')).toBe('XXXX XXXX 0123');
  });

  it('masks an Aadhaar without spaces', () => {
    expect(maskIdNumber('234567890123')).toBe('XXXXXXXX0123');
  });

  it('masks a PAN, keeping last 4 alphanumeric and preserving format', () => {
    // ABCDE1234F = 10 alphanumeric chars; last 4 are '234F', first 6 are masked
    expect(maskIdNumber('ABCDE1234F')).toBe('XXXXXX234F');
  });

  it('masks a Passport, keeping last 4 alphanumeric', () => {
    // A1234567 = 8 alphanumeric chars; last 4 are '4567'
    expect(maskIdNumber('A1234567')).toBe('XXXX4567');
  });

  it('counts only alphanumeric chars for the keep-window, preserving non-alnum', () => {
    // AA-1234-XX: alnum = A,A,1,2,3,4,X,X = 8; last 4 alnum = 3,4,X,X at indices 4-7
    expect(maskIdNumber('AA-1234-XX')).toBe('XX-XX34-XX');
  });

  it('handles a 4-character input (all kept)', () => {
    expect(maskIdNumber('AB12')).toBe('AB12');
  });

  it('handles empty string', () => {
    expect(maskIdNumber('')).toBe('');
  });
});

describe('M-AI-REDACT: isRedactionEnabled', () => {
  const original = import.meta.env.VITE_ID_REDACTION;

  beforeEach(() => {
    vi.stubEnv('VITE_ID_REDACTION', undefined);
  });
  afterEach(() => {
    vi.stubEnv('VITE_ID_REDACTION', original);
  });

  it('returns false when VITE_ID_REDACTION is unset', () => {
    vi.stubEnv('VITE_ID_REDACTION', undefined);
    expect(isRedactionEnabled()).toBe(false);
  });

  it('returns false for the string "false"', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'false');
    expect(isRedactionEnabled()).toBe(false);
  });

  it('returns true only for the exact string "true" (case-insensitive, trimmed)', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'true');
    expect(isRedactionEnabled()).toBe(true);
  });

  it('returns true for "TRUE" (case-insensitive)', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'TRUE');
    expect(isRedactionEnabled()).toBe(true);
  });

  it('returns true for " true " (trimmed)', () => {
    vi.stubEnv('VITE_ID_REDACTION', ' true ');
    expect(isRedactionEnabled()).toBe(true);
  });

  it('returns false for "0"', () => {
    vi.stubEnv('VITE_ID_REDACTION', '0');
    expect(isRedactionEnabled()).toBe(false);
  });

  it('returns false for an empty string', () => {
    vi.stubEnv('VITE_ID_REDACTION', '');
    expect(isRedactionEnabled()).toBe(false);
  });

  it('returns false for garbage', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'asdf');
    expect(isRedactionEnabled()).toBe(false);
  });

  it('fail-closed: a typo that is not "true" means off', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'ture');
    expect(isRedactionEnabled()).toBe(false);
  });
});

describe('M-AI-REDACT: redactForStorage', () => {
  const original = import.meta.env.VITE_ID_REDACTION;

  beforeEach(() => {
    vi.stubEnv('VITE_ID_REDACTION', undefined);
  });
  afterEach(() => {
    vi.stubEnv('VITE_ID_REDACTION', original);
  });

  it('returns the full unmasked number when redaction is OFF (MVP escape hatch)', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'false');
    expect(redactForStorage('2345 6789 0123')).toBe('2345 6789 0123');
  });

  it('returns only last 4 when redaction is ON', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'true');
    expect(redactForStorage('2345 6789 0123')).toBe('0123');
  });

  it('returns only last 4 for a PAN when redaction is ON', () => {
    vi.stubEnv('VITE_ID_REDACTION', 'true');
    expect(redactForStorage('ABCDE1234F')).toBe('1234F'.slice(-4));
  });

  it('fail-closed: a typo in the flag leaves the MVP escape hatch ON', () => {
    // "ture" is not "true", so redaction is OFF and the full number is returned.
    // This is the deliberate MVP behaviour: the flag must be explicitly set to
    // 'true' to mask; a typo can never silently *enable* masking in a way that
    // surprises a developer — it can only ever leave the escape hatch on.
    vi.stubEnv('VITE_ID_REDACTION', 'ture');
    expect(redactForStorage('2345 6789 0123')).toBe('2345 6789 0123');
  });
});

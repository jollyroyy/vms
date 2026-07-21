// CHECK for goal.md S7 (🎯) — FR ref: FR-VIS-02 (blacklist), FR-VIS-03 (repeat-visitor recall)
// Both features key off a normalized phone number.
import { describe, it, expect } from 'vitest';
import { normalizePhone, isBlacklisted } from '../../src/lib/blacklist';

describe('S7: phone normalization (recall + blacklist both depend on it)', () => {
  it('strips spaces, dashes, and parentheses', () => {
    expect(normalizePhone('98765 43210')).toBe('9876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
  });

  it('normalizes country-code variants to the same key', () => {
    expect(normalizePhone('+91 9876543210')).toBe(normalizePhone('9876543210'));
    expect(normalizePhone('09876543210')).toBe(normalizePhone('9876543210'));
  });

  it('rejects inputs that cannot be a phone number', () => {
    expect(() => normalizePhone('abc')).toThrow();
    expect(() => normalizePhone('12')).toThrow();
  });
});

describe('S7/FR-VIS-02: blacklist matching', () => {
  const list = [{ phone: normalizePhone('+91 98765 43210'), reason: 'Prior incident' }];

  it('matches regardless of how the guard types the number', () => {
    expect(isBlacklisted('9876543210', list)?.reason).toBe('Prior incident');
    expect(isBlacklisted('+919876543210', list)?.reason).toBe('Prior incident');
  });

  it('returns null for non-blacklisted numbers — no false alarms at the gate', () => {
    expect(isBlacklisted('9000000000', list)).toBeNull();
  });
});

describe('M5-BLACK: edge cases', () => {
  it('handles phone with dots and slashes', () => {
    expect(normalizePhone('987.654.3210')).toBe('9876543210');
    expect(normalizePhone('987/654/3210')).toBe('9876543210');
  });

  it('handles US country code (+1) - keeps leading 1 as not in Indian format', () => {
    expect(normalizePhone('+1 9876543210')).toBe('19876543210');
  });

  it('rejects empty string', () => {
    expect(() => normalizePhone('')).toThrow();
  });

  it('accepts exactly 7 digits as minimum valid phone', () => {
    expect(normalizePhone('1234567')).toBe('1234567');
  });

  it('handles a very long phone number (unknown country code preserved)', () => {
    const result = normalizePhone('+999 123456789012345');
    expect(result).toBe('999123456789012345');
  });

  it('isBlacklisted with empty list returns null for any number', () => {
    expect(isBlacklisted('9876543210', [])).toBeNull();
  });

  it('isBlacklisted matches first entry when multiple entries exist', () => {
    const multi = [
      { phone: '1111111111', reason: 'Reason A' },
      { phone: '2222222222', reason: 'Reason B' },
    ];
    expect(isBlacklisted('2222222222', multi)?.reason).toBe('Reason B');
  });

  it('normalizePhone preserves 10 digit plain number', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });
});

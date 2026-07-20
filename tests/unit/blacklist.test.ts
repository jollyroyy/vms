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

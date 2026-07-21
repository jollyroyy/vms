// CHECK for goal.md S3 (🎯) — FR ref: NFR-07, PRD §3.4/§4.3
// Auto ref numbers: VIS-YYYYMMDD-NNNN / GP-IN|OUT-YYYYMMDD-NNNN, daily reset, zero-padded.
import { describe, it, expect } from 'vitest';
import { formatRefNumber, nextSequence } from '../../src/lib/refNumber';

describe('S3: reference number generation', () => {
  const jul20 = new Date('2026-07-20T10:30:00Z');

  it('formats visitor refs as VIS-YYYYMMDD-NNNN', () => {
    expect(formatRefNumber('VIS', jul20, 1)).toBe('VIS-20260720-0001');
    expect(formatRefNumber('VIS', jul20, 42)).toBe('VIS-20260720-0042');
  });

  it('formats gate pass refs with direction prefix', () => {
    expect(formatRefNumber('GP-IN', jul20, 7)).toBe('GP-IN-20260720-0007');
    expect(formatRefNumber('GP-OUT', jul20, 7)).toBe('GP-OUT-20260720-0007');
  });

  it('zero-pads to 4 digits and supports overflow beyond 9999', () => {
    expect(formatRefNumber('VIS', jul20, 999)).toBe('VIS-20260720-0999');
    expect(formatRefNumber('VIS', jul20, 12345)).toBe('VIS-20260720-12345');
  });

  it('sequence continues within the same day', () => {
    expect(nextSequence('VIS-20260720-0009', jul20)).toBe(10);
  });

  it('sequence resets to 1 on a new day', () => {
    const jul21 = new Date('2026-07-21T00:00:05Z');
    expect(nextSequence('VIS-20260720-0134', jul21)).toBe(1);
  });

  it('sequence starts at 1 when there is no previous ref', () => {
    expect(nextSequence(null, jul20)).toBe(1);
  });

  it('rejects malformed previous refs instead of guessing', () => {
    expect(() => nextSequence('garbage-ref', jul20)).toThrow();
  });

  it('rejects seq=0 (refs must be positive)', () => {
    expect(() => formatRefNumber('VIS', jul20, 0)).toThrow();
  });

  it('rejects negative seq', () => {
    expect(() => formatRefNumber('VIS', jul20, -5)).toThrow();
  });

  it('GP-IN and GP-OUT use different prefixes', () => {
    const seq = 1;
    expect(formatRefNumber('GP-IN', jul20, seq)).toBe('GP-IN-20260720-0001');
    expect(formatRefNumber('GP-OUT', jul20, seq)).toBe('GP-OUT-20260720-0001');
  });

  it('parses any RefKind from a previous ref', () => {
    expect(nextSequence('GP-IN-20260720-0015', jul20)).toBe(16);
    expect(nextSequence('GP-OUT-20260720-0015', jul20)).toBe(16);
  });

  it('exact midnight boundary resets for next day', () => {
    const jul20midnight = new Date('2026-07-20T23:59:59Z');
    const jul21midnight = new Date('2026-07-21T00:00:00Z');
    expect(nextSequence('VIS-20260720-0134', jul21midnight)).toBe(1);
    expect(nextSequence('VIS-20260720-0134', jul20midnight)).toBe(135); // same day
  });

  it('overflows past 9999 with the next natural number (no truncation)', () => {
    expect(formatRefNumber('VIS', jul20, 10000)).toBe('VIS-20260720-10000');
    expect(formatRefNumber('VIS', jul20, 10001)).toBe('VIS-20260720-10001');
  });
});

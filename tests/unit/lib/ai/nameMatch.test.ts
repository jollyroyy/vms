import { describe, it, expect } from 'vitest';
import { normalizeName, namesMatch } from '../../../../src/lib/ai/nameMatch';

describe('M-AI-OCR-MATCH: namesMatch', () => {
  it('matches identical names ignoring case', () => {
    expect(namesMatch('Rahul Verma', 'rahul verma')).toBe(true);
    expect(namesMatch('RAHUL VERMA', 'Rahul Verma')).toBe(true);
  });

  it('matches ignoring surrounding and repeated whitespace', () => {
    expect(namesMatch('  Rahul   Verma ', 'Rahul Verma')).toBe(true);
  });

  it('matches when the scanned name is a word-subset (middle name omitted)', () => {
    expect(namesMatch('Rahul Verma', 'Rahul Kumar Verma')).toBe(true);
    expect(namesMatch('RAHUL KUMAR VERMA', 'Rahul Verma')).toBe(true);
  });

  it('rejects genuinely different names', () => {
    expect(namesMatch('Rahul Verma', 'Suresh Patel')).toBe(false);
    expect(namesMatch('Rahul Verma', 'Rahul Kumar')).toBe(false);
  });

  it('returns false when either side is null, empty, or all whitespace', () => {
    expect(namesMatch(null, 'Rahul Verma')).toBe(false);
    expect(namesMatch('Rahul Verma', null)).toBe(false);
    expect(namesMatch('', 'Rahul Verma')).toBe(false);
    expect(namesMatch('   ', 'Rahul Verma')).toBe(false);
  });

  it('normalizeName collapses case and whitespace deterministically', () => {
    expect(normalizeName('  RAHUL   KUMAR  ')).toBe('rahul kumar');
    expect(normalizeName('')).toBe('');
  });
});

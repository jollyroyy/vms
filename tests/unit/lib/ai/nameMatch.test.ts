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

  // Aadhaar-specific OCR artefacts (PP-OCRv5 mobile merges the tight
  // Name/Gender/YOB column into a single detected line):
  it('matches when the OCR merges a gender word onto the name line', () => {
    expect(namesMatch('RAHUL KUMAR MALE', 'Rahul Kumar')).toBe(true);
    expect(namesMatch('RAHUL KUMAR FEMALE', 'Rahul Kumar')).toBe(true);
  });

  it('matches when the OCR merges YOB/Year-of-birth text onto the name line', () => {
    expect(namesMatch('RAHUL KUMAR YOB 1998', 'Rahul Kumar')).toBe(true);
    expect(namesMatch('RAHUL KUMAR YEAR 1998', 'Rahul Kumar')).toBe(true);
  });

  it('matches despite a single-character OCR substitution', () => {
    expect(namesMatch('Rahul Kumor', 'Rahul Kumar')).toBe(true);
    expect(namesMatch('RAHULL KUMAR', 'Rahul Kumar')).toBe(true);
  });

  it('still rejects genuinely different names even under the lenient pass', () => {
    expect(namesMatch('RAJESH KUMAR', 'RAHUL KUMAR')).toBe(false);
    expect(namesMatch('RAHUL VERMA', 'RAJESH VERMA')).toBe(false);
    expect(namesMatch('A RAHUL', 'RAJESH KUMAR')).toBe(false);
  });

  it('normalizeName collapses case and whitespace deterministically', () => {
    expect(normalizeName('  RAHUL   KUMAR  ')).toBe('rahul kumar');
    expect(normalizeName('')).toBe('');
  });
});

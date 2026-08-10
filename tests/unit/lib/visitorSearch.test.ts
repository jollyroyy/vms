import { describe, it, expect } from 'vitest';
import { parseSearchQuery, SEARCH_KIND_LABEL } from '../../../src/lib/visitorSearch';

describe('parseSearchQuery', () => {
  it('returns null for an empty string', () => {
    expect(parseSearchQuery('')).toBeNull();
    expect(parseSearchQuery('   ')).toBeNull();
  });

  it('returns null for a query shorter than 2 chars', () => {
    expect(parseSearchQuery('a')).toBeNull();
    expect(parseSearchQuery(' 9 ')).toBeNull();
  });

  it('classifies a bare 10-digit number as a phone', () => {
    expect(parseSearchQuery('9876543210')).toEqual({ kind: 'phone', value: '9876543210' });
  });

  it('classifies a +91-prefixed number as a phone, normalized to 10 digits', () => {
    expect(parseSearchQuery('+919876543210')).toEqual({ kind: 'phone', value: '9876543210' });
  });

  it('classifies a leading-zero trunk number as a phone, normalized', () => {
    expect(parseSearchQuery('09876543210')).toEqual({ kind: 'phone', value: '9876543210' });
  });

  it('classifies a visit ref number in VIS-YYYYMMDD-NNNN format as ref', () => {
    expect(parseSearchQuery('VIS-20260720-0001')).toEqual({ kind: 'ref', value: 'VIS-20260720-0001' });
  });

  it('classifies a lowercase ref number and uppercases it', () => {
    expect(parseSearchQuery('vis-20260720-0001')).toEqual({ kind: 'ref', value: 'VIS-20260720-0001' });
  });

  it('classifies gate pass ref numbers as ref', () => {
    expect(parseSearchQuery('GP-IN-20260720-0007')).toEqual({ kind: 'ref', value: 'GP-IN-20260720-0007' });
    expect(parseSearchQuery('GP-OUT-20260720-0007')).toEqual({ kind: 'ref', value: 'GP-OUT-20260720-0007' });
  });

  it('classifies a plain name as name', () => {
    expect(parseSearchQuery('Alice')).toEqual({ kind: 'name', value: 'Alice' });
  });

  it('trims whitespace around a name', () => {
    expect(parseSearchQuery('  Alice Johnson  ')).toEqual({ kind: 'name', value: 'Alice Johnson' });
  });

  it('classifies a name containing digits as name, since it has too few digits to be a phone', () => {
    expect(parseSearchQuery('Room 7B')).toEqual({ kind: 'name', value: 'Room 7B' });
  });

  it('does not misclassify a ref number as a phone even though it contains 12 digits', () => {
    const result = parseSearchQuery('VIS-20260720-123456');
    expect(result?.kind).toBe('ref');
  });
});

describe('SEARCH_KIND_LABEL', () => {
  it('provides a human label for every search kind', () => {
    expect(SEARCH_KIND_LABEL.phone).toBe('Phone number');
    expect(SEARCH_KIND_LABEL.ref).toBe('Reference number');
    expect(SEARCH_KIND_LABEL.name).toBe('Visitor Name');
  });
});

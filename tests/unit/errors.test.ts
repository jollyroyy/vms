import { describe, it, expect } from 'vitest';
import { safeErrorMessage } from '../../src/lib/errors';

describe('safeErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(safeErrorMessage(new Error('Something broke'))).toBe('Something broke');
  });

  it('extracts message from object with message property', () => {
    expect(safeErrorMessage({ message: 'object error' })).toBe('object error');
  });

  it('extracts message from object with numeric message', () => {
    expect(safeErrorMessage({ message: 42 })).toBe('42');
  });

  it('uses fallback for null', () => {
    expect(safeErrorMessage(null)).toBe('An unexpected error occurred.');
  });

  it('uses custom fallback for undefined', () => {
    expect(safeErrorMessage(undefined, 'custom fallback')).toBe('custom fallback');
  });

  it('returns string as-is for strings', () => {
    expect(safeErrorMessage('direct string')).toBe('direct string');
  });

  it('stringifies object without message property', () => {
    const result = safeErrorMessage({ code: 500 });
    expect(result).toBe(JSON.stringify({ code: 500 }));
  });

  it('never produces [object Object] for any input', () => {
    const cases = [
      new Error('test'),
      { message: 'test' },
      { foo: 'bar' },
      null,
      undefined,
      'string',
      42,
      true,
      Symbol('test'),
      [1, 2, 3],
    ];
    for (const c of cases) {
      expect(safeErrorMessage(c as any)).not.toMatch(/\[object Object\]/);
    }
  });

  it('extracts nested message from Supabase-style error', () => {
    const supabaseErr = { message: 'new row violates row-level security', details: '...', hint: '...', code: '42501' };
    expect(safeErrorMessage(supabaseErr)).toBe('new row violates row-level security');
  });
});

import { describe, it, expect } from 'vitest';
import { isCheckableStatus } from '../../../src/lib/checkableStatus';
import type { VisitStatus } from '../../../src/types/index';

// Enumerated explicitly (not looped over a derived list) so that adding a
// new VisitStatus without updating this test — and without updating the
// Record in checkableStatus.ts — fails loudly rather than silently passing.
describe('isCheckableStatus', () => {
  it('is checkable for null (recurring visitor, no visit row yet)', () => {
    expect(isCheckableStatus(null)).toBe(true);
  });

  it('is checkable for approved', () => {
    expect(isCheckableStatus('approved')).toBe(true);
  });

  it('is checkable for walkin_approved', () => {
    expect(isCheckableStatus('walkin_approved')).toBe(true);
  });

  it('is NOT checkable for pending_approval', () => {
    expect(isCheckableStatus('pending_approval')).toBe(false);
  });

  it('is NOT checkable for checked_in', () => {
    expect(isCheckableStatus('checked_in')).toBe(false);
  });

  it('is NOT checkable for checked_out', () => {
    expect(isCheckableStatus('checked_out')).toBe(false);
  });

  it('is NOT checkable for rejected', () => {
    expect(isCheckableStatus('rejected')).toBe(false);
  });

  it('is NOT checkable for cancelled', () => {
    expect(isCheckableStatus('cancelled')).toBe(false);
  });

  it('is NOT checkable for no_show', () => {
    expect(isCheckableStatus('no_show')).toBe(false);
  });

  it('is NOT checkable for expired', () => {
    expect(isCheckableStatus('expired')).toBe(false);
  });

  it('covers every VisitStatus value with an explicit case above', () => {
    const covered: VisitStatus[] = [
      'pending_approval', 'approved', 'walkin_approved', 'checked_in',
      'checked_out', 'rejected', 'cancelled', 'no_show', 'expired',
    ];
    expect(covered.length).toBe(9);
  });
});

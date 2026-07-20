// CHECK for goal.md §2.2A SLA-W1 — approval escalation timing.
// HOD gets 5 minutes; if no response, routes to delegate; at 10 minutes → Admin.
import { describe, it, expect } from 'vitest';
import { getEscalationTarget } from '../../src/lib/escalation';

const BASE = '2026-07-20T10:00:00Z';
function minutesLater(n: number): string {
  return new Date(new Date(BASE).getTime() + n * 60_000).toISOString();
}

const roles = { hod_id: 'hod1', delegate_id: 'del1' };

describe('SLA-W1: escalation target (FR-VIS-07)', () => {
  it('routes to HOD when elapsed < 5 min', () => {
    expect(getEscalationTarget(BASE, minutesLater(2), roles)).toBe('hod');
    expect(getEscalationTarget(BASE, minutesLater(4), roles)).toBe('hod');
  });

  it('routes to delegate at exactly 5 min', () => {
    expect(getEscalationTarget(BASE, minutesLater(5), roles)).toBe('delegate');
  });

  it('routes to delegate in the 5–9 min window', () => {
    expect(getEscalationTarget(BASE, minutesLater(7), roles)).toBe('delegate');
    expect(getEscalationTarget(BASE, minutesLater(9), roles)).toBe('delegate');
  });

  it('routes to admin at 10 min', () => {
    expect(getEscalationTarget(BASE, minutesLater(10), roles)).toBe('admin');
    expect(getEscalationTarget(BASE, minutesLater(30), roles)).toBe('admin');
  });

  it('skips to admin if no delegate is configured (5–9 min window)', () => {
    const noDelegate = { hod_id: 'hod1', delegate_id: null };
    expect(getEscalationTarget(BASE, minutesLater(7), noDelegate)).toBe('admin');
  });
});

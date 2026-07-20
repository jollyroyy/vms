// CHECK for goal.md S4 (🎯) — FR ref: PRD §4.4, FR-GP-06 (partial returns), FR-GP-07
// Status machine: Draft → Pending Approval → Approved → Dispatched/Received →
//   (RGP) Awaiting Return → Partially Returned / Returned → Closed; plus Rejected, Cancelled.
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyReturn,
  type GatePass,
  type GatePassStatus,
} from '../../src/lib/gatePassStatus';

const rgpOut = (over: Partial<GatePass> = {}): GatePass => ({
  id: 'gp1',
  type: 'RGP',
  direction: 'OUT',
  status: 'awaiting_return',
  items: [
    { id: 'i1', description: 'Office chair', qty: 5, returnedQty: 0 },
    { id: 'i2', description: 'Drill machine', qty: 1, returnedQty: 0 },
  ],
  ...over,
});

describe('S4: gate pass status machine', () => {
  it('follows the happy path for an approved outward pass', () => {
    expect(canTransition('draft', 'pending_approval')).toBe(true);
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'dispatched')).toBe(true);
  });

  it('NRGP closes after dispatch/receipt — no return leg', () => {
    expect(canTransition('dispatched', 'closed')).toBe(true);
  });

  it('RGP must go through awaiting_return before closing', () => {
    expect(canTransition('dispatched', 'awaiting_return')).toBe(true);
    expect(canTransition('awaiting_return', 'closed')).toBe(false); // must return first
  });

  it('cannot skip approval', () => {
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('pending_approval', 'dispatched')).toBe(false);
  });

  it('rejection is terminal; rejected passes cannot be dispatched', () => {
    expect(canTransition('pending_approval', 'rejected')).toBe(true);
    expect(canTransition('rejected', 'dispatched')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
  });

  it('approved-but-not-dispatched passes can be cancelled', () => {
    expect(canTransition('approved', 'cancelled')).toBe(true);
    expect(canTransition('dispatched', 'cancelled')).toBe(false);
  });
});

describe('S4/FR-GP-06: partial returns', () => {
  it('a partial return keeps the pass open as partially_returned', () => {
    const result = applyReturn(rgpOut(), [{ itemId: 'i1', qty: 3 }]);
    expect(result.status).toBe<GatePassStatus>('partially_returned');
    expect(result.items.find((i) => i.id === 'i1')?.returnedQty).toBe(3);
  });

  it('returning everything closes the pass', () => {
    const result = applyReturn(rgpOut(), [
      { itemId: 'i1', qty: 5 },
      { itemId: 'i2', qty: 1 },
    ]);
    expect(result.status).toBe<GatePassStatus>('returned');
  });

  it('cumulative partial returns close the pass when the last item comes back', () => {
    const first = applyReturn(rgpOut(), [{ itemId: 'i1', qty: 5 }]);
    const second = applyReturn(first, [{ itemId: 'i2', qty: 1 }]);
    expect(second.status).toBe('returned');
  });

  it('over-returning is rejected (5 chairs out, 6 cannot come back)', () => {
    expect(() => applyReturn(rgpOut(), [{ itemId: 'i1', qty: 6 }])).toThrow();
  });

  it('returns against unknown item lines are rejected', () => {
    expect(() => applyReturn(rgpOut(), [{ itemId: 'nope', qty: 1 }])).toThrow();
  });
});

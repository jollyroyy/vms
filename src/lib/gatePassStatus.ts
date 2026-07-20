// S4 — gate pass state machine and partial-return logic.
// Covers all 4 pass types (Inward/Outward × RGP/NRGP) and FR-GP-06 partial returns.

export type GatePassStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'dispatched'
  | 'awaiting_return'
  | 'partially_returned'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export type GatePassItem = {
  id: string;
  description: string;
  qty: number;
  returnedQty: number;
};

export type GatePass = {
  id: string;
  type: 'RGP' | 'NRGP';
  direction: 'IN' | 'OUT';
  status: GatePassStatus;
  items: GatePassItem[];
};

// All valid transitions. The calling layer picks the correct path per type (RGP vs NRGP).
const TRANSITIONS: Record<GatePassStatus, GatePassStatus[]> = {
  draft:              ['pending_approval'],
  pending_approval:   ['approved', 'rejected'],
  approved:           ['dispatched', 'cancelled'],
  dispatched:         ['awaiting_return', 'closed'],  // NRGP → closed; RGP → awaiting_return
  awaiting_return:    ['partially_returned', 'returned'],
  partially_returned: ['partially_returned', 'returned'],
  returned:           ['closed'],
  closed:             [],
  rejected:           [],
  cancelled:          [],
};

export function canTransition(from: GatePassStatus, to: GatePassStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// FR-GP-06: apply a set of return lines to an RGP gate pass.
// Throws on unknown item IDs or over-return quantities.
export function applyReturn(
  gatePass: GatePass,
  returns: { itemId: string; qty: number }[],
): GatePass {
  const updatedItems: GatePassItem[] = gatePass.items.map((i) => ({ ...i }));

  for (const ret of returns) {
    const idx = updatedItems.findIndex((i) => i.id === ret.itemId);
    if (idx === -1) {
      throw new Error(`Unknown item id: ${ret.itemId}`);
    }
    const item = updatedItems[idx]!;
    if (item.returnedQty + ret.qty > item.qty) {
      throw new Error(
        `Over-return on ${ret.itemId}: returning ${ret.qty} but only ${item.qty - item.returnedQty} remain`,
      );
    }
    updatedItems[idx] = { ...item, returnedQty: item.returnedQty + ret.qty };
  }

  const allReturned = updatedItems.every((i) => i.returnedQty === i.qty);
  const newStatus: GatePassStatus = allReturned ? 'returned' : 'partially_returned';

  return { ...gatePass, items: updatedItems, status: newStatus };
}

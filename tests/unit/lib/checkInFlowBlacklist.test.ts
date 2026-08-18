import { describe, it, expect, vi, beforeEach } from 'vitest';

// A valid pass says an APPROVER said yes. It does not say the person is still
// welcome. WalkInRequest and the kiosk refuse a flagged phone at REGISTRATION,
// but every scan-and-enter path (CheckInPanel, ScanPass, VisitorCheckInFlow,
// GuardWalkInApproved) skipped `visitors.is_blacklisted` entirely — so a
// visitor flagged AFTER their pass was issued scanned in clean, and the
// watchlist page only reported it afterwards. The gate belongs in the one
// write all those paths share.

const state = vi.hoisted(() => ({
  /** The row `select('visitor_id, visitor:visitors(...)')` resolves to. */
  visitRow: null as unknown,
  /** Recorded `.update({...})` payloads, so a refusal can be proved to write nothing. */
  updates: [] as unknown[],
}));

vi.mock('../../../src/supabaseClient', () => {
  const builder = (): any => {
    const b: any = {};
    let isUpdate = false;
    b.select = () => b;
    b.eq = () => b;
    b.update = (payload: unknown) => { isUpdate = true; state.updates.push(payload); return b; };
    b.maybeSingle = async () =>
      isUpdate
        ? { data: { id: 'visit-1', host_id: 'host-1' }, error: null }
        : { data: state.visitRow, error: null };
    return b;
  };
  return { supabase: { from: () => builder() } };
});

vi.mock('../../../src/lib/photoUpload', () => ({
  uploadPhoto: vi.fn(async () => ({ photoPath: 'p/1', photoData: null })),
}));

vi.mock('../../../src/lib/activeVisit', () => ({
  findActiveVisitByPhone: vi.fn(async () => null),
  findActiveVisitByIdProof: vi.fn(async () => null),
  activeVisitMessage: () => 'already inside',
  isAlreadyInsideError: () => false,
  ALREADY_INSIDE_FALLBACK: 'already inside',
}));

// The card-availability gate (migration 102) is a separate rule with its own
// test file; here it must simply never claim the number is taken, or every
// watchlist assertion below would be measuring the wrong refusal.
vi.mock('../../../src/lib/cardAssignment', () => ({
  findCardHolder: vi.fn(async () => null),
  cardInUseMessage: () => 'card in use',
  isCardTakenError: () => false,
  CARD_TAKEN_FALLBACK: 'card in use',
}));

vi.mock('../../../src/lib/visitExpiry', () => ({ isVisitExpired: () => false }));
vi.mock('../../../src/lib/notifyHostCheckIn', () => ({ notifyHostOnCheckIn: vi.fn(async () => ({ notified: true })) }));

import { checkInScannedVisit } from '../../../src/lib/checkInFlow';
import { uploadPhoto } from '../../../src/lib/photoUpload';

const opts = () => ({
  match: { visitorName: 'D. Mercer', visitorPhone: '9876543210', visitId: 'visit-1' },
  visit: null,
  photoBlob: new Blob(['x']),
  carrying: false,
  remarks: '',
  idScan: null,
  cardNumber: 'V-101',
});

beforeEach(() => {
  state.visitRow = { visitor_id: 'vis-1', visitor: { is_blacklisted: false, blacklist_reason: null } };
  state.updates = [];
  vi.clearAllMocks();
});

describe('checkInScannedVisit — watchlist gate', () => {
  it('refuses a blacklisted visitor even when the pass itself is valid', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: { is_blacklisted: true, blacklist_reason: 'Trespass' } };
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(false);
  });

  it('names the visitor and the reason, so the guard can act on it at the gate', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: { is_blacklisted: true, blacklist_reason: 'Trespass' } };
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('D. Mercer');
      expect(res.message).toContain('Trespass');
    }
  });

  // A flag with no reason recorded is still a flag. It must refuse, and it must
  // not print a dangling "watchlist: null".
  it('refuses when flagged with no reason recorded, without printing an empty reason', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: { is_blacklisted: true, blacklist_reason: null } };
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).not.toMatch(/null|undefined/);
  });

  // The refusal has to happen BEFORE the write, or the visitor is inside and we
  // are merely narrating it. It should also precede the photo upload — no point
  // storing a picture for an entry that cannot happen.
  it('writes nothing and uploads nothing when the visitor is flagged', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: { is_blacklisted: true, blacklist_reason: 'Trespass' } };
    await checkInScannedVisit(opts() as never);
    expect(state.updates).toHaveLength(0);
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  // Supabase returns an embedded to-one relation as an object on some client
  // versions and a single-element array on others. Neither spelling may open
  // the gate.
  it('reads the flag whether the embed comes back as an object or an array', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: [{ is_blacklisted: true, blacklist_reason: 'Banned' }] };
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(false);
  });

  it('lets an unflagged visitor through unchanged', async () => {
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(true);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ status: 'checked_in' });
  });

  // A missing visitor row is not proof of innocence, but it is also not proof
  // of a flag — the existing "missing visit" path already covers a bad id, and
  // failing closed on a null embed would block every check-in if the join ever
  // changed shape. Fail open here, and only here.
  it('does not block when no visitor record comes back', async () => {
    state.visitRow = { visitor_id: 'vis-1', visitor: null };
    const res = await checkInScannedVisit(opts() as never);
    expect(res.ok).toBe(true);
  });
});

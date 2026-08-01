import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockMaybeSingle } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

import { lookupVisitByQr } from '../../../src/lib/qrLookup';

function chain() {
  return { select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) };
}

const TOKEN = '8f14e45f-ceea-467a-9a4e-3b1c2d5f6a7b';
const PAYLOAD = `vms://checkin/${TOKEN}`;
const NOW = new Date('2026-08-01T10:00:00Z');

function visitRow(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    ref_number: 'VMS-2026-0001',
    status: 'approved',
    qr_token: TOKEN,
    qr_expires_at: '2026-08-01T18:00:00Z',
    visitor: { full_name: 'Asha Rao', phone: '9876543210', company: 'Acme' },
    department: { id: 'd1', name: 'Finance' },
    ...over,
  };
}

describe('M-QR-LOOKUP: lookupVisitByQr', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockMaybeSingle.mockReset();
    mockFrom.mockImplementation(() => chain());
  });

  it('rejects a payload that is not a VMS check-in code without hitting the network', async () => {
    const result = await lookupVisitByQr('https://example.com/promo', NOW);
    expect(result.status).toBe('invalid');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries the visits table when the payload parses', async () => {
    mockMaybeSingle.mockResolvedValue({ data: visitRow(), error: null });
    await lookupVisitByQr(PAYLOAD, NOW);
    expect(mockFrom).toHaveBeenCalledWith('visits');
  });

  it('returns the visit and an open gate for an approved, unexpired code', async () => {
    mockMaybeSingle.mockResolvedValue({ data: visitRow(), error: null });
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    expect(result.status).toBe('found');
    if (result.status !== 'found') throw new Error('expected found');
    expect(result.visit.id).toBe('v1');
    expect(result.gate).toEqual({ ok: true, reason: null });
  });

  it('accepts a bare token, so a hand-keyed code still resolves', async () => {
    mockMaybeSingle.mockResolvedValue({ data: visitRow(), error: null });
    const result = await lookupVisitByQr(TOKEN, NOW);
    expect(result.status).toBe('found');
  });

  it('returns not_found when no visit carries that token', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    expect(result.status).toBe('not_found');
  });

  it('returns a closed gate with a reason for an already checked-in visitor', async () => {
    mockMaybeSingle.mockResolvedValue({ data: visitRow({ status: 'checked_in' }), error: null });
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    if (result.status !== 'found') throw new Error('expected found');
    expect(result.gate.ok).toBe(false);
    expect(result.gate.reason).toMatch(/already checked in/i);
  });

  it('returns a closed gate for an expired code even though the visit exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: visitRow({ qr_expires_at: '2026-07-31T10:00:00Z' }),
      error: null,
    });
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    if (result.status !== 'found') throw new Error('expected found');
    expect(result.gate.ok).toBe(false);
    expect(result.gate.reason).toMatch(/expired/i);
  });

  it('surfaces a query failure as an error result rather than throwing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.message).toBeTruthy();
  });

  it('surfaces a thrown transport failure as an error result', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('boom'));
    const result = await lookupVisitByQr(PAYLOAD, NOW);
    expect(result.status).toBe('error');
  });
});

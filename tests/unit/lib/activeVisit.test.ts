import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLimit = vi.hoisted(() => vi.fn());
const eqCalls = vi.hoisted(() => ({ current: [] as [string, unknown][] }));

vi.mock('../../../src/supabaseClient', () => {
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => { eqCalls.current.push([col, val]); return builder; };
  builder.limit = (...args: any[]) => mockLimit(...args);
  return { supabase: { from: () => builder } };
});

import {
  findActiveVisitByPhone,
  findActiveVisitByIdProof,
  activeVisitMessage,
  isAlreadyInsideError,
  type ActiveVisit,
} from '../../../src/lib/activeVisit';

const insideRow = {
  id: 'visit-1',
  checked_in_at: '2026-08-03T04:30:00Z',
  visitor: { full_name: 'Priya Nair', phone: '9876543210', id_type: 'PAN', id_last4: '234F' },
};

beforeEach(() => {
  eqCalls.current = [];
  mockLimit.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('findActiveVisitByPhone', () => {
  it('returns the open visit for a number that is currently inside', async () => {
    mockLimit.mockResolvedValue({ data: [insideRow], error: null });
    const active = await findActiveVisitByPhone('9876543210');
    expect(active).toMatchObject({ visitId: 'visit-1', visitorName: 'Priya Nair', matchedOn: 'phone' });
  });

  it('only ever looks at checked_in visits — a visitor who left is not inside', async () => {
    await findActiveVisitByPhone('9876543210');
    expect(eqCalls.current).toContainEqual(['status', 'checked_in']);
  });

  // visitors.phone stores the canonical form normalizePhone produces (bare
  // digits, +91 and trunk zero stripped), so every spelling of the same number
  // must collapse to it before the lookup — otherwise "+91 98765 43210" would
  // sail past a check-in that "9876543210" is blocked from.
  it.each(['9876543210', '+91 98765 43210', '098765 43210'])(
    'normalises %s to the stored canonical form before matching',
    async (input) => {
      await findActiveVisitByPhone(input);
      const phoneCall = eqCalls.current.find(([col]) => col === 'visitors.phone');
      expect(phoneCall?.[1]).toBe('9876543210');
    },
  );

  it('returns null when nobody with that number is inside', async () => {
    expect(await findActiveVisitByPhone('9876543210')).toBeNull();
  });

  // An unparseable number is not a clash — it is a different validation error,
  // and reporting it as "already inside" would send the guard hunting a ghost.
  it('returns null rather than throwing on an invalid phone number', async () => {
    expect(await findActiveVisitByPhone('not-a-number')).toBeNull();
  });
});

describe('findActiveVisitByIdProof', () => {
  it('finds an open visit held by the same ID type and last four digits', async () => {
    mockLimit.mockResolvedValue({ data: [insideRow], error: null });
    const active = await findActiveVisitByIdProof('PAN', '234F');
    expect(active).toMatchObject({ visitorName: 'Priya Nair', matchedOn: 'id' });
  });

  it('does not query at all when the ID is only partly known', async () => {
    expect(await findActiveVisitByIdProof('PAN', null)).toBeNull();
    expect(await findActiveVisitByIdProof(null, '234F')).toBeNull();
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe('activeVisitMessage', () => {
  const base: ActiveVisit = {
    visitId: 'v1', visitorName: 'Priya Nair', phone: '9876543210',
    checkedInAt: '2026-08-03T04:30:00Z', matchedOn: 'phone',
  };

  it('names the person and their number for a phone clash', () => {
    const msg = activeVisitMessage(base);
    expect(msg).toContain('Priya Nair');
    expect(msg).toContain('9876543210');
    expect(msg).toContain('already inside');
  });

  it('tells the guard what to do about it', () => {
    expect(activeVisitMessage(base)).toMatch(/check them out/i);
  });

  it('words an ID clash differently — it is a weaker match', () => {
    const msg = activeVisitMessage({ ...base, matchedOn: 'id' });
    expect(msg).toContain('ID');
    expect(msg).toContain('Priya Nair');
  });

  it('omits the time rather than printing "Invalid Date" when it is missing', () => {
    const msg = activeVisitMessage({ ...base, checkedInAt: null });
    expect(msg).not.toContain('Invalid');
    expect(msg).toContain('Priya Nair');
  });
});

describe('isAlreadyInsideError', () => {
  it('recognises the partial-index violation', () => {
    expect(isAlreadyInsideError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "visits_one_open_per_visitor"',
    })).toBe(true);
  });

  // Mislabelling every unique violation "already inside" would hide real bugs,
  // e.g. a duplicate phone number on the visitors table.
  it('does not claim an unrelated unique violation is an already-inside clash', () => {
    expect(isAlreadyInsideError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "visitors_phone_key"',
    })).toBe(false);
  });

  it('is false for a non-unique error and for null', () => {
    expect(isAlreadyInsideError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isAlreadyInsideError(null)).toBe(false);
  });
});

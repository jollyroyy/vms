import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../../src/pages/Shared/Reports';
import { istDateKey } from '../../../src/lib/visitExpiry';
import { rangeBounds } from '../../../src/lib/reportsDateRange';

// THE REGISTER'S WINDOW IS AN IST DAY, EXCLUSIVE AT THE TOP.
//
// It used to be `${range.from}T00:00:00Z` .. `${range.to}T23:59:59Z` — a UTC
// reading of an IST calendar range, so it opened at 05:30 IST on the first day
// and closed at 05:29 IST on the day AFTER the last one. Every visitor who
// arrived before dawn was absent from a register printing their date on its own
// header, which is the failure this console can least afford: an admin who
// cannot find a visit concludes it never happened.
//
// Split out of Reports.test.tsx because it needs a mock that CAPTURES the
// bounds rather than ignoring them, and because that file is at the 300-line
// ceiling.
const mockOrder = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockBounds = vi.hoisted(() => ({ from: '', to: '' }));

vi.mock('../../../src/lib/exportUtils', () => ({ exportToCsv: vi.fn() }));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'gate_passes') return { select: () => ({ eq: () => ({ in: mockIn }) }) };
      return {
        select: () => ({
          gte: (_c: string, from: string) => {
            mockBounds.from = from;
            return { lt: (_c2: string, to: string) => { mockBounds.to = to; return { order: mockOrder }; } };
          },
        }),
      };
    },
  },
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: (rows: any[]) => Promise.resolve(rows),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('M12-REPORTS: the register fetches an IST day', () => {
  it('bounds the default day at IST midnights, not UTC ones', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => expect(mockBounds.from).not.toBe(''));

    const today = istDateKey(new Date());
    const expected = rangeBounds({ from: today, to: today });
    expect(mockBounds.from).toBe(expected.from);
    expect(mockBounds.to).toBe(expected.to);
    // The bound that was there before. 00:00Z is 05:30 IST.
    expect(mockBounds.from).not.toBe(`${today}T00:00:00Z`);
  });

  it('spans a full 24 hours — the upper bound is exclusive, not 23:59:59', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => expect(mockBounds.to).not.toBe(''));

    const span = new Date(mockBounds.to).getTime() - new Date(mockBounds.from).getTime();
    expect(span).toBe(86400000);
    expect(mockBounds.to).not.toMatch(/23:59:59/);
  });
});

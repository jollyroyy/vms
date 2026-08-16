import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import GuardLiveQueue from '../../../src/pages/Guard/GuardLiveQueue';
import type { ReportVisit } from '../../../src/lib/reportRow';

// The Entry & Exit tab (2026-08-15 widening): /guard/inside-now no longer
// lists only visitors still on site — it lists everyone who has been through
// the gate today, still-inside visitors first, then today's departures. This
// file covers the widened list itself; LiveQueueCheckOut.test.tsx already
// covers the row-level Check Out control in isolation.

// vitest.config.ts sets `globals: false`, so RTL's automatic cleanup never
// registers and renders would stack across cases.
afterEach(cleanup);

const mockActivity = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useGateActivity', () => ({
  useGateActivity: () => mockActivity.current,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

function insideVisit(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v-inside',
    ref_number: 'VIS-20260815-0001',
    status: 'checked_in',
    checked_in_at: '2026-08-15T04:00:00Z',
    checked_out_at: null,
    created_at: '2026-08-15T03:30:00Z',
    scheduled_for: '2026-08-15T04:00:00Z',
    purpose: 'meeting',
    qr_token: 'tok-inside',
    qr_expires_at: '2026-08-15T16:30:00Z',
    expected_departure: null,
    photo_data: null,
    visitor: { full_name: 'Ishaan Rao', vendor_name: 'Rao Traders' },
    host: { full_name: 'D. Kumar' },
    ...over,
  } as unknown as ReportVisit;
}

function departedVisit(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v-departed',
    ref_number: 'VIS-20260815-0002',
    status: 'checked_out',
    checked_in_at: '2026-08-15T01:00:00Z',
    checked_out_at: '2026-08-15T03:00:00Z',
    created_at: '2026-08-15T00:30:00Z',
    scheduled_for: '2026-08-15T01:00:00Z',
    purpose: 'delivery',
    qr_token: 'tok-departed',
    qr_expires_at: '2026-08-15T16:30:00Z',
    expected_departure: null,
    photo_data: null,
    visitor: { full_name: 'Meera Iyer', vendor_name: 'Iyer Logistics' },
    host: { full_name: 'R. Singh' },
    ...over,
  } as unknown as ReportVisit;
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/guard/inside-now']}>
      <GuardLiveQueue />
    </MemoryRouter>,
  );
}

describe('Entry & Exit tab (/guard/inside-now) — widened to entry + exit', () => {
  it('reads "Entry & Exit" in the heading', () => {
    mockActivity.current = { visits: [insideVisit()], loading: false };
    renderTab();
    expect(screen.getByText('Entry & Exit')).toBeInTheDocument();
  });

  it('shows a checked-out visitor with their exit time in the Out column, on the Checked Out lane', () => {
    mockActivity.current = { visits: [departedVisit()], loading: false };
    renderTab();
    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));
    const row = screen.getByText('Meera Iyer').closest('tr') as HTMLElement;
    // checked_out_at 2026-08-15T03:00:00Z -> 08:30 IST.
    // Matched as a substring, not an exact string: `formatStamp` prefixes the
    // DATE whenever the instant is not today, and this fixture is pinned to a
    // fixed day — so an exact "08:30 am" passed on 2026-08-15 and failed every
    // day after it. The column's job is to carry the exit time, which is what
    // this asserts; whether the date rides along is formatStamp's own test.
    expect(within(row).getByText(/08:30 am/)).toBeInTheDocument();
  });

  it('shows an em dash, never a blank cell, for a visitor still on site', () => {
    mockActivity.current = { visits: [insideVisit()], loading: false };
    renderTab();
    const row = screen.getByText('Ishaan Rao').closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell');
    // Out is the 6th column (Name, Company, Purpose, Host, In, Out, Status, action)
    expect(cells[5].textContent).toBe('—');
  });

  it('offers a Check Out button on a checked-in row (default Checked In lane)', () => {
    mockActivity.current = { visits: [insideVisit(), departedVisit()], loading: false };
    renderTab();

    const insideRow = screen.getByText('Ishaan Rao').closest('tr') as HTMLElement;
    expect(within(insideRow).getByRole('button', { name: /check out/i })).toBeInTheDocument();
    // The departed visitor is on the other lane, not interleaved into this one.
    expect(screen.queryByText('Meera Iyer')).not.toBeInTheDocument();
  });

  it('offers no Check Out button on a checked-out row, once switched to the Checked Out lane', () => {
    mockActivity.current = { visits: [insideVisit(), departedVisit()], loading: false };
    renderTab();
    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));

    const departedRow = screen.getByText('Meera Iyer').closest('tr') as HTMLElement;
    expect(within(departedRow).queryByRole('button', { name: /check out/i })).toBeNull();
    expect(within(departedRow).getByText('Left')).toBeInTheDocument();
    // The still-inside visitor stays on the other lane.
    expect(screen.queryByText('Ishaan Rao')).not.toBeInTheDocument();
  });

  // Two lanes, not one merged list (2026-08-15 widening): the tab a guard is
  // on is the only group they see, each with its own count.
  it('lists each visitor under their own lane, not interleaved', () => {
    mockActivity.current = { visits: [departedVisit(), insideVisit()], loading: false };
    renderTab();

    expect(screen.getByText('Ishaan Rao')).toBeInTheDocument();
    expect(screen.queryByText('Meera Iyer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Checked Out/i }));
    expect(screen.getByText('Meera Iyer')).toBeInTheDocument();
    expect(screen.queryByText('Ishaan Rao')).not.toBeInTheDocument();
  });
});

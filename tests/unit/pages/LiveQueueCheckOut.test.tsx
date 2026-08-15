import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

import LiveQueueTable, { type LiveQueuePill } from '../../../src/pages/Guard/LiveQueueTable';
import CheckInBadgeRail from '../../../src/pages/Guard/CheckInBadgeRail';
import type { ReportVisit } from '../../../src/lib/reportRow';

// /visitors/inside was the ONLY place a visitor could be checked out. Retiring
// that surface without moving the exit would have meant nobody could ever
// leave, so Inside Now — the list of people who are actually inside — carries
// it now, in two places a guard can reach without thinking: on the row, and on
// the selected visitor's pass frame.

// vitest.config.ts sets `globals: false`, so RTL's automatic cleanup never
// registers and renders would stack across cases.
afterEach(cleanup);

const pill = (): LiveQueuePill => ({ label: 'CHECKED IN', cls: '' });

const visit = (over: Partial<ReportVisit> = {}): ReportVisit =>
  ({
    id: 'v1',
    ref_number: 'VIS-20260814-0001',
    status: 'checked_in',
    checked_in_at: '2026-08-14T04:05:00Z',
    created_at: '2026-08-14T03:00:00Z',
    scheduled_for: '2026-08-14T04:00:00Z',
    purpose: 'meeting',
    qr_expires_at: '2026-08-14T16:30:00Z',
    expected_departure: null,
    photo_data: null,
    visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners' },
    host: { full_name: 'D. Kumar' },
    ...over,
  }) as unknown as ReportVisit;

function renderTable(onCheckOut?: (v: ReportVisit) => void, v = visit()) {
  return render(
    <LiveQueueTable
      queue={[v]}
      loading={false}
      initialsOf={(n) => (n ?? 'U').slice(0, 2).toUpperCase()}
      statusPill={pill}
      timeOf={() => '09:42'}
      exitTimeOf={() => '—'}
      onSelect={vi.fn()}
      selectedId={null}
      onCheckOut={onCheckOut}
    />,
  );
}

describe('LiveQueueTable — the exit on the row', () => {
  it('offers Check Out on a checked-in row', () => {
    renderTable(vi.fn());
    expect(screen.getByRole('button', { name: /check out/i })).toBeTruthy();
  });

  it('hands back the visit that was clicked', () => {
    const onCheckOut = vi.fn();
    const v = visit();
    renderTable(onCheckOut, v);
    fireEvent.click(screen.getByRole('button', { name: /check out/i }));
    expect(onCheckOut).toHaveBeenCalledWith(v);
  });

  // The row itself is clickable (it selects the visitor for the right-hand
  // frame). The exit must not also trigger that, or confirming a check-out
  // would happen behind a panel that just swapped underneath it.
  it('does not also select the row', () => {
    const onSelect = vi.fn();
    render(
      <LiveQueueTable
        queue={[visit()]}
        loading={false}
        initialsOf={(n) => (n ?? 'U').slice(0, 2).toUpperCase()}
        statusPill={pill}
        timeOf={() => '09:42'}
        exitTimeOf={() => '—'}
        onSelect={onSelect}
        selectedId={null}
        onCheckOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /check out/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // The old behaviour: a green "Done" tick on every row, which did nothing.
  it('falls back to the read-only tick when no handler is supplied', () => {
    renderTable(undefined);
    expect(screen.queryByRole('button', { name: /check out/i })).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('never offers an exit to somebody who is not inside', () => {
    renderTable(vi.fn(), visit({ status: 'approved', checked_in_at: null }));
    expect(screen.queryByRole('button', { name: /check out/i })).toBeNull();
  });
});

describe('CheckInBadgeRail — the exit beside the pass', () => {
  const rail = (onCheckOut?: () => void) =>
    render(
      <CheckInBadgeRail
        activeVisit={visit()}
        qrDataUrl={null}
        onPrintBadge={vi.fn()}
        onClose={vi.fn()}
        onCheckOut={onCheckOut}
      />,
    );

  it('renders Check Out alongside Print Badge', () => {
    rail(vi.fn());
    expect(screen.getByRole('button', { name: /check out/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /print badge/i })).toBeTruthy();
  });

  it('fires the handler', () => {
    const onCheckOut = vi.fn();
    rail(onCheckOut);
    fireEvent.click(screen.getByRole('button', { name: /check out/i }));
    expect(onCheckOut).toHaveBeenCalled();
  });

  it('stays read-only when no handler is supplied', () => {
    rail(undefined);
    expect(screen.queryByRole('button', { name: /check out/i })).toBeNull();
  });

  // The pass is a preview of something printed on paper and must stay white in
  // both themes — adding a button beside it must not have disturbed that.
  it('still renders the pass on an explicit white ground', () => {
    const { container } = rail(vi.fn());
    const pass = container.querySelector('#vms-print-badge') as HTMLElement | null;
    expect(pass?.style.backgroundColor).toBe('rgb(255, 255, 255)');
  });
});

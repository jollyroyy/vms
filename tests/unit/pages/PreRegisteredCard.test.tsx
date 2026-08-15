import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import PreRegisteredCard, { isCheckInReady, type PreRegisteredPill } from '../../../src/pages/Guard/PreRegisteredCard';
import type { ReportVisit } from '../../../src/lib/reportRow';

// Check-in used to live only on /visitors/expected. With that surface retired,
// the arrivals board is where a guard admits somebody — so the control has to
// be on the face of the card, not behind a details sheet or a hover state.

// vitest.config.ts sets `globals: false`, so React Testing Library's automatic
// afterEach cleanup never registers and renders would stack across cases.
afterEach(cleanup);

const pill: PreRegisteredPill = { label: 'EXPECTED', cls: '' };

const visit = (over: Partial<ReportVisit> = {}): ReportVisit =>
  ({
    id: 'v1',
    status: 'approved',
    checked_in_at: null,
    created_at: '2026-08-14T03:00:00Z',
    scheduled_for: '2026-08-14T04:00:00Z',
    purpose: 'meeting',
    visitor: { full_name: 'Anita Kapoor', vendor_name: 'TechNova Solutions' },
    host: { full_name: 'S. Verma' },
    ...over,
  }) as unknown as ReportVisit;

function renderCard(v: ReportVisit, onCheckIn?: (visit: ReportVisit) => void) {
  return render(
    <MemoryRouter>
      <PreRegisteredCard visit={v} index={0} pill={pill} onCheckIn={onCheckIn} />
    </MemoryRouter>,
  );
}

describe('PreRegisteredCard — check-in action', () => {
  it('shows a Check In button for an approved visitor who has not arrived', () => {
    renderCard(visit(), vi.fn());
    expect(screen.getByRole('button', { name: /check in/i })).toBeTruthy();
  });

  it('shows it for a host-approved walk-in too', () => {
    renderCard(visit({ status: 'walkin_approved' }), vi.fn());
    expect(screen.getByRole('button', { name: /check in/i })).toBeTruthy();
  });

  it('hands the visit back when pressed', () => {
    const onCheckIn = vi.fn();
    const v = visit();
    renderCard(v, onCheckIn);
    fireEvent.click(screen.getByRole('button', { name: /check in/i }));
    expect(onCheckIn).toHaveBeenCalledWith(v);
  });

  // A visitor already through the gate has nothing left to do to them here;
  // the exit lives on Inside Now. A button the guard cannot honour is worse
  // than no button.
  it('offers nothing for a visitor who is already inside', () => {
    renderCard(visit({ status: 'checked_in', checked_in_at: '2026-08-14T04:05:00Z' }), vi.fn());
    expect(screen.queryByRole('button', { name: /check in/i })).toBeNull();
  });

  it('offers nothing for a visitor nobody has approved yet', () => {
    renderCard(visit({ status: 'pending_approval' }), vi.fn());
    expect(screen.queryByRole('button', { name: /check in/i })).toBeNull();
  });

  it('stays read-only when no handler is supplied', () => {
    renderCard(visit());
    expect(screen.queryByRole('button', { name: /check in/i })).toBeNull();
  });

  // The whole card used to be a <Link> to /guard/inside-now?verify=…, which
  // lists checked_in visitors only — so tapping a waiting visitor landed on a
  // page that did not contain them. Only someone actually on that page gets
  // the link now.
  it('does not link a waiting visitor to the inside-now page', () => {
    const { container } = renderCard(visit(), vi.fn());
    expect(container.querySelector('a[href*="inside-now"]')).toBeNull();
  });

  it('still links a checked-in visitor to their record on Inside Now', () => {
    const { container } = renderCard(visit({ status: 'checked_in', checked_in_at: '2026-08-14T04:05:00Z' }), vi.fn());
    expect(container.querySelector('a[href*="inside-now"]')).toBeTruthy();
  });

  it('renders the visitor, vendor and host exactly once each', () => {
    renderCard(visit(), vi.fn());
    expect(screen.getAllByText('Anita Kapoor')).toHaveLength(1);
    expect(screen.getAllByText('TechNova Solutions')).toHaveLength(1);
    expect(screen.getAllByText(/S\. Verma/)).toHaveLength(1);
  });
});

describe('isCheckInReady', () => {
  it.each([
    ['approved', null, true],
    ['walkin_approved', null, true],
    ['approved', '2026-08-14T04:05:00Z', false],
    ['pending_approval', null, false],
    ['checked_in', '2026-08-14T04:05:00Z', false],
    ['checked_out', '2026-08-14T04:05:00Z', false],
    ['rejected', null, false],
    ['no_show', null, false],
    ['expired', null, false],
    ['cancelled', null, false],
  ])('%s (checked_in_at=%s) -> %s', (status, checkedInAt, expected) => {
    expect(isCheckInReady(visit({ status, checked_in_at: checkedInAt } as Partial<ReportVisit>))).toBe(expected);
  });
});

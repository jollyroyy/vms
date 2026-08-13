// New component (src/pages/Guard/DashboardDrilldown.tsx) — the panel a KPI
// tile expands into on the guard dashboard. GuardDashboard.test.tsx only ever
// exercises it through a mock, so this file is the only place its own
// rendering, filtering, and interaction behaviour is verified.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DashboardDrilldown from '../../../src/pages/Guard/DashboardDrilldown';
import { DRILL_KEYS, DRILL_COPY, type DrillKey } from '../../../src/lib/dashboardDrill';
import type { ReportVisit } from '../../../src/lib/reportRow';
import type { Visit } from '../../../src/types/index';

afterEach(cleanup);

function visit(overrides: Partial<Visit> = {}): ReportVisit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-03T04:00:00Z',
    visitor: { id: 'p1', phone: '9876543210', full_name: 'Alice Johnson', vendor_name: null,
      id_type: 'Aadhaar', id_last4: '1234', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  } as ReportVisit;
}

describe('DashboardDrilldown', () => {
  it.each(DRILL_KEYS)('renders the title and subtitle for drill key "%s"', (key: DrillKey) => {
    render(<DashboardDrilldown drillKey={key} loading={false} visits={[]} onClose={vi.fn()} />);
    expect(screen.getByText(DRILL_COPY[key].title)).toBeInTheDocument();
    expect(screen.getByText(DRILL_COPY[key].subtitle)).toBeInTheDocument();
  });

  it('renders a card per matching visit and excludes non-matching ones', () => {
    const inside = visit({ id: 'inside', status: 'checked_in', visitor: { ...visit().visitor!, full_name: 'Inside Person' } });
    const declined = visit({ id: 'declined', status: 'rejected', visitor: { ...visit().visitor!, full_name: 'Declined Person' } });
    const pending = visit({ id: 'pending', status: 'pending_approval', visitor: { ...visit().visitor!, full_name: 'Pending Person' } });

    render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[inside, declined, pending]} onClose={vi.fn()} />,
    );

    expect(screen.getByText('Inside Person')).toBeInTheDocument();
    expect(screen.queryByText('Declined Person')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Person')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton and not the empty state or any cards while loading', () => {
    render(<DashboardDrilldown drillKey="inside" loading visits={[]} onClose={vi.fn()} />);
    expect(screen.queryByText(DRILL_COPY.inside.empty)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the per-key empty-state copy when nothing matches', () => {
    const pending = visit({ id: 'pending', status: 'pending_approval' });
    render(<DashboardDrilldown drillKey="declined" loading={false} visits={[pending]} onClose={vi.fn()} />);
    expect(screen.getByText(DRILL_COPY.declined.empty)).toBeInTheDocument();
  });

  it('the count chip shows the filtered count, not the input length', () => {
    const inside = visit({ id: 'inside', status: 'checked_in' });
    const declined = visit({ id: 'declined', status: 'rejected' });
    const pending = visit({ id: 'pending', status: 'pending_approval' });
    render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[inside, declined, pending]} onClose={vi.fn()} />,
    );
    expect(screen.getByText(`1 ${DRILL_COPY.inside.countLabel}`)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<DashboardDrilldown drillKey="inside" loading={false} visits={[]} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(`Collapse ${DRILL_COPY.inside.title}`));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Client instruction, 2026-08-13: no Details control on the card. This panel
  // therefore opens nothing at all — it is a list you read, and the rows that
  // remain clickable on this page are the Recent Activity feed's, not these.
  it('renders no Details control on a drill-down card', () => {
    const inside = visit({ id: 'inside', status: 'checked_in', visitor: { ...visit().visitor!, full_name: 'Inside Person' } });
    render(<DashboardDrilldown drillKey="inside" loading={false} visits={[inside]} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Details for Inside Person')).toBeNull();
    expect(screen.queryByText(/details/i)).toBeNull();
  });

  it('renders the stacked card, the same one the Visitors surface uses', () => {
    const inside = visit({ id: 'inside', status: 'checked_in' });
    const { container } = render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[inside]} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.stack-card')).toBeInTheDocument();
  });

  // Client instruction, 2026-08-13: the origin / approval line is off the
  // DASHBOARD's cards. "Type: Pre-approved" (once inside) and the
  // "Approved" / "Awaiting approval" tick before it both go; the same card on
  // /visitors keeps them, which VisitorStackCard.test.tsx still asserts.
  it('never shows the origin line or the approval tick on a dashboard card', () => {
    const preApproved = visit({ id: 'pre', status: 'checked_in', scheduled_for: '2026-08-03T05:00:00Z' });
    const walkIn = visit({ id: 'walk', status: 'checked_in', ref_number: 'VIS-2', scheduled_for: null });

    const { container } = render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[preApproved, walkIn]} onClose={vi.fn()} />,
    );

    expect(container.querySelector('.stack-origin')).toBeNull();
    expect(screen.queryByText(/^Type:/)).toBeNull();
    expect(screen.queryByText('Pre-approved')).toBeNull();
    expect(screen.queryByText('Walk-in')).toBeNull();
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.queryByText('Awaiting approval')).toBeNull();
    // The ID-proof tick is untouched — only the approval line went.
    expect(screen.getAllByText(/^ID Proof:/)).toHaveLength(2);
  });

  // Regression: "Dashboard reads, Console acts" (CLAUDE.md). This panel is
  // situational awareness only — everything that changes a visit's state
  // lives on /visitors. Rendering the stacked card with an `action` here
  // would put a Check In / Check Out button on the dashboard, so it must
  // never receive one. Since Details went too (2026-08-13), a drill-down card
  // now holds no buttons whatsoever.
  //
  // The Check In half of this used to run against drillKey="preApproved". That
  // tile is gone (the approval counts live on /visitors now), and with it the
  // only dashboard panel that could ever list a not-yet-arrived visitor — so
  // the assertion is made against the panel that CAN list one instead, by
  // handing `entered` a still-approved row and confirming it neither lists it
  // nor offers to act on it.
  it('never renders a Check In or Check Out action — a card here holds no buttons', () => {
    const approved = visit({ id: 'approved', status: 'approved' });
    const checkedIn = visit({ id: 'checked-in', status: 'checked_in', ref_number: 'VIS-2' });

    const { unmount } = render(
      <DashboardDrilldown drillKey="entered" loading={false} visits={[approved, checkedIn]} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Check In')).not.toBeInTheDocument();
    expect(screen.queryByText('Check Out')).not.toBeInTheDocument();
    unmount();

    const { container } = render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[checkedIn]} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Check Out')).not.toBeInTheDocument();
    // The panel's own Collapse button is the only one on the surface.
    expect(container.querySelectorAll('[data-card-list] button')).toHaveLength(0);
  });
});

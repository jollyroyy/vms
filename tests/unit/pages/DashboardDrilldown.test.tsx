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
    render(<DashboardDrilldown drillKey={key} loading={false} visits={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(DRILL_COPY[key].title)).toBeInTheDocument();
    expect(screen.getByText(DRILL_COPY[key].subtitle)).toBeInTheDocument();
  });

  it('renders a card per matching visit and excludes non-matching ones', () => {
    const inside = visit({ id: 'inside', status: 'checked_in', visitor: { ...visit().visitor!, full_name: 'Inside Person' } });
    const declined = visit({ id: 'declined', status: 'rejected', visitor: { ...visit().visitor!, full_name: 'Declined Person' } });
    const pending = visit({ id: 'pending', status: 'pending_approval', visitor: { ...visit().visitor!, full_name: 'Pending Person' } });

    render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[inside, declined, pending]} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText('Inside Person')).toBeInTheDocument();
    expect(screen.queryByText('Declined Person')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Person')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton and not the empty state or any cards while loading', () => {
    render(<DashboardDrilldown drillKey="inside" loading visits={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(DRILL_COPY.inside.empty)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the per-key empty-state copy when nothing matches', () => {
    const pending = visit({ id: 'pending', status: 'pending_approval' });
    render(<DashboardDrilldown drillKey="declined" loading={false} visits={[pending]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(DRILL_COPY.declined.empty)).toBeInTheDocument();
  });

  it('the count chip shows the filtered count, not the input length', () => {
    const inside = visit({ id: 'inside', status: 'checked_in' });
    const declined = visit({ id: 'declined', status: 'rejected' });
    const pending = visit({ id: 'pending', status: 'pending_approval' });
    render(
      <DashboardDrilldown drillKey="inside" loading={false} visits={[inside, declined, pending]} onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(`1 ${DRILL_COPY.inside.countLabel}`)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<DashboardDrilldown drillKey="inside" loading={false} visits={[]} onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(`Collapse ${DRILL_COPY.inside.title}`));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a card calls onSelect with that visit', () => {
    const onSelect = vi.fn();
    const inside = visit({ id: 'inside', status: 'checked_in', visitor: { ...visit().visitor!, full_name: 'Inside Person' } });
    render(<DashboardDrilldown drillKey="inside" loading={false} visits={[inside]} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Inside Person'));
    expect(onSelect).toHaveBeenCalledWith(inside);
  });
});

// New component (src/pages/Guard/DashboardActivity.tsx) — the Recent Activity
// panel reinstated on the guard dashboard. It renders <Link>s, so every case
// needs a <MemoryRouter>, matching DashboardDrilldown's sibling test file.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardActivity from '../../../src/pages/Guard/DashboardActivity';
import type { ReportVisit } from '../../../src/lib/reportRow';
import type { Visit } from '../../../src/types/index';

afterEach(cleanup);

function visit(overrides: Partial<Visit> & Record<string, unknown> = {}): ReportVisit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'checked_in',
    checked_in_at: '2026-08-13T04:12:00Z', checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, scheduled_for: null, qr_token: 't',
    qr_expires_at: null, created_at: '2026-08-13T03:00:00Z', actorAt: null,
    visitor: { id: 'p1', phone: '9876543210', full_name: 'Alice Johnson', vendor_name: 'Acme Corp',
      id_type: 'Aadhaar', id_last4: '1234', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
    department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  } as unknown as ReportVisit;
}

function renderPanel(props: Partial<React.ComponentProps<typeof DashboardActivity>> = {}) {
  return render(
    <MemoryRouter>
      <DashboardActivity visits={[]} loading={false} onSelect={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe('DashboardActivity', () => {
  it('renders the Recent Activity heading', () => {
    renderPanel();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows the empty state when there are no visits', () => {
    renderPanel({ visits: [] });
    expect(screen.getByText('Nothing has happened at the gate yet today.')).toBeInTheDocument();
  });

  it('shows skeletons and no rows while loading', () => {
    const { container } = renderPanel({ visits: [visit()], loading: true });
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  it('renders a checked-in visit with its name and an ENTRY badge', () => {
    renderPanel({ visits: [visit()] });
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('ENTRY')).toBeInTheDocument();
  });

  it('renders BOTH an entry and an exit row for a checked-out visit', () => {
    renderPanel({
      visits: [visit({
        status: 'checked_out',
        checked_in_at: '2026-08-13T04:00:00Z',
        checked_out_at: '2026-08-13T06:30:00Z',
      })],
    });
    expect(screen.getByText('ENTRY')).toBeInTheDocument();
    expect(screen.getByText('EXIT')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Johnson')).toHaveLength(2);
  });

  it('renders a DECLINED badge for a rejected visit', () => {
    renderPanel({
      visits: [visit({ status: 'rejected', checked_in_at: null, actorAt: '2026-08-13T05:00:00Z' })],
    });
    expect(screen.getByText('DECLINED')).toBeInTheDocument();
  });

  it('calls onSelect with the visit when a row is clicked', () => {
    const onSelect = vi.fn();
    const v = visit();
    renderPanel({ visits: [v], onSelect });
    fireEvent.click(screen.getByText('Alice Johnson'));
    expect(onSelect).toHaveBeenCalledWith(v);
  });

  it('caps the panel at 6 rows even when the day has more events', () => {
    const visits = Array.from({ length: 8 }, (_, i) => visit({
      id: `v${i}`,
      checked_in_at: `2026-08-13T0${i}:00:00Z`,
      visitor: { ...visit().visitor!, full_name: `Visitor ${i}` },
    }));
    renderPanel({ visits });
    expect(screen.getAllByText('ENTRY')).toHaveLength(6);
  });
});

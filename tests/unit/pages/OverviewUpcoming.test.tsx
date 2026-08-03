import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Visit } from '../../../src/types/index';
import OverviewUpcoming from '../../../src/pages/HOD/OverviewUpcoming';

afterEach(cleanup);

const upcomingVisit = (overrides: Record<string, unknown> = {}): Visit => ({
  id: 'v1',
  ref_number: 'VIS-200',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'approved',
  checked_in_at: null,
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Upcoming Visitor', vendor_name: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
  host: { id: 'h1', full_name: 'Dr. Sharma' },
  ...overrides,
}) as Visit;

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('OverviewUpcoming', () => {
  it('renders the "Upcoming visits" heading', () => {
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={[]} />);
    expect(screen.getByRole('heading', { name: /Upcoming visits/i })).toBeInTheDocument();
  });

  it('shows the empty state when there are no upcoming visits', () => {
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={[]} />);
    expect(screen.getByText('No upcoming visits')).toBeInTheDocument();
    expect(screen.getByText('Scheduled and pre-approved visits will appear here.')).toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    renderWithRouter(<OverviewUpcoming loading={true} upcoming={[]} />);
    expect(screen.queryByText('No upcoming visits')).not.toBeInTheDocument();
  });

  it('does not show the visit count badge while loading', () => {
    renderWithRouter(<OverviewUpcoming loading={true} upcoming={[]} />);
    expect(screen.queryByText(/^\d+ visits?$/)).not.toBeInTheDocument();
  });

  it('renders visitor name, company, host, purpose and the count badge for a real row', () => {
    const upcoming = [upcomingVisit()];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    expect(screen.getByText('Upcoming Visitor')).toBeInTheDocument();
    // company appears twice: once inline next to purpose, once as a pill — use getAllByText
    expect(screen.getAllByText(/Acme Co/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Host: Dr. Sharma')).toBeInTheDocument();
    expect(screen.getByText(/Meeting/)).toBeInTheDocument();
    expect(screen.getByText('1 visit')).toBeInTheDocument();
    // Empty state must not also render once a real row is present.
    expect(screen.queryByText('No upcoming visits')).not.toBeInTheDocument();
  });

  it('shows "Pre-approved" for approved status, "Walk-in approved" for walkin_approved, "Pending" for pending_approval', () => {
    const upcoming = [
      upcomingVisit({ id: 'approved-1', status: 'approved' }),
      upcomingVisit({ id: 'walkin-1', status: 'walkin_approved', visitor: { id: 'vis2', phone: '9000000001', full_name: 'Walk-in Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
      upcomingVisit({ id: 'pending-1', status: 'pending_approval', visitor: { id: 'vis3', phone: '9000000002', full_name: 'Pending Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
    ];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
    expect(screen.getByText('Walk-in approved')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows "Awaiting gate check" for both approved and walkin_approved statuses', () => {
    const upcoming = [
      upcomingVisit({ id: 'approved-1', status: 'approved' }),
      upcomingVisit({ id: 'walkin-1', status: 'walkin_approved', visitor: { id: 'vis2', phone: '9000000001', full_name: 'Walk-in Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
    ];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    const awaitingGateTexts = screen.getAllByText('Awaiting gate check');
    expect(awaitingGateTexts).toHaveLength(2);
  });

  it('does not show "Awaiting gate check" for pending_approval status', () => {
    const upcoming = [
      upcomingVisit({ id: 'pending-1', status: 'pending_approval', visitor: { id: 'vis3', phone: '9000000002', full_name: 'Pending Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
    ];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    expect(screen.queryByText('Awaiting gate check')).not.toBeInTheDocument();
  });

  it('renders a plural count and an "Open details" link per row', () => {
    const upcoming = [
      upcomingVisit({ id: 'a' }),
      upcomingVisit({ id: 'b', visitor: { id: 'vis3', phone: '9111111111', full_name: 'Second Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
    ];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    expect(screen.getByText('2 visits')).toBeInTheDocument();
    expect(screen.getAllByText('Open details').length).toBe(2);
  });

  it('falls back gracefully when visitor, company and host are missing', () => {
    const upcoming = [
      upcomingVisit({ id: 'bare', visitor: undefined, host: undefined }),
    ];
    expect(() => renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />)).not.toThrow();
    expect(screen.getByText('Host: —')).toBeInTheDocument();
    // With no visitor object, the visitor-name pill row must not render at all.
    expect(screen.queryByText('Acme Co')).not.toBeInTheDocument();
  });

  it('falls back to the raw purpose string for an unrecognized purpose value', () => {
    const upcoming = [upcomingVisit({ purpose: 'unknown_purpose' as unknown as Visit['purpose'] })];
    renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />);
    expect(screen.getByText(/unknown_purpose/)).toBeInTheDocument();
  });

  it('uses created_at when scheduled_for is null and does not crash', () => {
    const createdAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const upcoming = [upcomingVisit({ id: 'no-sched', scheduled_for: null, created_at: createdAt })];
    expect(() => renderWithRouter(<OverviewUpcoming loading={false} upcoming={upcoming} />)).not.toThrow();
    expect(screen.getByText('Upcoming Visitor')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Visit } from '../../../src/types/index';
import OverviewOnSite from '../../../src/pages/HOD/OverviewOnSite';

// OverviewOnSite is a pure presentational sub-component extracted from
// HODOverview.tsx — it takes `loading`/`onSite` as props and does not talk
// to supabase directly. It is defensively mocked below anyway (self-chaining
// channel mock) in case a future change wires it to live data, matching the
// convention used for pages that do own a realtime subscription.
vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = () => 'sub-1';
      return ch;
    },
    removeChannel: () => {},
  },
}));

afterEach(cleanup);

const onSiteVisitor = (overrides: Record<string, unknown> = {}): Visit => ({
  id: 'os1',
  ref_number: 'VIS-100',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'checked_in',
  checked_in_at: new Date().toISOString(),
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  created_at: new Date().toISOString(),
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Onsite Visitor', vendor_name: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
  host: { id: 'h1', full_name: 'Dr. Sharma' },
  ...overrides,
}) as Visit;

describe('OverviewOnSite', () => {
  it('renders the "On-site now" heading', () => {
    render(<OverviewOnSite loading={false} onSite={[]} />);
    expect(screen.getByRole('heading', { name: /On-site now/i })).toBeInTheDocument();
  });

  it('shows the empty state when no one is on site', () => {
    render(<OverviewOnSite loading={false} onSite={[]} />);
    expect(screen.getByText('No one on site right now')).toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    render(<OverviewOnSite loading={true} onSite={[]} />);
    expect(screen.queryByText('No one on site right now')).not.toBeInTheDocument();
  });

  it('renders visitor name, company, and host for checked-in visitors', () => {
    const onSite = [onSiteVisitor()];
    render(<OverviewOnSite loading={false} onSite={onSite} />);
    expect(screen.getByText(/Onsite Visitor/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Co/)).toBeInTheDocument();
    expect(screen.getByText(/Person to Meet: Dr\. Sharma/)).toBeInTheDocument();
    // Empty state must not also render once real rows are present.
    expect(screen.queryByText('No one on site right now')).not.toBeInTheDocument();
  });

  it('does not crash and falls back gracefully when company or host name is missing', () => {
    const onSite = [
      onSiteVisitor({
        id: 'os2',
        visitor: { id: 'vis2', phone: '9123456780', full_name: 'No Company Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
        host: undefined,
      }),
    ];
    expect(() => render(<OverviewOnSite loading={false} onSite={onSite} />)).not.toThrow();
    expect(screen.getByText(/No Company Visitor/)).toBeInTheDocument();
    expect(screen.getByText('Person to Meet: —')).toBeInTheDocument();
  });

  it('renders multiple on-site visitors as separate rows', () => {
    const onSite = [
      onSiteVisitor({ id: 'os1', visitor: { id: 'vis1', phone: '9876543210', full_name: 'First Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
      onSiteVisitor({ id: 'os3', visitor: { id: 'vis3', phone: '9000000000', full_name: 'Second Visitor', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() } }),
    ];
    render(<OverviewOnSite loading={false} onSite={onSite} />);
    expect(screen.getByText(/First Visitor/)).toBeInTheDocument();
    expect(screen.getByText(/Second Visitor/)).toBeInTheDocument();
  });
});

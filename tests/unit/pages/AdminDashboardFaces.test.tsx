import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import AdminDashboard from '../../../src/pages/Admin/AdminDashboard';

// REGRESSION GUARD (client report, 2026-08-17): the admin console showed
// monograms instead of visitor and host photos. useAdminVisits.ts was fixed to
// map photo_data onto photo_url and to select the host's avatar_url — this
// suite checks the fix reaches the screen: a photo renders an <img>, its
// absence still falls back to the initials monogram (never an empty circle).
//
// Harness copied from tests/unit/pages/AdminDashboard.test.tsx: both feeding
// hooks are mocked directly, and the clock is pinned the same way since
// AdminDashboard reads `now` from `useMemo(() => new Date(), [])`.

const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockFeedback = vi.hoisted(() => ({ current: { feedback: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));
vi.mock('../../../src/lib/useVisitFeedback', () => ({
  useVisitFeedback: () => mockFeedback.current,
}));
vi.mock('../../../src/components/VisitorDetails', () => ({ default: () => null }));

const NOW = '2026-08-17T12:00:00Z';

function visitRow(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z', checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
    created_at: '2026-08-17T02:00:00Z', scheduled_for: null, purpose: 'meeting',
    checkin_duration_seconds: null, expected_departure: null, photo_url: undefined,
    visitor: { full_name: 'Someone', phone: '', vendor_name: null, is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '' },
    department: { name: 'HR' }, host: { full_name: 'A Host', avatar_url: undefined },
    ...over,
  };
}

function renderPage() {
  return render(<AdminDashboard />);
}

describe('AdminDashboard faces', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mockVisits.current = { visits: [], loading: false };
    mockFeedback.current = { feedback: [], loading: false };
  });

  it('renders an <img> in the Live Lobby Feed for a checked-in visitor carrying a photo_url', () => {
    mockVisits.current = {
      visits: [visitRow({ id: 'v1', photo_url: 'data:image/jpeg;base64,abc', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } })],
      loading: false,
    };
    renderPage();
    const feedPanel = screen.getByRole('region', { name: 'Live Lobby Feed' });
    // alt="" gives these images role "presentation", not "img", so they are
    // queried directly rather than through getByRole.
    const img = Array.from(feedPanel.querySelectorAll('img')).find((el) => el.src.includes('data:image/jpeg'));
    expect(img).toBeDefined();
  });

  it('falls back to the initials monogram in the Live Lobby Feed when a visitor has no photo_url', () => {
    mockVisits.current = {
      visits: [visitRow({ id: 'v1', photo_url: undefined, visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } })],
      loading: false,
    };
    renderPage();
    const feedPanel = screen.getByRole('region', { name: 'Live Lobby Feed' });
    // Never an empty circle — the initials must be legible text on the row.
    expect(within(feedPanel).getByText('PN')).toBeInTheDocument();
  });

  it('renders an <img> in Top Hosts for a host carrying an avatar_url', () => {
    mockVisits.current = {
      visits: [visitRow({ id: 'v1', host_id: 'hostA', host: { full_name: 'Asha Rao', avatar_url: 'data:image/jpeg;base64,face' } })],
      loading: false,
    };
    renderPage();
    const hostsPanel = screen.getByRole('region', { name: 'Top Hosts Today' });
    const img = Array.from(hostsPanel.querySelectorAll('img')).find((el) => el.src.includes('data:image/jpeg;base64,face'));
    expect(img).toBeDefined();
  });

  it('falls back to the initials monogram in Top Hosts when a host has no avatar_url', () => {
    mockVisits.current = {
      visits: [visitRow({ id: 'v1', host_id: 'hostA', host: { full_name: 'Asha Rao', avatar_url: undefined } })],
      loading: false,
    };
    renderPage();
    const hostsPanel = screen.getByRole('region', { name: 'Top Hosts Today' });
    expect(within(hostsPanel).getByText('AR')).toBeInTheDocument();
  });

  // Load-bearing: the existing AdminDashboard suite counts host-name matches
  // with getAllByText(/Asha Rao|Ben Iyer/) — an avatar alt carrying the host's
  // name would double that count and break it. Every avatar image on this
  // page must render with an empty alt.
  it('gives every avatar <img> on the page alt=""', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'v1', photo_url: 'data:image/jpeg;base64,abc', host_id: 'hostA', host: { full_name: 'Asha Rao', avatar_url: 'data:image/jpeg;base64,face' } }),
      ],
      loading: false,
    };
    const { container } = renderPage();
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => expect(img.getAttribute('alt')).toBe(''));
  });
});

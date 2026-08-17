import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHosts from '../../../src/pages/Admin/AdminHosts';
import { SETTING_DEFAULTS } from '../../../src/lib/appSettings';

// The admin Hosts tab composes four live sources (visits, HODs, departments,
// settings) and derives everything else via lib/adminHosts.ts, which has its
// own unit tests. This suite only needs to prove the page wires those sources
// into the right controls — so every hook is stubbed, the same pattern
// GuardDashboard.test.tsx uses for useTodayVisits.

const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));
const mockHods = vi.hoisted(() => ({ current: { hods: [] as any[], loading: false } }));
const mockDepts = vi.hoisted(() => ({ current: { departments: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));
vi.mock('../../../src/lib/useHods', () => ({
  useHods: () => mockHods.current,
}));
vi.mock('../../../src/lib/useDepartments', () => ({
  useDepartments: () => mockDepts.current,
}));

const mockSaveSettings = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock('../../../src/lib/appSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/appSettings')>();
  return {
    ...actual,
    loadSettings: vi.fn(async () => ({ ...actual.SETTING_DEFAULTS })),
    saveSettings: mockSaveSettings,
  };
});

vi.mock('../../../src/supabaseClient', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin1' } } }) } },
}));

function hostProfile(over: Record<string, any> = {}) {
  return {
    id: 'h1', email: 'h1@x.com', full_name: 'Asha Rao', role: 'hod', department_id: 'd1',
    delegate_id: null, avatar_url: null, created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function department(over: Record<string, any> = {}) {
  return { id: 'd1', name: 'HR', code: 'HR', created_at: '2026-01-01T00:00:00Z', ...over };
}

function arrivalVisit(over: Record<string, any> = {}) {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', status: 'checked_in', checked_in_at: new Date().toISOString(),
    checked_out_at: null, exit_verified: null, rejection_reason: null, carrying_material: false,
    scheduled_for: null, qr_token: 'tok', qr_expires_at: null, created_at: new Date().toISOString(),
    department: department(), host: { id: 'h1', full_name: 'Asha Rao' },
    ...over,
  };
}

function renderPage() {
  return render(<MemoryRouter><AdminHosts /></MemoryRouter>);
}

describe('AdminHosts', () => {
  afterEach(() => {
    cleanup();
    mockVisits.current = { visits: [], loading: false };
    mockHods.current = { hods: [], loading: false };
    mockDepts.current = { departments: [], loading: false };
    mockSaveSettings.mockClear();
  });

  it('renders the Hosts heading and no Add Host control', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Hosts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add host/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Manage in Settings' })).toHaveAttribute(
      'href', '/admin/settings?section=users',
    );
  });

  // Client instruction, 2026-08-17: drop the Historical chip, "it should always
  // reflect latest state". The claim is true by construction — `useAdminVisits`
  // subscribes to postgres_changes on `visits` and reloads silently — and the
  // seven-day window rolls with the IST day rather than being frozen at mount.
  it('carries the Live scope chip, never Historical', () => {
    renderPage();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Historical')).toBeNull();
    // The chip says the data is current; the blurb still names the period, or a
    // reader of "Visitors This Week" has no way to know which week that is.
    expect(screen.getByText(/over the last 7 days/)).toBeInTheDocument();
  });

  it('shows the empty state with zero hosts and "No hosts" rather than 0.0 or NaN', () => {
    renderPage();
    expect(screen.getByText('Total Hosts')).toBeInTheDocument();
    expect(screen.getByText('No hosts')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).toBeNull();
    expect(screen.getByText('No hosts recorded yet.')).toBeInTheDocument();
  });

  it('renders a directory card per host and the department summary row', () => {
    mockHods.current = { hods: [hostProfile()], loading: false };
    mockDepts.current = { departments: [department()], loading: false };
    mockVisits.current = { visits: [arrivalVisit()], loading: false };
    renderPage();

    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getAllByText('HR').length).toBeGreaterThan(0);
    expect(screen.getByText('This week: 1 visit')).toBeInTheDocument();
    expect(screen.getByText('Department Summary')).toBeInTheDocument();
  });

  // THE HOST NOTIFICATIONS PANEL IS GONE (client instruction, 2026-08-18) and
  // its three switches with it. Two were labelled "Recorded — not yet enforced"
  // on the screen itself — no SMS provider, no per-host reminder job — and the
  // third gated nothing: `notifyHostCheckIn` writes an in-app notification on
  // every check-in and never consulted it. Asserted ABSENT rather than deleted
  // silently, because the store behind them (`app_settings`, its `notify.*`
  // rows, `lib/appSettings.ts`) deliberately stays.
  it('renders no host notification panel and no switch of any kind', async () => {
    renderPage();
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText('Host Notifications')).not.toBeInTheDocument();
    for (const label of ['Email on arrival', 'SMS on arrival', 'Auto sign-out reminder']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByText(/Recorded — not yet enforced/)).not.toBeInTheDocument();
  });

  it('never writes a setting from this tab', async () => {
    renderPage();
    await act(async () => { await Promise.resolve(); });
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});

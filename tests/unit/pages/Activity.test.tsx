// TDD: Admin Activity Log — src/pages/Admin/Activity.tsx
// audit_logs.user_id is nullable (system/scheduled actions log a null actor); the page
// used to call .slice() on it unconditionally and would crash. Covers the null-actor
// fallback, the action-label lookup map, and the query-error path.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import ActivityPage from '../../../src/pages/Admin/Activity';

/* ─── Mocks ─────────────────────────────────────────────── */

const state = vi.hoisted(() => ({ rows: [] as any[], error: null as any }));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: state.rows, error: state.error }),
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  state.rows = [];
  state.error = null;
});

afterEach(cleanup);

const log = (over: Partial<any> = {}) => ({
  id: 'l1',
  user_id: 'u1',
  action: 'visit_approved',
  entity_type: 'visit',
  entity_id: 'v1',
  details: { ref_number: 'VIS-001' },
  ip_address: null,
  created_at: '2026-07-29T10:30:00Z',
  profile: { id: 'u1', full_name: 'Asha Rao', email: 'asha@corp.com' },
  ...over,
});

/* ─── Heading ───────────────────────────────────────────── */

describe('Activity — heading', () => {
  it('renders the "Activity Log" heading', async () => {
    render(<ActivityPage />);
    expect(await screen.findByRole('heading', { name: 'Activity Log', level: 1 })).toBeInTheDocument();
  });
});

/* ─── Empty state ───────────────────────────────────────── */

describe('Activity — empty state', () => {
  it('shows "No activity yet" when the query returns no rows', async () => {
    state.rows = [];
    render(<ActivityPage />);
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });
});

/* ─── Data render ───────────────────────────────────────── */

describe('Activity — data render', () => {
  it('renders a row per log with actor name, ref number, and the correct label for each known action', async () => {
    state.rows = [
      log({ id: 'l1', action: 'visit_approved', details: { ref_number: 'VIS-001' } }),
      log({ id: 'l2', action: 'visit_rejected', details: { ref_number: 'VIS-002' } }),
      log({ id: 'l3', action: 'visit_checked_in', details: { ref_number: 'VIS-003' } }),
      log({ id: 'l4', action: 'visit_checked_out', details: { ref_number: 'VIS-004' } }),
    ];
    render(<ActivityPage />);

    expect(await screen.findAllByText('Asha Rao')).toHaveLength(4);
    expect(screen.getByText('Visit Approved')).toBeInTheDocument();
    expect(screen.getByText('Visit Rejected')).toBeInTheDocument();
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
    expect(screen.getByText(/VIS-001/)).toBeInTheDocument();
    expect(screen.getByText(/VIS-002/)).toBeInTheDocument();
    expect(screen.getByText(/VIS-003/)).toBeInTheDocument();
    expect(screen.getByText(/VIS-004/)).toBeInTheDocument();
  });

  it('renders the raw action string for an unrecognised action', async () => {
    state.rows = [log({ id: 'l1', action: 'visit_reassigned' })];
    render(<ActivityPage />);
    expect(await screen.findByText('visit_reassigned')).toBeInTheDocument();
  });

  it('shows the events count chip when logs are present', async () => {
    state.rows = [log({ id: 'l1' }), log({ id: 'l2' })];
    render(<ActivityPage />);
    expect(await screen.findByText('2 events')).toBeInTheDocument();
  });
});

/* ─── Actor fallback ────────────────────────────────────── */

describe('Activity — actor fallback', () => {
  it('shows "System" when user_id is null and there is no joined profile', async () => {
    state.rows = [log({ id: 'l1', user_id: null, profile: undefined })];
    render(<ActivityPage />);
    expect(await screen.findByText('System')).toBeInTheDocument();
  });

  it('falls back to the first 8 chars of user_id when there is no joined profile', async () => {
    state.rows = [log({ id: 'l1', user_id: 'abcdef1234567890', profile: undefined })];
    render(<ActivityPage />);
    expect(await screen.findByText('abcdef12')).toBeInTheDocument();
  });
});

/* ─── Reason line ───────────────────────────────────────── */

describe('Activity — reason line', () => {
  it('shows the "Reason:" line when details.reason is present', async () => {
    state.rows = [log({ id: 'l1', details: { ref_number: 'VIS-001', reason: 'No ID provided' } })];
    render(<ActivityPage />);
    expect(await screen.findByText(/Reason: No ID provided/)).toBeInTheDocument();
  });

  it('does not show a "Reason:" line when details.reason is absent', async () => {
    state.rows = [log({ id: 'l1', details: { ref_number: 'VIS-001' } })];
    render(<ActivityPage />);
    await screen.findByText('Asha Rao');
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument();
  });
});

/* ─── Query error ───────────────────────────────────────── */

describe('Activity — query error', () => {
  it('surfaces a query error and does not show the empty state', async () => {
    state.error = { message: "Could not find the table 'public.audit_logs' in the schema cache" };
    render(<ActivityPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not find the table 'public.audit_logs' in the schema cache",
    );
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
  });
});

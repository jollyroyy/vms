// The CEO's one screen: the queue waiting on them, and what they have
// already decided. `useBlacklistRemovals` is mocked at the module boundary
// (it fetches + subscribes to postgres_changes) and `decideBlacklistRemoval`
// is mocked so these tests pin the UI contract, not the RPC wiring already
// covered by tests/unit/lib/blacklistRemoval.test.ts.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import CeoBlacklistRemovals from '../../../src/pages/CEO/CeoBlacklistRemovals';
import type { BlacklistRemovalRequest } from '../../../src/types/index';

const mockRemovals = vi.hoisted(() => ({
  current: { requests: [] as BlacklistRemovalRequest[], loading: false, error: null as string | null, reload: vi.fn() },
}));
vi.mock('../../../src/lib/useBlacklistRemovals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/useBlacklistRemovals')>();
  return {
    ...actual,
    useBlacklistRemovals: () => mockRemovals.current,
  };
});

const decideBlacklistRemoval = vi.fn(async () => {});
vi.mock('../../../src/lib/blacklistRemoval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/blacklistRemoval')>();
  return {
    ...actual,
    decideBlacklistRemoval: (...args: unknown[]) => decideBlacklistRemoval(...(args as [string, boolean, string])),
  };
});

function request(over: Partial<BlacklistRemovalRequest> = {}): BlacklistRemovalRequest {
  return {
    id: 'r1',
    visitor_id: 'v1',
    requested_by: 'admin1',
    justification: 'Cleared after an internal review of the incident.',
    blacklist_reason: 'Repeated policy violation',
    status: 'pending',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_at: '2026-08-17T08:00:00Z',
    visitor: { id: 'v1', full_name: 'Priya Nair', phone: '9876543210', vendor_name: null, is_blacklisted: true },
    requester: { id: 'admin1', full_name: 'Admin One' },
    ...over,
  };
}

afterEach(() => {
  cleanup();
  mockRemovals.current = { requests: [], loading: false, error: null, reload: vi.fn() };
  decideBlacklistRemoval.mockClear();
});

describe('CeoBlacklistRemovals', () => {
  it('lists a waiting request with the visitor name, the original blacklist reason, and the justification', () => {
    mockRemovals.current = { ...mockRemovals.current, requests: [request()] };
    render(<CeoBlacklistRemovals />);
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    // Snapshotted onto the request, not read off the (possibly since-cleared)
    // visitor row — this is what survives past the moment of approval.
    expect(screen.getByText('Repeated policy violation')).toBeInTheDocument();
    expect(screen.getByText('Cleared after an internal review of the incident.')).toBeInTheDocument();
  });

  it('renders an honest empty state rather than a blank page when nothing is waiting', () => {
    render(<CeoBlacklistRemovals />);
    expect(screen.getByText(/nothing is waiting on you/i)).toBeInTheDocument();
  });

  it('keeps Refuse disabled until a note is typed, and Approve enabled with no note', () => {
    mockRemovals.current = { ...mockRemovals.current, requests: [request()] };
    render(<CeoBlacklistRemovals />);
    expect(screen.getByRole('button', { name: /refuse/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /approve/i })).not.toBeDisabled();
  });

  it('approving with no note calls decideBlacklistRemoval with true and an empty note', async () => {
    mockRemovals.current = { ...mockRemovals.current, requests: [request()] };
    render(<CeoBlacklistRemovals />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(decideBlacklistRemoval).toHaveBeenCalledWith('r1', true, ''));
  });

  it('refusing after typing a note calls decideBlacklistRemoval with false and the note', async () => {
    mockRemovals.current = { ...mockRemovals.current, requests: [request()] };
    render(<CeoBlacklistRemovals />);
    fireEvent.change(screen.getByPlaceholderText(/required when refusing/i), {
      target: { value: 'No corroborating evidence was provided.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /refuse/i }));
    await waitFor(() =>
      expect(decideBlacklistRemoval).toHaveBeenCalledWith('r1', false, 'No corroborating evidence was provided.'),
    );
  });

  // A decided request has left the work queue — it belongs only to the
  // "Already Decided" history below, or the CEO would be shown a decision
  // still asking to be made.
  it('does not list a decided request in the pending queue', () => {
    mockRemovals.current = {
      ...mockRemovals.current,
      requests: [request({ id: 'decided', status: 'approved', decided_at: '2026-08-16T09:00:00Z' })],
    };
    render(<CeoBlacklistRemovals />);
    expect(screen.getByText(/nothing is waiting on you/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
  });
});

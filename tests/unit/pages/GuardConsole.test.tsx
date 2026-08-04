import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

const mockVisitData = vi.hoisted(() => ({ current: [] as any[] }));
const orCalls = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock('../../../src/pages/Guard/CheckInPanel', () => ({
  default: () => <div>CheckInPanel</div>,
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          or: vi.fn((filters: string) => {
            orCalls.current.push(filters);
            return {
              order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
            };
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockVisitData.current = [];
  orCalls.current = [];
});

function visit(overrides: Record<string, any> = {}) {
  return {
    id: 'v1',
    status: 'checked_in',
    created_at: '2026-08-02T04:00:00Z',
    checked_in_at: '2026-08-02T04:05:00Z',
    checked_out_at: null,
    photo_data: null,
    visitor: { full_name: 'Alice Johnson' },
    department: { name: 'Engineering' },
    ...overrides,
  };
}

function renderConsole(initialEntry = '/visitors') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GuardConsole />
    </MemoryRouter>,
  );
}

describe('GuardConsole', () => {
  it('renders the "Visitors" heading', async () => {
    renderConsole();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Visitors');
  });

  it('renders the three primary tabs with count badges', async () => {
    renderConsole();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Walk-ins/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Approved/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Inside/i })).toBeInTheDocument();
    });
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  // "Expected" stopped being a tab: check-in is not one of several things a
  // guard might be doing, it is the thing they are doing. CheckInPanel now sits
  // permanently above the tab bar instead.
  it('renders no "Expected" tab', async () => {
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Inside/i })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Expected/i })).not.toBeInTheDocument();
  });

  // CheckInPanel moved to /guard/pre-approvals (see PreApprovals.tsx) — the
  // console is the walk-in lane and never resolves a booked-in-advance visitor,
  // so it must not render the panel in any mode.
  it('never renders CheckInPanel, in any mode', async () => {
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Walk-ins/i })).toBeInTheDocument());
    expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Approved/i }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Approved/i })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Inside/i }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Inside/i })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
  });

  it('defaults to the "walkins" mode', async () => {
    renderConsole();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Walk-ins/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('clicking Inside switches content and shows a Check Out action', async () => {
    mockVisitData.current = [visit()];
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Inside/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Inside/i }));
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Check Out')).toBeInTheDocument();
    });
  });

  it('clicking Walk-ins shows the walk-in lane', async () => {
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Walk-ins/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Walk-ins/i }));
    await waitFor(() => {
      expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
      expect(screen.getByText('Awaiting host approval')).toBeInTheDocument();
    });
  });

  // "Approved" is the gate's only route into checked_in for a walk-in the host
  // has said yes to — CheckInPanel (the other route) moved to
  // /guard/pre-approvals and only searches pre-approvals.
  it('clicking Approved shows walk-ins the host has approved', async () => {
    mockVisitData.current = [visit({ id: 'v2', status: 'walkin_approved', checked_in_at: null })];
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Approved/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Approved/i }));
    await waitFor(() => {
      expect(screen.getByText('Approved, waiting to enter')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  // Old deep links must degrade onto a live tab rather than 404 into a blank
  // one. Everything that used to mean "expected" now lands on Inside — the
  // check-in flow those links were reaching for is on screen unconditionally.
  describe('legacy tab aliases', () => {
    it.each([
      ['checkin', /Inside/i],
      ['expected', /Inside/i],
      ['no-show', /Inside/i],
      ['rejected', /Inside/i],
      ['all', /Inside/i],
      ['exit', /Inside/i],
      ['checked-out', /Inside/i],
      ['walkins', /Walk-ins/i],
      ['walkin-approved', /Approved/i],
    ])('?tab=%s selects a live tab', async (tab, label) => {
      renderConsole(`/visitors?tab=${tab}`);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
    });
  });

  it('renders no "Also view" secondary filter row (checked-out/declined/all audit views were removed)', async () => {
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Inside/i })).toBeInTheDocument());
    expect(screen.queryByText('Also view')).not.toBeInTheDocument();
    expect(screen.queryByText('Checked out')).not.toBeInTheDocument();
    expect(screen.queryByText('Declined')).not.toBeInTheDocument();
    expect(screen.queryByText('All today')).not.toBeInTheDocument();
  });

  // Guards against the load window silently narrowing back to "today only",
  // which used to drop a walk-in registered at 23:50 and approved at 00:05,
  // and a visitor still inside from the previous evening.
  it('loads visits with a filter covering both today\'s created_at window and the live statuses', async () => {
    renderConsole();
    await waitFor(() => expect(orCalls.current.length).toBeGreaterThan(0));
    expect(orCalls.current[0]).toContain('created_at.gte.');
    expect(orCalls.current[0]).toContain('status.in.(pending_approval,walkin_approved,checked_in)');
  });

  it('shows an empty state when nobody is inside', async () => {
    mockVisitData.current = [];
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: /Inside/i }));
    await waitFor(() => {
      expect(screen.getByText('No one is inside right now.')).toBeInTheDocument();
    });
  });

  // The console must never let a guard mint an entry pass. See the comment
  // block at the top of Console.tsx and canRoleShowPass in lib/passVisibility.ts.
  describe('never offers an entry pass', () => {
    it('renders no badge, QR or print-badge control', async () => {
      mockVisitData.current = [visit()];
      const { container } = renderConsole();
      fireEvent.click(screen.getByRole('tab', { name: /Inside/i }));
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      expect(screen.queryByText(/print badge/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/visitor pass/i)).not.toBeInTheDocument();
      expect(container.querySelector('img[alt*="QR" i]')).toBeNull();
    });
  });
});

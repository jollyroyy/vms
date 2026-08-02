import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardDashboard from '../../../src/pages/Guard/Dashboard';

const mockVisits = vi.hoisted(() => ({ current: [] as Array<{ id: string; status: string }> }));
const mockInside = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/lib/useExpectedToday', () => ({
  useExpectedToday: () => ({ visits: [], loading: false }),
}));

vi.mock('../../../src/lib/useInsideNow', () => ({
  useInsideNow: () => ({ visits: mockInside.current, loading: false }),
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: mockVisits.current, error: null })),
        })),
      })),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

function renderDashboard() {
  return render(<MemoryRouter><GuardDashboard /></MemoryRouter>);
}

describe('GuardDashboard', () => {
  afterEach(() => { cleanup(); mockVisits.current = []; mockInside.current = []; });

  it('renders the page heading without the word "Dashboard"', async () => {
    renderDashboard();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Security Gate');
    expect(screen.queryByText('Dashboard')).toBeNull();
    await waitFor(() => expect(screen.getAllByText('Inside Now').length).toBeGreaterThan(0));
  });

  it('shows zeros when there are no visits today', async () => {
    renderDashboard();
    await waitFor(() => {
      const card = screen.getAllByText('Inside Now')[0].closest('button')!;
      expect(card.textContent).toContain('0');
    });
  });

  it('counts checked-in visitors in the Inside Now card', async () => {
    mockVisits.current = [
      { id: '1', status: 'checked_in' },
      { id: '2', status: 'checked_in' },
      { id: '3', status: 'checked_out' },
    ];
    renderDashboard();
    await waitFor(() => {
      const card = screen.getAllByText('Inside Now')[0].closest('button')!;
      expect(card.textContent).toContain('2');
    });
  });

  it('renders Inside Now as a toggle, not a navigation link', async () => {
    renderDashboard();
    await waitFor(() => {
      const allInsideNow = screen.getAllByText('Inside Now');
      const kpiTile = allInsideNow.find(el => el.closest('button')) || allInsideNow[0];
      expect(kpiTile.closest('a')).toBeNull();
      expect(kpiTile.closest('button')).toBeTruthy();
    });
  });

  it('does not render a Guard Console quick action', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getAllByText('Inside Now').length).toBeGreaterThan(0));
    expect(screen.queryByText('Guard Console')).toBeNull();
    expect(screen.queryByText('Check in / check out visitors')).toBeNull();
    expect(screen.queryByText('View who is currently inside')).toBeNull();
  });

  it('renders a card for each on-site visitor', async () => {
    mockInside.current = [
      {
        id: 'v1',
        ref_number: 'VIS-001',
        status: 'checked_in',
        checked_in_at: '2026-08-02T09:00:00Z',
        checked_out_at: null,
        visitor: { full_name: 'Alice Johnson', company: 'Acme Corp' },
        department: { name: 'Engineering' },
        host: { full_name: 'Bob Smith' },
      } as any,
      {
        id: 'v2',
        ref_number: 'VIS-002',
        status: 'checked_in',
        checked_in_at: '2026-08-02T10:30:00Z',
        checked_out_at: null,
        visitor: { full_name: 'Carol Davis', company: 'Widget Inc' },
        department: { name: 'Sales' },
        host: { full_name: 'David Lee' },
      } as any,
    ];
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeTruthy();
      expect(screen.getByText('Carol Davis')).toBeTruthy();
    });
  });

  it('hides the on-site cards when the Inside Now tile is toggled off', async () => {
    mockInside.current = [
      {
        id: 'v1',
        ref_number: 'VIS-001',
        status: 'checked_in',
        checked_in_at: '2026-08-02T09:00:00Z',
        checked_out_at: null,
        visitor: { full_name: 'Emma Wilson', company: 'Test Ltd' },
        department: { name: 'HR' },
        host: { full_name: 'Frank Brown' },
      } as any,
    ];
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Emma Wilson')).toBeTruthy());
    const toggleButton = screen.getAllByText('Inside Now')[0].closest('button')!;
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Emma Wilson')).toBeNull();
  });
});

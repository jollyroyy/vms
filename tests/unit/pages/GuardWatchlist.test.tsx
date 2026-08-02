import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardWatchlist from '../../../src/pages/Guard/Watchlist';

const mockData = vi.hoisted(() => ({
  entries: [] as any[],
  alerts: [] as any[],
  loading: false,
}));

vi.mock('../../../src/lib/useWatchlist', () => ({
  useWatchlist: () => ({ entries: mockData.entries, alerts: mockData.alerts, loading: mockData.loading }),
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

function renderPage() {
  return render(<MemoryRouter><GuardWatchlist /></MemoryRouter>);
}

describe('GuardWatchlist', () => {
  afterEach(() => {
    cleanup();
    mockData.entries = [];
    mockData.alerts = [];
    mockData.loading = false;
  });

  it('renders the page heading', () => {
    renderPage();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Watchlist & Alerts');
  });

  it('shows calm empty states when there is no data', () => {
    renderPage();
    expect(screen.getByText('No flagged visitors on site today.')).toBeTruthy();
    expect(screen.getByText('No visitors are currently flagged.')).toBeTruthy();
  });

  it('renders flagged visitors', () => {
    mockData.entries = [
      { id: 'v1', full_name: 'John Doe', phone: '9800000001', company: 'Acme', blacklist_reason: 'Trespassing', created_at: '2026-08-01T00:00:00Z' },
    ];
    renderPage();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText(/9800000001/)).toBeTruthy();
    expect(screen.getByText('Trespassing')).toBeTruthy();
  });

  it('renders active alerts with status pill and time', () => {
    mockData.alerts = [
      {
        id: 'visit1',
        status: 'checked_in',
        created_at: '2026-08-02T08:00:00Z',
        checked_in_at: '2026-08-02T08:05:00Z',
        visitor: { id: 'v1', full_name: 'Jane Smith', phone: '9800000002', blacklist_reason: 'Theft' },
      },
    ];
    renderPage();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(screen.getByText('Theft')).toBeTruthy();
    expect(screen.getByText('On-site')).toBeTruthy();
  });

  it('falls back to "Flagged" when blacklist_reason is null', () => {
    mockData.entries = [
      { id: 'v2', full_name: 'No Reason', phone: '9800000003', company: null, blacklist_reason: null, created_at: '2026-08-01T00:00:00Z' },
    ];
    renderPage();
    expect(screen.getByText('Flagged')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('never renders a QR code, badge, or entry pass', () => {
    mockData.entries = [
      { id: 'v1', full_name: 'John Doe', phone: '9800000001', company: 'Acme', blacklist_reason: 'Trespassing', created_at: '2026-08-01T00:00:00Z' },
    ];
    mockData.alerts = [
      {
        id: 'visit1',
        status: 'checked_in',
        created_at: '2026-08-02T08:00:00Z',
        checked_in_at: '2026-08-02T08:05:00Z',
        visitor: { id: 'v1', full_name: 'John Doe', phone: '9800000001', blacklist_reason: 'Trespassing' },
      },
    ];
    const { container } = renderPage();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-testid="badge"]')).toBeNull();
    expect(screen.queryByText(/qr code/i)).toBeNull();
    expect(screen.queryByText(/entry pass/i)).toBeNull();
  });
});

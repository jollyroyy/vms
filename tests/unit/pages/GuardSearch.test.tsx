import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardSearch from '../../../src/pages/Guard/Search';

const mockVisitorRows = vi.hoisted(() => ({ current: [] as Array<{ id: string }> }));
const mockVisitRows = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: async (rows: any[]) => rows,
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;

  const visitsQuery: any = {
    select: vi.fn(() => visitsQuery),
    eq: vi.fn(() => visitsQuery),
    in: vi.fn(() => visitsQuery),
    ilike: vi.fn(() => visitsQuery),
    order: vi.fn(() => visitsQuery),
    limit: vi.fn(() => Promise.resolve({ data: mockVisitRows.current, error: null })),
    then: (resolve: any) => Promise.resolve({ data: mockVisitorRows.current, error: null }).then(resolve),
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'visitors') return visitsQuery;
        return visitsQuery;
      }),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GuardSearch />
    </MemoryRouter>
  );
}

describe('GuardSearch', () => {
  afterEach(() => {
    cleanup();
    mockVisitorRows.current = [];
    mockVisitRows.current = [];
  });

  it('renders the "Search" heading', () => {
    renderAt('/guard/search');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Search');
  });

  it('shows an idle hint before anything is typed', () => {
    renderAt('/guard/search');
    expect(screen.getByText(/Type a name, phone number or reference number/i)).toBeTruthy();
  });

  it('pre-populates the input from the ?q= param', () => {
    renderAt('/guard/search?q=Alice');
    const input = screen.getByPlaceholderText('Name, phone or reference number') as HTMLInputElement;
    expect(input.value).toBe('Alice');
  });

  it('shows which interpretation was used for a name query', async () => {
    renderAt('/guard/search?q=Alice');
    await waitFor(() => expect(screen.getByText(/Searching by: Name/)).toBeTruthy());
  });

  it('renders matching visit results', async () => {
    mockVisitorRows.current = [{ id: 'visitor-1' }];
    mockVisitRows.current = [
      {
        id: 'visit-1',
        ref_number: 'VIS-20260720-0001',
        status: 'checked_in',
        created_at: '2026-08-02T09:00:00Z',
        visitor: { full_name: 'Alice Johnson', phone: '9876543210', vendor_name: 'Acme Corp' },
        department: { name: 'Engineering' },
        host: { full_name: 'Bob Smith' },
      },
    ];
    renderAt('/guard/search?q=Alice');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
  });

  it('shows the no-results empty state when nothing matches', async () => {
    mockVisitorRows.current = [];
    mockVisitRows.current = [];
    renderAt('/guard/search?q=Zed');
    await waitFor(() => expect(screen.getByText(/No matching visits found/i)).toBeTruthy());
  });
});

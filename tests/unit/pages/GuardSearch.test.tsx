import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardSearch from '../../../src/pages/Guard/Search';

const mockVisitorRows = vi.hoisted(() => ({ current: [] as Array<{ id: string }> }));
const mockVisitRows = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: async (rows: any[]) => rows,
}));

// Stub the detail popup — its own contract (approval time, timeline, pass
// gating) is covered by VisitorDetails.test.tsx. This test only needs to
// know the search page opens it with the clicked visit and the given role.
vi.mock('../../../src/components/VisitorDetails', () => ({
  default: ({ visit, viewerRole, onClose }: any) => (
    <div data-testid="visitor-details">
      Details for {visit.visitor?.full_name} (viewer: {String(viewerRole)})
      <button onClick={onClose}>Close</button>
    </div>
  ),
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

const sampleVisit = {
  id: 'visit-1',
  ref_number: 'VIS-20260720-0001',
  status: 'checked_in',
  purpose: 'meeting',
  created_at: '2026-08-02T09:00:00Z',
  scheduled_for: null,
  visitor: { full_name: 'Alice Johnson', phone: '9876543210', vendor_name: 'Acme Corp' },
  department: { name: 'Engineering' },
  host: { full_name: 'Bob Smith' },
};

function renderAt(path: string, role: any = 'guard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GuardSearch role={role} />
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
    expect(screen.getByText(/Type a visitor name, phone number or reference number/i)).toBeTruthy();
  });

  it('pre-populates the input from the ?q= param', () => {
    renderAt('/guard/search?q=Alice');
    const input = screen.getByPlaceholderText('Visitor name, phone or reference number') as HTMLInputElement;
    expect(input.value).toBe('Alice');
  });

  it('shows which interpretation was used for a name query', async () => {
    renderAt('/guard/search?q=Alice');
    await waitFor(() => expect(screen.getByText(/Searching by: Visitor Name/)).toBeTruthy());
  });

  it('shows the no-results empty state when nothing matches', async () => {
    mockVisitorRows.current = [];
    mockVisitRows.current = [];
    renderAt('/guard/search?q=Zed');
    await waitFor(() => expect(screen.getByText(/No matching visits found/i)).toBeTruthy());
  });

  it('renders a full detail card for a name query, not a bare row', async () => {
    mockVisitorRows.current = [{ id: 'visitor-1' }];
    mockVisitRows.current = [sampleVisit];
    renderAt('/guard/search?q=Alice');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('VIS-20260720-0001')).toBeInTheDocument();
  });

  // Client feedback, 2026-08-10: cards must be "one row after another", never
  // a 2-up/3-up grid.
  it('renders the result list as a full-width vertical stack, not a grid', async () => {
    mockVisitorRows.current = [{ id: 'visitor-1' }];
    mockVisitRows.current = [sampleVisit];
    const { container } = renderAt('/guard/search?q=Alice');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
    const list = container.querySelector('[data-card-list]');
    expect(list).not.toBeNull();
    expect(list!.className).not.toMatch(/\bgrid\b/);
    expect(list!.className).toMatch(/flex-col/);
  });

  it('renders a result card for a reference-number query', async () => {
    mockVisitRows.current = [sampleVisit];
    renderAt('/guard/search?q=VIS-20260720-0001');
    await waitFor(() => expect(screen.getByText(/Searching by: Reference number/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
  });

  it('renders a result card for a phone-number query', async () => {
    mockVisitorRows.current = [{ id: 'visitor-1' }];
    mockVisitRows.current = [sampleVisit];
    renderAt('/guard/search?q=9876543210');
    await waitFor(() => expect(screen.getByText(/Searching by: Phone number/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
  });

  it('clicking a result card opens the detail modal with the viewer role', async () => {
    mockVisitorRows.current = [{ id: 'visitor-1' }];
    mockVisitRows.current = [sampleVisit];
    renderAt('/guard/search?q=Alice', 'hod');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice Johnson'));
    expect(screen.getByTestId('visitor-details')).toBeInTheDocument();
    expect(screen.getByText('Details for Alice Johnson (viewer: hod)')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

// The KPI rail and the card-return check-out gate, isolated from the segment
// behaviour GuardConsole.test.tsx covers â€” one behaviour per file.
const mockVisitData = vi.hoisted(() => ({ current: [] as any[] }));
const updateCalls = vi.hoisted(() => ({ current: [] as any[] }));

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
          or: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
          })),
        })),
        update: vi.fn((payload: any) => {
          updateCalls.current.push(payload);
          return { eq: vi.fn(() => Promise.resolve({ error: null })) };
        }),
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
  updateCalls.current = [];
});

function istToday(): string {
  const ist = new Date(Date.now() + (5 * 60 + 30) * 60_000);
  return ist.toISOString().slice(0, 10);
}

function visit(overrides: Record<string, any> = {}) {
  return {
    id: 'v1',
    ref_number: 'VIS-0001',
    status: 'checked_in',
    purpose: 'meeting',
    created_at: `${istToday()}T04:00:00Z`,
    checked_in_at: `${istToday()}T04:05:00Z`,
    checked_out_at: null,
    scheduled_for: null,
    photo_data: null,
    visitor_card_number: 'C-104',
    visitor: { full_name: 'Alice Johnson', phone: '9876543210', vendor_name: 'Acme' },
    department: { name: 'Engineering' },
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/visitors" element={<GuardConsole />} />
        <Route path="/visitors/:segment" element={<GuardConsole />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuardConsole â€” KPI rail', () => {
  it('counts each tile from the loaded array, not a second query', async () => {
    mockVisitData.current = [
      visit(),
      visit({ id: 'v2', status: 'checked_out', checked_out_at: `${istToday()}T06:00:00Z` }),
      visit({ id: 'v3', status: 'approved', checked_in_at: null, scheduled_for: `${istToday()}T05:00:00Z` }),
    ];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getAllByText('Alice Johnson')).toHaveLength(3));

    expect(within(screen.getByRole('button', { name: /Currently Inside/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Checked Out/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Booked ahead, not yet arrived/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /All Visitors/i })).getByText('3')).toBeInTheDocument();
  });

  it('marks the tile of the current segment as expanded', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Currently Inside/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /All Visitors/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the walk-in register tile without a numeral â€” it is an action, not a count', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const register = screen.getByRole('button', { name: /Walk-in Register/i });
    expect(register).toBeInTheDocument();
    expect(within(register).queryByText(/\d/)).toBeNull();
  });

  // Two-up square tiles, so all eight segments stay in view beside the list
  // they filter. One-per-row pushed Checked Out and the walk-in register past
  // the fold of a gate terminal — a filter rail you have to scroll to reach is
  // not doing its job. The qualifier survives as sr-only rather than being
  // dropped: "Expected" alone is ambiguous read aloud, and the accessible name
  // is the only place that context can live once the square cannot print it.
  it('renders square compact tiles whose qualifier is in the name but not on the face', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const expected = screen.getByRole('button', { name: /Booked ahead, not yet arrived/i });
    expect(expected).toHaveClass('kpi-tile-compact');

    const qualifier = within(expected).getByText('Booked ahead, not yet arrived');
    expect(qualifier).toHaveClass('sr-only');
  });

  it('navigates to the segment URL when a tile is clicked', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /All Visitors/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Visitors'));

    fireEvent.click(screen.getByRole('button', { name: /Booked ahead, not yet arrived/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Expected Visitors'));
  });
});

describe('GuardConsole â€” card-return check-out gate', () => {
  // The whole point of the gate: the guard sees the exact card they must
  // collect, and the check-out cannot complete until it is ticked back.
  it('shows the card number and refuses to check out until the card is ticked', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));
    await waitFor(() => expect(screen.getByText('Confirm check-out')).toBeInTheDocument());
    expect(screen.getByText('C-104')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Complete Check Out' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/card collected from visitor/i));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(updateCalls.current.length).toBeGreaterThan(0));
    const write = updateCalls.current[0];
    expect(write.status).toBe('checked_out');
    expect(write.exit_verified).toBe(true);
    expect(write.visitor_card_returned_at).toBeTruthy();
    expect(write.checked_out_at).toBeTruthy();
  });

  it('a visitor with no card on record has nothing to collect â€” no checkbox, direct confirm', async () => {
    mockVisitData.current = [visit({ visitor_card_number: null })];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));
    await waitFor(() => expect(screen.getByText('Confirm check-out')).toBeInTheDocument());
    expect(screen.getByText('No card on record')).toBeInTheDocument();
    expect(screen.queryByLabelText('Card collected from visitor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Complete Check Out' }));
    await waitFor(() => expect(updateCalls.current.length).toBeGreaterThan(0));
    expect(updateCalls.current[0].visitor_card_returned_at).toBeNull();
  });

  it('undo clears the returned-at stamp along with the check-out', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));
    fireEvent.click(screen.getByLabelText(/card collected from visitor/i));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Check Out' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo check-out' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Undo check-out' }));

    await waitFor(() => expect(updateCalls.current.length).toBeGreaterThan(1));
    const undo = updateCalls.current[1];
    expect(undo.status).toBe('checked_in');
    expect(undo.checked_out_at).toBeNull();
    expect(undo.visitor_card_returned_at).toBeNull();
  });
});
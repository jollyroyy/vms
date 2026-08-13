import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
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

beforeEach(() => {
  // Frozen at midday IST. These fixtures are anchored to "today", and since
  // migration 075 ended the IST day at 22:00 they stop being due today for the
  // last two hours of every real day — the suite used to pass all day and fail
  // each evening. See tests/unit/helpers/istClock.ts.
  freezeIstClock();
});

afterEach(() => {
  unfreezeIstClock();
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

    expect(within(screen.getByRole('button', { name: /Checked Out/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Booked ahead, not yet arrived/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /All Visitors/i })).getByText('3')).toBeInTheDocument();
  });

  // The board carries no Currently Inside tile (client instruction,
  // 2026-08-13). The SEGMENT is untouched — /visitors/inside still routes, still
  // lists and is still the only place a guard can check a visitor out (the
  // check-out suite below renders there) — it is the tile that went.
  it('has no Currently Inside tile on the board', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /Currently Inside/i })).toBeNull();
  });

  it('still lists and checks out the Inside segment with no tile for it', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inside'));

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check Out/i })).toBeInTheDocument();
  });

  it('marks the tile of the current segment as expanded', async () => {
    mockVisitData.current = [
      visit({ status: 'approved', checked_in_at: null, scheduled_for: `${istToday()}T05:00:00Z` }),
    ];
    renderAt('/visitors/expected');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Booked ahead, not yet arrived/i }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /All Visitors/i })).toHaveAttribute('aria-expanded', 'false');
  });

  // All Visitors carries no icon plate (client instruction, 2026-08-13). It is
  // the board's "no filter" tile — the glyph was a list icon standing for
  // "everything", which is what the label already says, and it read as a menu
  // affordance the tile does not have. Every other tile keeps its plate: those
  // glyphs distinguish one lane from another.
  it('renders the All Visitors tile with no icon plate, while the others keep theirs', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const all = screen.getByRole('button', { name: /All Visitors/i });
    expect(all.querySelector('.kpi-plate')).toBeNull();

    const expected = screen.getByRole('button', { name: /Booked ahead, not yet arrived/i });
    expect(expected.querySelector('.kpi-plate')).not.toBeNull();
  });

  it('renders the walk-in register tile without a numeral â€” it is an action, not a count', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const register = screen.getByRole('button', { name: /Walk-in Register/i });
    expect(register).toBeInTheDocument();
    expect(within(register).queryByText(/\d/)).toBeNull();
  });

  // Full-width board on TOP of the list, at the dashboard's size and shape
  // (client instruction, 2026-08-13). It used to be a 300px right-hand column
  // of square `compact` tiles — the same card in two sizes on two screens, so
  // a guard re-learned it on each. Now the qualifier prints on the tile face
  // again instead of surviving only in the accessible name.
  it('renders full-size tiles with the qualifier visible on the face', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const expected = screen.getByRole('button', { name: /Booked ahead, not yet arrived/i });
    expect(expected).not.toHaveClass('kpi-tile-compact');

    const qualifier = within(expected).getByText('Booked ahead, not yet arrived');
    expect(qualifier).not.toHaveClass('sr-only');
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
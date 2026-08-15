import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

// The KPI rail, isolated from the segment behaviour GuardConsole.test.tsx
// covers â€” one behaviour per file.
const mockVisitData = vi.hoisted(() => ({ current: [] as any[] }));

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
      visit({ id: 'v3', status: 'pending_approval', checked_in_at: null }),
    ];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getAllByText('Alice Johnson')).toHaveLength(3));

    // No Checked Out tile and no Expected tile on the board (both removed
    // 2026-08-15, client instruction) — a departed visitor is the Entry & Exit
    // tab's subject now, and an arrival not yet through the gate is the
    // Pre-Registered tab's.
    expect(screen.queryByRole('button', { name: /Checked Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Booked ahead, not yet arrived/i })).not.toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Walk-ins waiting on a host/i })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /All Visitors/i })).getByText('3')).toBeInTheDocument();
  });

  // The board carries no Currently Inside tile (client instruction,
  // 2026-08-13). The SEGMENT is untouched — /visitors/inside still routes and
  // still lists — it is the tile that went. The segment lists only: check-out
  // lives on the Inside Now tab (/guard/inside-now), so a card here carries no
  // button (client instruction, 2026-08-14).
  it('has no Currently Inside tile on the board', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /Currently Inside/i })).toBeNull();
  });

  it('still lists the Inside segment with no tile for it — and no check-out button', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inside'));

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('marks the tile of the current segment as expanded', async () => {
    mockVisitData.current = [
      visit({ status: 'pending_approval', checked_in_at: null }),
    ];
    renderAt('/visitors/pending');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Walk-ins waiting on a host/i }))
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

    const pending = screen.getByRole('button', { name: /Walk-ins waiting on a host/i });
    expect(pending.querySelector('.kpi-plate')).not.toBeNull();
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

    const pending = screen.getByRole('button', { name: /Walk-ins waiting on a host/i });
    expect(pending).not.toHaveClass('kpi-tile-compact');

    const qualifier = within(pending).getByText('Walk-ins waiting on a host');
    expect(qualifier).not.toHaveClass('sr-only');
  });

  it('navigates to the segment URL when a tile is clicked', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /All Visitors/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Visitors'));

    fireEvent.click(screen.getByRole('button', { name: /Walk-ins waiting on a host/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pending Approval'));
  });
});
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

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
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
          })),
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
      expect(screen.getByRole('tab', { name: /Expected/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Walk-ins/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Inside/i })).toBeInTheDocument();
    });
  });

  it('defaults to the "expected" mode, rendering CheckInPanel', async () => {
    renderConsole();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Expected/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('CheckInPanel')).toBeInTheDocument();
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

  describe('legacy tab aliases', () => {
    it('?tab=checkin lands on the "expected" mode', async () => {
      renderConsole('/visitors?tab=checkin');
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Expected/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('CheckInPanel')).toBeInTheDocument();
      });
    });

    it('?tab=exit lands on the "inside" mode', async () => {
      renderConsole('/visitors?tab=exit');
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Inside/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('On the premises')).toBeInTheDocument();
      });
    });

    it('?tab=no-show lands on the "expected" mode (nearest live tab; "all" was removed)', async () => {
      renderConsole('/visitors?tab=no-show');
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Expected/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('CheckInPanel')).toBeInTheDocument();
      });
    });

    it('?tab=checked-out lands on the "inside" mode (nearest live tab)', async () => {
      renderConsole('/visitors?tab=checked-out');
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Inside/i })).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('?tab=rejected lands on the "expected" mode (nearest live tab)', async () => {
      renderConsole('/visitors?tab=rejected');
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Expected/i })).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  it('renders no "Also view" secondary filter row (checked-out/declined/all audit views were removed)', async () => {
    renderConsole();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Expected/i })).toBeInTheDocument());
    expect(screen.queryByText('Also view')).not.toBeInTheDocument();
    expect(screen.queryByText('Checked out')).not.toBeInTheDocument();
    expect(screen.queryByText('Declined')).not.toBeInTheDocument();
    expect(screen.queryByText('All today')).not.toBeInTheDocument();
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

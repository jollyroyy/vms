import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

const mockExportCsv = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());
const mockVisitData = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
}));

vi.mock('../../../src/supabaseClient', () => {
  const fromMock = vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      in: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        gte: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        })),
      })),
      gte: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        lte: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
      })),
    })),
  }));
  return {
    supabase: {
      from: fromMock,
      channel: mockChannel,
      removeChannel: vi.fn(),
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ error: null })),
          createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'http://example.com/photo.webp' }, error: null })),
        })),
      },
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user', app_metadata: { role: 'guard', department_id: 'dept1' } } }, error: null })),
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      },
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

describe('M12-GUARD: GuardConsole', () => {
  it('renders header', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Guard Console')).toBeInTheDocument();
    });
  });

  it('shows check-in and log-out buttons', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Check In')).toBeInTheDocument();
      expect(screen.getByText('Check Out')).toBeInTheDocument();
    });
  });

  it('shows search input by default', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by phone or name...')).toBeInTheDocument();
    });
  });

  it('shows empty state when no one inside', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    fireEvent.click(screen.getByText('Check Out'));
    await waitFor(() => {
      expect(screen.getByText('No one inside right now.')).toBeInTheDocument();
    });
  });

  it('switches between check-in and log-out modes', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by phone or name...')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Check Out'));
    await waitFor(() => {
      expect(screen.getByText('No one inside right now.')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Check In'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by phone or name...')).toBeInTheDocument();
    });
  });

  describe('Inside card', () => {
    it('shows the count of people inside', async () => {
      mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
      mockSubscribe.mockReturnValue('sub-1');
      render(<MemoryRouter><GuardConsole /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('People Inside')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    it('shows empty state when expanded with no visitors', async () => {
      mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
      mockSubscribe.mockReturnValue('sub-1');
      render(<MemoryRouter><GuardConsole /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('People Inside')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('People Inside').closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('No visitors checked in')).toBeInTheDocument();
      });
    });

    it('shows visitor details when expanded with data', async () => {
      mockVisitData.current = [
        {
          id: 'v1', status: 'checked_in', checked_in_at: new Date(Date.now() - 3600000).toISOString(),
          visitor: { full_name: 'Alice Johnson' },
          department: { name: 'Engineering' },
          photo_url: null,
        },
        {
          id: 'v2', status: 'checked_in', checked_in_at: new Date(Date.now() - 36000000).toISOString(),
          visitor: { full_name: 'Bob Smith' },
          department: { name: 'Marketing' },
          photo_url: null,
        },
      ];
      mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
      mockSubscribe.mockReturnValue('sub-1');
      render(<MemoryRouter><GuardConsole /></MemoryRouter>);
      await waitFor(() => {
        const twos = screen.getAllByText('2');
        expect(twos.length).toBeGreaterThanOrEqual(1);
      });
      const btn = screen.getByText('People Inside').closest('button')!;
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Over 9h').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Engineering').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('toggles the list on repeated clicks', async () => {
      mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
      mockSubscribe.mockReturnValue('sub-1');
      render(<MemoryRouter><GuardConsole /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('People Inside')).toBeInTheDocument();
      });
      const btn = screen.getByText('People Inside').closest('button')!;
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('No visitors checked in')).toBeInTheDocument();
      });
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.queryByText('No visitors checked in')).not.toBeInTheDocument();
      });
    });
  });
});

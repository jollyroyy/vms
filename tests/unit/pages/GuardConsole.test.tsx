import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

const mockExportCsv = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
}));

function mockResolved(data: any) {
  return vi.fn().mockResolvedValue(data);
}

vi.mock('../../../src/supabaseClient', () => {
  const chainable: any = {};
  const handler = {
    get(_target: any, prop: string) {
      if (prop === 'then') return (cb: any) => cb({ data: [], error: null });
      if (prop === 'subscribe') return vi.fn().mockReturnValue('sub-1');
      chainable[prop] = handler;
      return handler;
    }
  };
  handler.get = handler.get.bind(handler);

  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            gte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            lte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
      })),
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

  it('shows tabs', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Check In')).toBeInTheDocument();
      expect(screen.getByText("Today's Visits")).toBeInTheDocument();
      expect(screen.getByText('Log Exit')).toBeInTheDocument();
    });
  });

  it('shows Export CSV button', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    });
  });

  it('shows empty state in today tab when no visits', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    fireEvent.click(screen.getByText("Today's Visits"));
    await waitFor(() => {
      expect(screen.getByText('No visits today yet')).toBeInTheDocument();
    });
  });

  it('shows error when log exit clicked on non-checked-in visit', async () => {
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    fireEvent.click(screen.getByText('Log Exit'));
    await waitFor(() => {
      expect(screen.getByText('No checked-in visitors')).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../../src/pages/Shared/Reports';

const mockOrder = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());
const mockAttachVisitActors = vi.hoisted(() => vi.fn((rows: any[]) => Promise.resolve(rows)));

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'gate_passes') {
        return { select: () => ({ eq: () => ({ in: mockIn }) }) };
      }
      return { select: () => ({ gte: () => ({ lte: () => ({ order: mockOrder }) }) }) };
    },
  },
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: mockAttachVisitActors,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Two departments so the filter has something real to narrow between: two
// visits in IT, one in Finance.
const mockVisits = [
  {
    id: 'v1', ref_number: 'VIS-101', visitor_id: 'vis1', department_id: 'd1', host_id: 'h1',
    status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
    checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
    visitor: { id: 'vis1', full_name: 'Ivy Tech', phone: '9876500001', vendor_name: 'Acme' },
    department: { id: 'd1', name: 'IT', code: 'IT' },
    host: { id: 'h1', full_name: 'Host One' },
  },
  {
    id: 'v2', ref_number: 'VIS-102', visitor_id: 'vis2', department_id: 'd1', host_id: 'h1',
    status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
    checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
    visitor: { id: 'vis2', full_name: 'Ian Systems', phone: '9876500002', vendor_name: 'Acme' },
    department: { id: 'd1', name: 'IT', code: 'IT' },
    host: { id: 'h1', full_name: 'Host One' },
  },
  {
    id: 'v3', ref_number: 'VIS-103', visitor_id: 'vis3', department_id: 'd2', host_id: 'h2',
    status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
    checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
    visitor: { id: 'vis3', full_name: 'Fiona Ledger', phone: '9876500003', vendor_name: 'Beta' },
    department: { id: 'd2', name: 'Finance', code: 'FIN' },
    host: { id: 'h2', full_name: 'Host Two' },
  },
];

async function renderLoaded(): Promise<void> {
  mockOrder.mockResolvedValue({ data: mockVisits, error: null });
  mockIn.mockResolvedValue({ data: [], error: null });
  render(<MemoryRouter><ReportsPage /></MemoryRouter>);
  await waitFor(() => {
    expect(screen.getByText('Ivy Tech')).toBeInTheDocument();
  });
}

describe('M12-REPORTS: Reports department filter integration', () => {
  it('renders all three visitors and the (3 entries) chip initially', async () => {
    await renderLoaded();
    expect(screen.getByText('Ian Systems')).toBeInTheDocument();
    expect(screen.getByText('Fiona Ledger')).toBeInTheDocument();
    expect(screen.getByText(/\(3 entries\)/)).toBeInTheDocument();
  });

  it('shows the department filter trigger defaulting to "All Departments"', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: /filter by department/i })).toHaveTextContent('All Departments');
  });

  it('filtering to Finance leaves only the Finance visitor', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /filter by department/i }));
    const listbox = screen.getByRole('listbox', { name: /departments/i });
    fireEvent.click(within(listbox).getByText('Finance'));

    await waitFor(() => {
      expect(screen.queryByText('Ivy Tech')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Ian Systems')).not.toBeInTheDocument();
    expect(screen.getByText('Fiona Ledger')).toBeInTheDocument();
  });

  it('reflects the filtered count and department name in the heading/chip', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /filter by department/i }));
    const listbox = screen.getByRole('listbox', { name: /departments/i });
    fireEvent.click(within(listbox).getByText('Finance'));

    await waitFor(() => {
      expect(screen.getByText(/\(1 entries\)/)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Finance/).length).toBeGreaterThan(0);
  });

  it('exports only the filtered rows to CSV with a department-tagged filename', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /filter by department/i }));
    const listbox = screen.getByRole('listbox', { name: /departments/i });
    fireEvent.click(within(listbox).getByText('Finance'));

    await waitFor(() => {
      expect(screen.queryByText('Ivy Tech')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockExportCsv).toHaveBeenCalledTimes(1);
    const [rows, filename] = mockExportCsv.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]['Visitor Name']).toBe('Fiona Ledger');
    expect(filename).toMatch(/fin|finance/i);
  });

  it('clearing the filter restores all three rows', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /filter by department/i }));
    const listbox = screen.getByRole('listbox', { name: /departments/i });
    fireEvent.click(within(listbox).getByText('Finance'));

    await waitFor(() => {
      expect(screen.queryByText('Ivy Tech')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /clear department filter/i }));

    await waitFor(() => {
      expect(screen.getByText('Ivy Tech')).toBeInTheDocument();
    });
    expect(screen.getByText('Ian Systems')).toBeInTheDocument();
    expect(screen.getByText('Fiona Ledger')).toBeInTheDocument();
    expect(screen.getByText(/\(3 entries\)/)).toBeInTheDocument();
  });
});

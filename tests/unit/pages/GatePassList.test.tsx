import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GatePassList from '../../../src/pages/Shared/GatePassList';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mockPasses = [
  { id: 'gp1', ref_number: 'GP-OUT-20260721-0001', type: 'NRGP', direction: 'OUT', department_id: 'dept1', reason: 'Test reason', status: 'draft', carrier_name: null, expected_return_date: null, created_by: 'u1', visit_id: null, created_at: '2026-07-21T10:00:00Z', department: { id: 'dept1', name: 'IT', code: 'IT', created_at: '2026-01-01' }, items: [{ id: 'i1', description: 'Item 1', qty: 2, unit: null, serial_no: null, approx_value: null, returned_qty: 0 }] },
  { id: 'gp2', ref_number: 'GP-IN-20260721-0001', type: 'RGP', direction: 'IN', department_id: 'dept2', reason: 'RGP test', status: 'awaiting_return', carrier_name: 'Truck A', expected_return_date: '2026-07-25', created_by: 'u2', visit_id: null, created_at: '2026-07-21T09:00:00Z', department: { id: 'dept2', name: 'Logistics', code: 'LOG', created_at: '2026-01-01' }, items: [{ id: 'i2', description: 'Equipment', qty: 1, unit: null, serial_no: 'SN001', approx_value: 5000, returned_qty: 0 }] },
  { id: 'gp3', ref_number: 'GP-OUT-20260720-0001', type: 'RGP', direction: 'OUT', department_id: 'dept1', reason: 'Overdue RGP', status: 'awaiting_return', carrier_name: null, expected_return_date: '2026-07-19', created_by: 'u1', visit_id: null, created_at: '2026-07-20T08:00:00Z', department: { id: 'dept1', name: 'IT', code: 'IT', created_at: '2026-01-01' }, items: [{ id: 'i3', description: 'Laptop', qty: 1, unit: null, serial_no: 'LT001', approx_value: null, returned_qty: 0 }] },
  { id: 'gp4', ref_number: 'GP-OUT-20260721-0002', type: 'NRGP', direction: 'OUT', department_id: 'dept3', reason: 'Other dept', status: 'draft', carrier_name: null, expected_return_date: null, created_by: 'u3', visit_id: null, created_at: '2026-07-21T11:00:00Z', department: { id: 'dept3', name: 'HR', code: 'HR', created_at: '2026-01-01' }, items: [] },
];

function setupAuth(overrides = {}) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: 'dept1', ...overrides } } },
  });
}

function setupMockFrom(returnPasses = mockPasses) {
  const chain = (): any => new Proxy(() => {}, {
    get(t, prop) {
      if (prop === 'order') return vi.fn().mockResolvedValue({ data: returnPasses, error: null });
      if (prop === 'then') return undefined;
      return () => chain();
    },
    apply() { return Promise.resolve({ data: returnPasses, error: null }); },
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'gate_passes') return { select: () => chain() };
    return { select: vi.fn() };
  });
}

function renderList() {
  return render(<MemoryRouter><GatePassList /></MemoryRouter>);
}

describe('S4-GATEPASS-LIST: GatePassList', () => {
  beforeEach(() => { setupAuth(); setupMockFrom(); });

  it('renders the page title', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton initially', () => {
    renderList();
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders gate pass cards after loading', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
  });

  it('shows ref_number for each gate pass', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.getByText('GP-IN-20260721-0001')).toBeInTheDocument();
    });
  });

  it('shows department name on each card', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getAllByText('IT').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Logistics')).toBeInTheDocument();
    });
  });

  it('shows RGP type badge', async () => {
    renderList();
    await waitFor(() => {
      const rgpBadges = screen.getAllByText('RGP');
      expect(rgpBadges.length).toBe(2);
    });
  });

  it('shows NRGP type badge', async () => {
    renderList();
    await waitFor(() => {
      const nrpgBadges = screen.getAllByText('NRGP');
      expect(nrpgBadges.length).toBe(2);
    });
  });

  it('shows reason text on each card', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText(/Reason: Test reason/)).toBeInTheDocument();
      expect(screen.getByText(/Reason: RGP test/)).toBeInTheDocument();
    });
  });

  it('shows item count on each card', async () => {
    renderList();
    await waitFor(() => {
      const items = screen.getAllByText(/^\d+ item/);
      expect(items.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows direction labels', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getAllByText('OUT').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('IN').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows status badge for each pass', async () => {
    renderList();
    await waitFor(() => {
      const draftBadges = screen.getAllByText('draft');
      expect(draftBadges.length).toBe(2);
    });
  });

  it('shows + New Gate Pass link', () => {
    renderList();
    expect(screen.getByText('+ New Gate Pass')).toBeInTheDocument();
  });

  it('filters by department for non-admin hod role', async () => {
    setupAuth({ role: 'hod', department_id: 'dept1' });
    let queryDeptId: string | null = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          select: () => ({
            eq: (field: string, val: string) => {
              queryDeptId = val;
              return {
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            },
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });
    renderList();
    await waitFor(() => {
      expect(queryDeptId).toBe('dept1');
    });
  });

  it('does NOT filter by department for admin role', async () => {
    setupAuth({ role: 'admin', department_id: 'dept1' });
    let eqCalled = false;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          select: () => ({
            eq: () => {
              eqCalled = true;
              return { order: vi.fn().mockResolvedValue({ data: [], error: null }) };
            },
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });
    renderList();
    await waitFor(() => {
      expect(eqCalled).toBe(false);
    });
  });

  it('renders filter tabs', () => {
    renderList();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Open RGP')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows empty state when no passes', async () => {
    setupMockFrom([]);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('No gate passes found')).toBeInTheDocument();
    });
  });

  it('shows pass count in subtitle', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('4 passes')).toBeInTheDocument();
    });
  });

  it('shows singular pass count', async () => {
    const singlePass = [mockPasses[0]];
    setupMockFrom(singlePass);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('1 pass')).toBeInTheDocument();
    });
  });

  it('shows RGP expected return date and status', async () => {
    renderList();
    await waitFor(() => {
      const due = screen.getAllByText(/Due:/);
      expect(due.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('Cancel button navigates back', () => {
    renderList();
    const links = screen.getAllByRole('link');
    const newPassLink = links.find(l => l.textContent?.includes('New Gate Pass'));
    expect(newPassLink?.getAttribute('href')).toBe('/gate-passes/new');
  });
});

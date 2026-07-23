import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GatePassQueue from '../../../src/pages/Guard/GatePassQueue';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

vi.mock('../../../src/components/gatePass/GateSignoffPanel', () => ({
  default: ({ pass, onClose }: any) => (
    <div data-testid="signoff-panel">
      <span data-testid="signoff-pass-ref">{pass.ref_number}</span>
      <span>Verify Items</span>
      <button data-testid="signoff-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mockPasses = [
  {
    id: 'gp1', ref_number: 'GP-OUT-20260721-0001', type: 'NRGP', direction: 'OUT',
    department_id: 'dept1', reason: 'Deliver equipment', status: 'approved',
    carrier_name: 'John', company_name: 'Tech Corp', expected_return_date: null,
    created_by: 'u1', visit_id: null, created_at: '2026-07-21T10:00:00Z',
    department: { id: 'dept1', name: 'IT' },
    items: [{ id: 'i1', description: 'Laptop', qty: 2, unit: null, serial_no: 'SN001', approx_value: null, returned_qty: 0 }],
  },
  {
    id: 'gp2', ref_number: 'GP-OUT-20260721-0002', type: 'RGP', direction: 'OUT',
    department_id: 'dept1', reason: 'Rental equipment', status: 'approved',
    carrier_name: 'Mike', company_name: 'Rentals Ltd', expected_return_date: '2026-07-28',
    created_by: 'u1', visit_id: null, created_at: '2026-07-21T09:00:00Z',
    department: { id: 'dept1', name: 'IT' },
    items: [{ id: 'i2', description: 'Projector', qty: 1, unit: null, serial_no: 'SN002', approx_value: null, returned_qty: 0 }],
  },
  {
    id: 'gp3', ref_number: 'GP-IN-20260720-0001', type: 'RGP', direction: 'IN',
    department_id: 'dept2', reason: 'Return shipment', status: 'awaiting_return',
    carrier_name: null, company_name: null, expected_return_date: '2026-07-25',
    created_by: 'u2', visit_id: null, created_at: '2026-07-20T08:00:00Z',
    department: { id: 'dept2', name: 'Logistics' },
    items: [{ id: 'i3', description: 'Container', qty: 1, unit: null, serial_no: null, approx_value: null, returned_qty: 0 }],
  },
];

function setupAuth(overrides = {}) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'guard1', app_metadata: { role: 'guard', ...overrides } } },
  });
}

function setupMockFrom(returnPasses = mockPasses) {
  const gatePassesRef = { current: [...returnPasses] };
  function buildPromise() {
    const p = Promise.resolve().then(() => ({ data: gatePassesRef.current, error: null }));
    (p as any).eq = (col: string, val: string) => {
      gatePassesRef.current = gatePassesRef.current.filter((x: any) => x[col] === val);
      return buildPromise();
    };
    (p as any).in = (col: string, vals: string[]) => {
      gatePassesRef.current = gatePassesRef.current.filter((x: any) => vals.includes(x[col]));
      return buildPromise();
    };
    return p;
  }
  const chain: any = {};
  chain.select = () => chain;
  chain.order = () => buildPromise();

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gate_passes') { gatePassesRef.current = [...returnPasses]; return { select: () => chain }; }
    return { select: vi.fn() };
  });
}

function renderQueue() {
  return render(<MemoryRouter><GatePassQueue /></MemoryRouter>);
}

describe('GuardGatePassQueue', () => {
  beforeEach(() => { setupAuth(); setupMockFrom(); });

  it('renders the page title', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('Gate Pass Queue')).toBeInTheDocument();
    });
  });

  it('renders filter tabs', () => {
    renderQueue();
    expect(screen.getByText('All Ready')).toBeInTheDocument();
    expect(screen.getByText('RGP Out')).toBeInTheDocument();
    expect(screen.getByText('NRGP')).toBeInTheDocument();
    expect(screen.getByText('Returns')).toBeInTheDocument();
  });

  it('shows loading skeleton initially', () => {
    renderQueue();
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders pass cards after loading', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
  });

  it('shows pass count in subtitle', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText(/2 ready passes/)).toBeInTheDocument();
    });
  });

  it('shows type badges', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getAllByText('RGP').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('NRGP').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows department name on each card', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getAllByText('IT').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows carrier and company when present', async () => {
    const { container } = renderQueue();
    await waitFor(() => {
      expect(container.textContent).toContain('John');
      expect(container.textContent).toContain('Tech Corp');
      expect(container.textContent).toContain('Mike');
      expect(container.textContent).toContain('Rentals Ltd');
    });
  });

  it('shows item descriptions on cards', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
      expect(screen.getByText('Projector')).toBeInTheDocument();
    });
  });

  it('shows expected return date for RGP passes', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText(/Expected return:/)).toBeInTheDocument();
    });
  });

  it('shows status badge', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getAllByText('approved').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows direction indicator', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getAllByText('OUT').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('filters passes by search query', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Rentals' } });
    await waitFor(() => {
      expect(screen.queryByText('GP-OUT-20260721-0001')).not.toBeInTheDocument();
      expect(screen.getByText('GP-OUT-20260721-0002')).toBeInTheDocument();
    });
  });

  it('clears search and shows all passes', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Mike' } });
    await waitFor(() => {
      expect(screen.queryByText('GP-OUT-20260721-0001')).not.toBeInTheDocument();
    });
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.getByText('GP-OUT-20260721-0002')).toBeInTheDocument();
    });
  });

  it('search is case-insensitive', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'john' } });
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.queryByText('GP-OUT-20260721-0002')).not.toBeInTheDocument();
    });
  });

  it('filters by RGP Out tab', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('RGP Out'));
    await waitFor(() => {
      expect(screen.queryByText('GP-OUT-20260721-0001')).not.toBeInTheDocument();
      expect(screen.getByText('GP-OUT-20260721-0002')).toBeInTheDocument();
    });
  });

  it('filters by NRGP tab', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'NRGP' }));
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.queryByText('GP-OUT-20260721-0002')).not.toBeInTheDocument();
    });
  });

  it('filters by Returns tab', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.queryByText('GP-IN-20260720-0001')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Returns'));
    await waitFor(() => {
      expect(screen.getByText('GP-IN-20260720-0001')).toBeInTheDocument();
    });
  });

  it('All Ready tab shows approved passes', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    const nrgpBtn = screen.getAllByRole('button').find(b => b.textContent === 'NRGP');
    fireEvent.click(nrgpBtn!);
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.queryByText('GP-OUT-20260721-0002')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'All Ready' }));
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
      expect(screen.getByText('GP-OUT-20260721-0002')).toBeInTheDocument();
    });
  });

  it('shows empty state when no passes', async () => {
    setupMockFrom([]);
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText(/No gate passes ready/)).toBeInTheDocument();
    });
  });

  it('shows empty state for a filter tab with no matches', async () => {
    const onlyNrgp = mockPasses.filter(p => p.type === 'NRGP');
    setupMockFrom(onlyNrgp);
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('RGP Out'));
    await waitFor(() => {
      expect(screen.getByText(/No gate passes ready/)).toBeInTheDocument();
    });
  });

  it('opens sign-off panel on card click', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('GP-OUT-20260721-0001'));
    await waitFor(() => {
      expect(screen.getByTestId('signoff-panel')).toBeInTheDocument();
      expect(screen.getByText('Verify Items')).toBeInTheDocument();
    });
  });

  it('passes correct pass ref to sign-off panel', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('GP-OUT-20260721-0001'));
    await waitFor(() => {
      expect(screen.getByTestId('signoff-pass-ref')).toHaveTextContent('GP-OUT-20260721-0001');
    });
  });

  it('closes sign-off panel on close button', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-OUT-20260721-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('GP-OUT-20260721-0001'));
    await waitFor(() => {
      expect(screen.getByTestId('signoff-panel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('signoff-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('signoff-panel')).not.toBeInTheDocument();
    });
  });

  it('handles load error gracefully', async () => {
    const orderResult: any = () => {};
    orderResult.then = (resolve: any) => resolve({ data: null, error: new Error('Network error') });
    orderResult.catch = () => {};
    orderResult.eq = () => orderResult;
    orderResult.in = () => orderResult;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') return { select: () => ({ order: () => orderResult }) };
      return { select: vi.fn() };
    });
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('Gate Pass Queue')).toBeInTheDocument();
    });
  });

  it('handles empty items array', async () => {
    const noItemsPass = [{
      id: 'gp4', ref_number: 'GP-IN-20260722-0001', type: 'NRGP', direction: 'IN',
      department_id: 'dept3', reason: 'Documents', status: 'approved',
      carrier_name: null, company_name: null, expected_return_date: null,
      created_by: 'u1', visit_id: null, created_at: '2026-07-22T10:00:00Z',
      department: { id: 'dept3', name: 'Admin' },
      items: [],
    }];
    setupMockFrom(noItemsPass);
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText('GP-IN-20260722-0001')).toBeInTheDocument();
    });
  });

  it('updates pass count when filter changes', async () => {
    renderQueue();
    await waitFor(() => {
      expect(screen.getByText(/2 ready passes/)).toBeInTheDocument();
    });
    const nrgpBtn = screen.getAllByRole('button').find(b => b.textContent === 'NRGP');
    fireEvent.click(nrgpBtn!);
    await waitFor(() => {
      expect(screen.getByText(/1 ready pass/)).toBeInTheDocument();
    });
  });
});

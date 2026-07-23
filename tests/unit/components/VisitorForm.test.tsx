import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import VisitorForm from '../../../src/pages/Guard/VisitorForm';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockDepts = [
  { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
  { id: 'dept-hr', name: 'Human Resources', code: 'HR', created_at: '2026-01-01' },
];
const mockBlacklist: { phone: string; blacklist_reason: string | null }[] = [];

const mockHosts = [
  { id: 'h1', full_name: 'Priya Sharma', email: 'hod.it@demo.vms', role: 'hod' },
  { id: 'h2', full_name: 'Vikram Patel', email: 'hod2.it@demo.vms', role: 'hod' },
  { id: 'h3', full_name: 'Sanjay Gupta', email: 'delegate.it@demo.vms', role: 'staff' },
];

function setupDefaultMocks() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const visitEq2 = vi.fn().mockReturnValue({ maybeSingle });
  const visitEq1 = vi.fn().mockReturnValue({ eq: visitEq2, maybeSingle });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }),
      };
    }
    if (table === 'visits') {
      return { select: () => ({ eq: visitEq1 }) };
    }
    return { select: () => ({ eq: visitEq1 }) };
  });
  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
    if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

describe('M12-GUARD: VisitorForm host loading', () => {
  beforeEach(() => setupDefaultMocks());

  it('renders the form heading', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Register New Visitor')).toBeInTheDocument();
    });
  });

  it('loads departments on mount', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
      expect(screen.getByText('Human Resources')).toBeInTheDocument();
    });
  });

  it('shows "Select department first" when no department chosen', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Select department first')).toBeInTheDocument();
    });
  });

  function pickDept() {
    const selects = screen.getAllByRole('combobox');
    const deptSelect = selects.find((s) =>
      Array.from(s.children).some((c) => c.textContent === 'Information Technology')
    );
    if (!deptSelect) throw new Error('Department select not found');
    fireEvent.change(deptSelect, { target: { value: 'dept-it' } });
    return deptSelect;
  }

  function getHostSelect() {
    const selects = screen.getAllByRole('combobox');
    return selects.find((s) => {
      const options = Array.from(s.children);
      return options.some((c) => c.textContent === 'Select department first' || c.textContent === 'Select person');
    })!;
  }

  it('loads hosts via RPC when department is selected', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    pickDept();

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByText('Vikram Patel')).toBeInTheDocument();
      expect(screen.getByText('Sanjay Gupta')).toBeInTheDocument();
    });
  });

  it('calls get_hosts_for_department RPC with correct department id', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    pickDept();

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    expect(mockRpc).toHaveBeenCalledWith('get_hosts_for_department', { dept_id: 'dept-it' });
  });

  it('shows "Select person" in host dropdown when department is selected', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    pickDept();

    await waitFor(() => {
      expect(screen.getByText('Select person')).toBeInTheDocument();
    });
  });

  it('handles empty host list gracefully', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    pickDept();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_hosts_for_department', { dept_id: 'dept-it' });
    });

    const hostSelect = getHostSelect();
    expect(hostSelect.children.length).toBe(1);
    expect(hostSelect.children[0]?.textContent).toBe('Select person');
  });

  it('handles fetch failure gracefully', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.reject(new Error('Network error'));
      return Promise.resolve({ data: null, error: null });
    });

    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    pickDept();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_hosts_for_department', { dept_id: 'dept-it' });
    });

    const hostSelect = getHostSelect();
    expect(hostSelect.children.length).toBe(1);
    expect(hostSelect.children[0]?.textContent).toBe('Select person');
  });

  it('disables host select when no department selected', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Register New Visitor')).toBeInTheDocument();
    });

    const hostSelect = getHostSelect();
    expect(hostSelect).toBeDisabled();
  });

  it('re-enables host select when department selected', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });

    const hostSelect = getHostSelect();
    expect(hostSelect).toBeDisabled();

    pickDept();

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    expect(hostSelect).not.toBeDisabled();
  });
});

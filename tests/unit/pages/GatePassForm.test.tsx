import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GatePassForm from '../../../src/pages/Shared/GatePassForm';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockNav = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNav };
});

function setupDeptInMeta() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: 'dept1' } } },
  });
  mockFrom.mockReset();
}

function setupDeptFallback() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod' } } },
  });
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: { department_id: 'dept1' }, error: null }),
          }),
        }),
      };
    }
    return { select: vi.fn(), insert: vi.fn() };
  });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderForm() {
  return render(<MemoryRouter><GatePassForm /></MemoryRouter>);
}

describe('S4-GATEPASS-FORM: GatePassForm', () => {
  beforeEach(() => setupDeptInMeta());

  it('renders the form heading', async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.getByText('New Gate Pass')).toBeInTheDocument();
    });
  });

  it('renders type toggle buttons (RGP, NRGP)', () => {
    renderForm();
    expect(screen.getByText('RGP')).toBeInTheDocument();
    expect(screen.getByText('NRGP')).toBeInTheDocument();
  });

  it('renders direction toggle buttons (IN, OUT)', () => {
    renderForm();
    expect(screen.getByText('IN')).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
  });

  it('NRGP is selected by default', () => {
    renderForm();
    const nrgpBtn = screen.getByText('NRGP');
    expect(nrgpBtn.className).toContain('bg-gradient-to-r');
  });

  it('OUT is selected by default', () => {
    renderForm();
    const outBtn = screen.getByText('OUT');
    expect(outBtn.className).toContain('bg-gradient-to-r');
  });

  it('renders reason input', () => {
    renderForm();
    expect(screen.getByPlaceholderText('Describe the purpose')).toBeInTheDocument();
  });

  it('renders carrier input', () => {
    renderForm();
    expect(screen.getByPlaceholderText('Name or vehicle no.')).toBeInTheDocument();
  });

  it('shows expected return date when RGP + OUT', async () => {
    renderForm();
    fireEvent.click(screen.getByText('RGP'));
    await waitFor(() => {
      expect(screen.getByText('Expected Return Date *')).toBeInTheDocument();
    });
  });

  it('hides expected return date when switching to IN or NRGP', () => {
    renderForm();
    fireEvent.click(screen.getByText('RGP'));
    expect(screen.getByText('Expected Return Date *')).toBeInTheDocument();
    fireEvent.click(screen.getByText('NRGP'));
    expect(screen.queryByText('Expected Return Date *')).not.toBeInTheDocument();
  });

  it('renders one default item line', () => {
    renderForm();
    const descInputs = screen.getAllByPlaceholderText('Description');
    expect(descInputs.length).toBe(1);
  });

  it('adds a new item line on "+ Add item" click', () => {
    renderForm();
    fireEvent.click(screen.getByText('+ Add item'));
    const descInputs = screen.getAllByPlaceholderText('Description');
    expect(descInputs.length).toBe(2);
  });

  it('removes an item line on Remove click', () => {
    renderForm();
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.getAllByPlaceholderText('Description').length).toBe(2);
    const removeBtns = screen.getAllByText('Remove');
    fireEvent.click(removeBtns[0]);
    expect(screen.getAllByPlaceholderText('Description').length).toBe(1);
  });

  it('disables Remove button when only one item line exists', () => {
    renderForm();
    const removeBtn = screen.getByText('Remove');
    expect(removeBtn.closest('button')).toBeDisabled();
  });

  it('renders submit and cancel buttons', () => {
    renderForm();
    expect(screen.getByText('Create Draft')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('auto-loads department_id from JWT app_metadata', async () => {
    renderForm();
    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });
  });

  it('falls back to profiles table when department_id missing from JWT', async () => {
    setupDeptFallback();
    renderForm();
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });
  });

  it('submits form successfully and shows success popup', async () => {
    const mockInsertGatePass = vi.fn().mockResolvedValue({ data: { id: 'gp-new-1', ref_number: 'GP-20260723-0001' }, error: null });
    const mockInsertItems = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return { insert: () => ({ select: () => ({ single: mockInsertGatePass }) }) };
      }
      if (table === 'gate_pass_items') {
        return { insert: mockInsertItems };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test purpose' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Test item' } });
    fireEvent.click(screen.getByText('Create Draft'));
    await waitFor(() => {
      expect(screen.getByText('Gate Pass Created')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Got it'));
    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/gate-passes');
    });
  });

  it('submits with correct department_id from JWT', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1' }, error: null }) }) };
          },
        };
      }
      if (table === 'gate_pass_items') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Create Draft'));
    await waitFor(() => {
      expect(capturedInsert).not.toBeNull();
      expect(capturedInsert.department_id).toBe('dept1');
    });
  });

  it('shows error alert on submission failure', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Create Draft'));
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    let resolveSingle: (v: any) => void = () => {};
    const singlePromise = new Promise((res) => { resolveSingle = res; });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({
            select: () => ({
              single: () => singlePromise,
            }),
          }),
        };
      }
      if (table === 'gate_pass_items') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Create Draft'));
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    resolveSingle({ data: { id: 'gp-1', ref_number: 'GP-20260723-0002' }, error: null });
    await waitFor(() => {
      expect(screen.getByText('Gate Pass Created')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Got it'));
    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/gate-passes');
    });
  });
});

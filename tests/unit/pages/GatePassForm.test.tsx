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

  it('renders only OUT direction for NRGP (default type)', () => {
    renderForm();
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.queryByText('IN')).not.toBeInTheDocument();
  });

  it('renders both IN and OUT direction buttons when RGP is selected', () => {
    renderForm();
    fireEvent.click(screen.getByText('RGP'));
    expect(screen.getByText('IN')).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
  });

  it('resets direction to OUT when switching from RGP to NRGP', () => {
    renderForm();
    fireEvent.click(screen.getByText('RGP'));
    fireEvent.click(screen.getByText('IN'));
    const inBtn = screen.getByText('IN');
    expect(inBtn.className).toContain('bg-gradient-to-r');
    fireEvent.click(screen.getByText('NRGP'));
    expect(screen.queryByText('IN')).not.toBeInTheDocument();
    const outBtn = screen.getByText('OUT');
    expect(outBtn.className).toContain('bg-gradient-to-r');
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
    expect(screen.getByText('Submit Gate Pass')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    resolveSingle({ data: { id: 'gp-1', ref_number: 'GP-20260723-0002' }, error: null });
    await waitFor(() => {
      expect(screen.getByText('Gate Pass Created')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Got it'));
    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/gate-passes');
    });
  });

  // ─── Error scenario: RGP + IN hides return date ─────────────────────────────
  it('hides return date for RGP + IN', () => {
    renderForm();
    fireEvent.click(screen.getByText('RGP'));
    expect(screen.getByText('Expected Return Date *')).toBeInTheDocument();
    fireEvent.click(screen.getByText('IN'));
    expect(screen.queryByText('Expected Return Date *')).not.toBeInTheDocument();
  });

  it('hides return date for NRGP + OUT', () => {
    renderForm();
    // NRGP is default, OUT is default — no return date
    expect(screen.queryByText('Expected Return Date *')).not.toBeInTheDocument();
  });

  it('NRGP does not show IN direction button', () => {
    renderForm();
    // NRGP is default type — only OUT should be available
    expect(screen.queryByText('IN')).not.toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
  });

  it('renders company name input', () => {
    renderForm();
    expect(screen.getByPlaceholderText('Company or vendor name')).toBeInTheDocument();
  });

  it('renders serial number input for each item line', () => {
    renderForm();
    const serialInputs = screen.getAllByPlaceholderText('Serial no.');
    expect(serialInputs.length).toBe(1);
  });

  it('renders qty input with min=1 and max=99999', () => {
    renderForm();
    const qtyInput = screen.getByDisplayValue('1');
    expect(qtyInput).toHaveAttribute('min', '1');
    expect(qtyInput).toHaveAttribute('max', '99999');
  });

  it('shows error when department_id is not loaded', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { role: 'hod' } } },
    });
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('department_id violation') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('department_id violation')).toBeInTheDocument();
    });
  });

  it('shows error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFrom.mockReset();
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it('shows error when items insert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) }),
        };
      }
      if (table === 'gate_pass_items') {
        return { insert: vi.fn().mockResolvedValue({ error: new Error('Items insert failed') }) };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('Items insert failed')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when thrown error has no message', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('GP err') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('GP err')).toBeInTheDocument();
    });
  });

  it('clears previous error on re-submit', async () => {
    // First submission fails
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('First error') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
    // Second submission with different error
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('Second error') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('Second error')).toBeInTheDocument();
    });
    // First error should be gone
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });

  it('shows error when getUser throws', async () => {
    // First call (useEffect) succeeds, second call (submit) rejects
    mockGetUser
      .mockResolvedValueOnce({ data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: 'dept1' } } } })
      .mockRejectedValueOnce(new Error('Auth failure'));
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('Auth failure')).toBeInTheDocument();
    });
  });

  it('renders all input fields with correct attributes', () => {
    renderForm();
    const reasonInput = screen.getByPlaceholderText('Describe the purpose');
    expect(reasonInput).toHaveAttribute('maxLength', '500');
    expect(reasonInput).toHaveAttribute('required');
    const carrierInput = screen.getByPlaceholderText('Name or vehicle no.');
    expect(carrierInput).toHaveAttribute('maxLength', '100');
    const companyInput = screen.getByPlaceholderText('Company or vendor name');
    expect(companyInput).toHaveAttribute('maxLength', '200');
    const descInput = screen.getAllByPlaceholderText('Description')[0];
    expect(descInput).toHaveAttribute('maxLength', '200');
    expect(descInput).toHaveAttribute('required');
  });

  it('renders return date with min attribute set to today', () => {
    const { container } = render(<MemoryRouter><GatePassForm /></MemoryRouter>);
    fireEvent.click(screen.getByText('RGP'));
    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).not.toBeNull();
    expect(dateInput).toHaveAttribute('min', new Date().toISOString().split('T')[0]);
  });

  it('submits with company name when provided', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
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
    fireEvent.change(screen.getByPlaceholderText('Company or vendor name'), { target: { value: 'Acme Corp' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.company_name).toBe('Acme Corp');
    });
  });

  it('submits with carrier name when provided', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
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
    fireEvent.change(screen.getByPlaceholderText('Name or vehicle no.'), { target: { value: 'Truck ABC' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.carrier_name).toBe('Truck ABC');
    });
  });

  it('submits with RGP OUT and expected return date', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
          },
        };
      }
      if (table === 'gate_pass_items') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { select: vi.fn() };
    });
    const { container } = render(<MemoryRouter><GatePassForm /></MemoryRouter>);
    await act(async () => {});
    fireEvent.click(screen.getByText('RGP'));
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Returnable item' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Laptop' } });
    const dateInput = container.querySelector('input[type="date"]');
    fireEvent.change(dateInput!, { target: { value: '2026-08-15' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.type).toBe('RGP');
      expect(capturedInsert?.direction).toBe('OUT');
      expect(capturedInsert?.expected_return_date).toBe('2026-08-15');
    });
  });

  it('submits with null expected_return_date for NRGP', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.expected_return_date).toBeNull();
    });
  });

  it('submits with null expected_return_date for RGP + IN', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
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
    fireEvent.click(screen.getByText('RGP'));
    fireEvent.click(screen.getByText('IN'));
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.type).toBe('RGP');
      expect(capturedInsert?.direction).toBe('IN');
      expect(capturedInsert?.expected_return_date).toBeNull();
    });
  });

  it('submits with null carrier and company when empty', async () => {
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) };
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
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedInsert?.carrier_name).toBeNull();
      expect(capturedInsert?.company_name).toBeNull();
    });
  });

  it('submits with multiple item lines', async () => {
    let capturedItems: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) }),
        };
      }
      if (table === 'gate_pass_items') {
        return {
          insert: (data: any) => {
            capturedItems = data;
            return { error: null };
          },
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item 1' } });
    fireEvent.click(screen.getByText('+ Add item'));
    const descInputs = screen.getAllByPlaceholderText('Description');
    fireEvent.change(descInputs[1], { target: { value: 'Item 2' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedItems).not.toBeNull();
      expect(capturedItems.length).toBe(2);
      expect(capturedItems[0].description).toBe('Item 1');
      expect(capturedItems[1].description).toBe('Item 2');
    });
  });

  it('submits with serial numbers on items', async () => {
    let capturedItems: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) }),
        };
      }
      if (table === 'gate_pass_items') {
        return {
          insert: (data: any) => {
            capturedItems = data;
            return { error: null };
          },
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Laptop' } });
    fireEvent.change(screen.getAllByPlaceholderText('Serial no.')[0], { target: { value: 'SN-12345' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedItems[0].serial_no).toBe('SN-12345');
    });
  });

  it('submits with qty value from input', async () => {
    let capturedItems: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'gp-1', ref_number: 'GP-1' }, error: null }) }) }),
        };
      }
      if (table === 'gate_pass_items') {
        return {
          insert: (data: any) => {
            capturedItems = data;
            return { error: null };
          },
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(capturedItems[0].qty).toBe(5);
    });
  });

  it('clears error state when submitting again after error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('First error') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Item' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('Second error') }) }) }),
        };
      }
      return { select: vi.fn() };
    });
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    await waitFor(() => {
      expect(screen.getByText('Second error')).toBeInTheDocument();
    });
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });

  it('does not submit when required fields are empty (HTML5 validation)', async () => {
    const mockInsert = vi.fn();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return { insert: () => ({ select: () => ({ single: mockInsert }) }) };
      }
      return { select: vi.fn() };
    });
    renderForm();
    // Click submit without filling required fields
    fireEvent.click(screen.getByText('Submit Gate Pass'));
    // HTML5 validation should prevent submission — insert should not be called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('renders the form with all section labels', () => {
    renderForm();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Reason / Purpose *')).toBeInTheDocument();
    expect(screen.getByText('Carrier (Person / Vehicle)')).toBeInTheDocument();
    expect(screen.getByText('Company / Vendor')).toBeInTheDocument();
    expect(screen.getByText('Item Lines *')).toBeInTheDocument();
  });

  it('renders the form icon', () => {
    renderForm();
    const heading = screen.getByText('New Gate Pass');
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Create a material gate pass')).toBeInTheDocument();
  });

  it('submits gate pass under HOD login with company_name included in payload', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'hod-user-1', app_metadata: { role: 'hod', department_id: 'dept-hod-1' } },
      },
      error: null,
    });
    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gate_passes') {
        return {
          insert: (data: any) => {
            capturedInsert = data;
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'gp-hod-1', ref_number: 'GP-20260723-0001' },
                  error: null,
                }),
              }),
            };
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

    fireEvent.change(screen.getByPlaceholderText('Describe the purpose'), { target: { value: 'Material dispatch for vendor' } });
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Laptops' } });
    fireEvent.change(screen.getByPlaceholderText('Company or vendor name'), { target: { value: 'Tech Solutions Inc' } });
    fireEvent.click(screen.getByText('Submit Gate Pass'));

    await waitFor(() => {
      expect(capturedInsert).not.toBeNull();
      expect(capturedInsert.created_by).toBe('hod-user-1');
      expect(capturedInsert.department_id).toBe('dept-hod-1');
      expect(capturedInsert.company_name).toBe('Tech Solutions Inc');
    });
  });
});


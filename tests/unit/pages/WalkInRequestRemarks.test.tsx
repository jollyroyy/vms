import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import WalkInRequest from '../../../src/pages/Guard/WalkInRequest';

// Own harness rather than sharing WalkInRequestScan's: that file is about the
// OCR overlay and stubs a camera, an engine and a canvas to get there. None of
// that is needed to type into a textarea, and CLAUDE.md asks for one concern
// per test file.
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const visitsInsert = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

const mockDepts = [{ id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' }];
const mockHosts = [{ id: 'h1', full_name: 'Priya Sharma', email: 'hod.it@demo.vms', role: 'hod' }];

beforeEach(() => {
  visitsInsert.mockResolvedValue({ error: null });
  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
    if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        upsert: vi.fn().mockReturnValue({
          select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'vis-1' }, error: null }) }),
        }),
      };
    }
    if (table === 'visits') return { insert: visitsInsert };
    return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Fills the required fields and submits, leaving remarks to the caller.
 *
 *  Positional, because the form's existing labels are not htmlFor-associated
 *  with their inputs — only the remarks field this change added is, which is
 *  why that one alone is reachable by name. Selects are: purpose, department,
 *  person to meet. */
async function fillAndSubmit(remarks?: string): Promise<void> {
  fireEvent.change(await screen.findByPlaceholderText(/98xxx/i), { target: { value: '9876543210' } });
  fireEvent.change(screen.getByPlaceholderText('Visitor name'), { target: { value: 'Rahul Verma' } });
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[1], { target: { value: 'dept-it' } });
  await waitFor(() => expect(screen.getByRole('option', { name: 'Priya Sharma' })).toBeInTheDocument());
  fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'h1' } });
  if (remarks !== undefined) {
    fireEvent.change(screen.getByLabelText(/remarks/i), { target: { value: remarks } });
  }
  fireEvent.click(screen.getByText('Send Request'));
}

describe('WalkInRequest — remarks', () => {
  it('offers a remarks field', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByLabelText(/remarks/i)).toBeInTheDocument();
  });

  // The point of the field. An HOD approving a walk-in has never met this
  // person and sees only a name, a vendor and a purpose off a fixed list.
  it('says the note goes to the approver', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByText(/shown to the person approving/i)).toBeInTheDocument();
  });

  it('sends what the guard typed', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await fillAndSubmit('Says he has a 3pm with you. Van at gate 2.');
    await waitFor(() => expect(visitsInsert).toHaveBeenCalled());
    expect(visitsInsert.mock.calls[0][0]).toMatchObject({
      remarks: 'Says he has a 3pm with you. Van at gate 2.',
    });
  });

  // An empty note and no note are the same fact; only one of them belongs in
  // the column, or "has the guard said anything?" stops being answerable.
  it('sends null rather than an empty string when left blank', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await fillAndSubmit();
    await waitFor(() => expect(visitsInsert).toHaveBeenCalled());
    expect(visitsInsert.mock.calls[0][0].remarks).toBeNull();
  });

  it('sends null for whitespace only', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await fillAndSubmit('    ');
    await waitFor(() => expect(visitsInsert).toHaveBeenCalled());
    expect(visitsInsert.mock.calls[0][0].remarks).toBeNull();
  });

  // Mirrors the visits_remarks_length CHECK in migration 068. The constraint is
  // the real enforcement; this stops the guard hitting it by surprise.
  it('caps the field at the length the database accepts', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByLabelText(/remarks/i)).toHaveAttribute('maxLength', '500');
  });

  // carrying_remarks is material-movement text captured at CHECK-IN and paired
  // with the carrying_material tick box. Registration must never write it, or
  // Reports' "Carrying Remarks" column starts printing unrelated prose.
  it('does not write the material-movement remarks column', async () => {
    render(<WalkInRequest onSubmitted={vi.fn()} onCancel={vi.fn()} />);
    await fillAndSubmit('Van at gate 2.');
    await waitFor(() => expect(visitsInsert).toHaveBeenCalled());
    expect(visitsInsert.mock.calls[0][0].carrying_remarks).toBeUndefined();
    expect(visitsInsert.mock.calls[0][0].carrying_material).toBe(false);
  });
});

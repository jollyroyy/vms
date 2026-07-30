// TDD: Admin Panel — departments + heads of department.
// The Supabase wiring lives in src/lib/adminDepartments.ts and src/lib/adminHods.ts
// (covered by their own unit tests); here we mock those modules and verify the UI
// calls them correctly, surfaces validation and errors, and renders live data.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPanel from '../../../src/pages/Admin/AdminPanel';
import type { Department, Profile } from '../../../src/types/index';

/* ─── Mocks ─────────────────────────────────────────────── */

const h = vi.hoisted(() => ({
  departments: [] as any[],
  hods: [] as any[],
  reloadDepartments: vi.fn(),
  reloadHods: vi.fn(),
  validateDepartment: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  validateHod: vi.fn(),
  addHod: vi.fn(),
  updateHod: vi.fn(),
  removeHod: vi.fn(),
}));

vi.mock('../../../src/lib/useDepartments', () => ({
  useDepartments: () => ({ departments: h.departments, loading: false, reload: h.reloadDepartments }),
}));

vi.mock('../../../src/lib/useHods', () => ({
  useHods: () => ({ hods: h.hods, loading: false, reload: h.reloadHods }),
}));

vi.mock('../../../src/lib/adminDepartments', () => ({
  DEPT_CODE_MAX: 10,
  normalizeDepartmentInput: (i: any) => i,
  validateDepartment: h.validateDepartment,
  createDepartment: h.createDepartment,
  updateDepartment: h.updateDepartment,
  deleteDepartment: h.deleteDepartment,
}));

vi.mock('../../../src/lib/adminHods', () => ({
  normalizeHodInput: (i: any) => i,
  validateHod: h.validateHod,
  addHod: h.addHod,
  updateHod: h.updateHod,
  removeHod: h.removeHod,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    channel: () => { const ch: any = {}; ch.on = () => ch; ch.subscribe = () => ch; return ch; },
    removeChannel: vi.fn(),
  },
}));

const dept = (over: Partial<Department> = {}): Department => ({
  id: 'd1', name: 'Human Resources', code: 'HR', created_at: 'now', ...over,
});
const hod = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1', email: 'asha@corp.com', full_name: 'Asha Rao', role: 'hod',
  department_id: 'd1', delegate_id: null, avatar_url: null, created_at: 'now', ...over,
});

beforeEach(() => {
  h.departments = [];
  h.hods = [];
  h.reloadDepartments.mockClear();
  h.reloadHods.mockClear();
  h.validateDepartment.mockReset().mockReturnValue(null);
  h.validateHod.mockReset().mockReturnValue(null);
  h.createDepartment.mockReset().mockResolvedValue({});
  h.updateDepartment.mockReset().mockResolvedValue({});
  h.deleteDepartment.mockReset().mockResolvedValue(undefined);
  h.addHod.mockReset().mockResolvedValue({ created: false });
  h.updateHod.mockReset().mockResolvedValue(undefined);
  h.removeHod.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

const renderPanel = () => render(<MemoryRouter><AdminPanel /></MemoryRouter>);
const setValue = (el: Element, value: string) => fireEvent.change(el, { target: { value } });

/** Fills and submits the "add department" form. */
function submitNewDepartment(name: string, code: string) {
  setValue(screen.getByLabelText(/department name/i), name);
  setValue(screen.getByLabelText(/^code$/i), code);
  fireEvent.click(screen.getByRole('button', { name: /add department/i }));
}

/* ─── Page shell ────────────────────────────────────────── */

describe('AdminPanel — page shell', () => {
  it('renders the page heading', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /admin/i, level: 1 })).toBeInTheDocument();
  });

  it('does NOT expose a Users tab or a Blacklist tab (removed)', () => {
    h.departments = [dept()];
    renderPanel();
    expect(screen.queryByRole('button', { name: /^users$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /blacklist/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/invite new user/i)).not.toBeInTheDocument();
  });

  it('does not render any visitor data or visitor links', () => {
    h.departments = [dept()];
    renderPanel();
    expect(screen.queryByText(/visitors/i)).not.toBeInTheDocument();
  });
});

/* ─── Departments: read ─────────────────────────────────── */

describe('AdminPanel — department list', () => {
  it('shows an empty state when there are no departments', () => {
    renderPanel();
    // The admin overview starts collapsed; open the Departments view so the
    // roster under test is on screen.
    fireEvent.click(screen.getByTitle('Show Departments'));
    expect(screen.getByText(/no departments yet/i)).toBeInTheDocument();
  });

  it('renders each department with its name and code', () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    expect(screen.getByText('Human Resources')).toBeInTheDocument();
    expect(screen.getByText('HR')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('FIN')).toBeInTheDocument();
  });

  it('shows the HODs belonging to each department', () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    h.hods = [hod(), hod({ id: 'p2', full_name: 'Ravi Kumar', email: 'ravi@corp.com', department_id: 'd2' })];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@corp.com')).toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
  });

  it('shows a per-department empty state when it has no HOD', () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    expect(screen.getByText(/no head of department assigned/i)).toBeInTheDocument();
  });
});

/* ─── Departments: create ───────────────────────────────── */

describe('AdminPanel — add department', () => {
  it('creates a department from the form and reloads the list', async () => {
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    submitNewDepartment('Finance', 'FIN');

    await waitFor(() => {
      expect(h.createDepartment).toHaveBeenCalledWith({ name: 'Finance', code: 'FIN' });
    });
    await waitFor(() => expect(h.reloadDepartments).toHaveBeenCalled());
  });

  it('blocks submission and shows the validation message when invalid', async () => {
    h.validateDepartment.mockReturnValue('A department named "Finance" already exists.');
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    submitNewDepartment('Finance', 'FIN');

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(h.createDepartment).not.toHaveBeenCalled();
  });

  it('surfaces a database error without clearing the form', async () => {
    h.createDepartment.mockRejectedValue(new Error('permission denied'));
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));
    submitNewDepartment('Finance', 'FIN');

    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department name/i)).toHaveValue('Finance');
  });
});

/* ─── Departments: update ───────────────────────────────── */

describe('AdminPanel — edit department', () => {
  it('opens an inline edit form prefilled with the current values', () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /edit human resources/i }));

    expect(screen.getByDisplayValue('Human Resources')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HR')).toBeInTheDocument();
  });

  it('saves the edited department and reloads', async () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /edit human resources/i }));
    setValue(screen.getByDisplayValue('Human Resources'), 'People Ops');
    fireEvent.click(screen.getByRole('button', { name: /save department/i }));

    await waitFor(() => {
      expect(h.updateDepartment).toHaveBeenCalledWith('d1', { name: 'People Ops', code: 'HR' });
    });
    await waitFor(() => expect(h.reloadDepartments).toHaveBeenCalled());
  });

  it('cancel closes the edit form without saving', () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /edit human resources/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByDisplayValue('Human Resources')).not.toBeInTheDocument();
    expect(h.updateDepartment).not.toHaveBeenCalled();
  });
});

/* ─── Departments: delete ───────────────────────────────── */

describe('AdminPanel — delete department', () => {
  it('asks for confirmation before deleting', async () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /delete human resources/i }));

    expect(await screen.findByRole('heading', { name: /delete department/i })).toBeInTheDocument();
    expect(h.deleteDepartment).not.toHaveBeenCalled();
  });

  it('deletes the department when confirmed', async () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /delete human resources/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(h.deleteDepartment).toHaveBeenCalledWith('d1'));
    await waitFor(() => expect(h.reloadDepartments).toHaveBeenCalled());
  });

  it('does not delete when the confirmation is dismissed', async () => {
    h.departments = [dept()];
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /delete human resources/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(h.deleteDepartment).not.toHaveBeenCalled();
  });

  it('shows the error when deletion is blocked by linked records', async () => {
    h.departments = [dept()];
    h.deleteDepartment.mockRejectedValue(new Error('Cannot delete: visits, gate passes or users are linked.'));
    renderPanel();
    fireEvent.click(screen.getByTitle('Show Departments'));

    fireEvent.click(screen.getByRole('button', { name: /delete human resources/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText(/cannot delete/i)).toBeInTheDocument();
  });
});

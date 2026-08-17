// TDD: Admin Panel â€” the delete-a-department flow, end to end through the UI.
//
// The three steps an admin must get, in order:
//   1. clicking Delete opens a confirmation dialog and deletes nothing yet;
//   2. confirming reports success in a green status banner;
//   3. both live lists are reloaded so the department disappears on its own.
//
// Split out of AdminPanel.test.tsx to keep both files under the 300-line cap.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// AdminPanel.tsx is DELETED (2026-08-17). Its content is now the Roles & Users
// section of the admin Settings screen — moved, not rebuilt, so everything these
// tests cover still ships and still behaves identically.
import SettingsRolesUsers from '../../../src/pages/Admin/SettingsRolesUsers';
import type { Department } from '../../../src/types/index';

/* â”€â”€â”€ Mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const h = vi.hoisted(() => ({
  departments: [] as any[],
  hods: [] as any[],
  deptError: null as string | null,
  hodError: null as string | null,
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
  useDepartments: () => ({
    departments: h.departments, loading: false, error: h.deptError, reload: h.reloadDepartments,
  }),
}));

vi.mock('../../../src/lib/useHods', () => ({
  useHods: () => ({ hods: h.hods, loading: false, error: h.hodError, reload: h.reloadHods }),
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

beforeEach(() => {
  h.departments = [dept()];
  h.hods = [];
  h.deptError = null;
  h.hodError = null;
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

const renderPanel = () => render(<MemoryRouter><SettingsRolesUsers /></MemoryRouter>);

/** Clicks Delete on the HR card and returns the confirmation dialog. */
async function openConfirm() {
  // The admin overview starts collapsed; open the Departments view so the
  // roster under test is on screen.
  fireEvent.click(screen.getByRole('button', { name: /departments/i }));
  fireEvent.click(screen.getByRole('button', { name: /delete human resources/i }));
  return screen.findByRole('dialog');
}

/* â”€â”€â”€ Step 1: confirmation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe('delete department â€” confirmation step', () => {
  it('opens a confirmation dialog naming the department and deletes nothing yet', async () => {
    renderPanel();
    const modal = await openConfirm();

    expect(within(modal).getByRole('heading', { name: /delete department/i })).toBeInTheDocument();
    expect(within(modal).getByText(/human resources/i)).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(h.deleteDepartment).not.toHaveBeenCalled();
  });

  it('deletes nothing when the dialog is dismissed', async () => {
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(h.deleteDepartment).not.toHaveBeenCalled();
  });
});

/* â”€â”€â”€ Step 2 + 3: success banner and refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe('delete department â€” confirmed', () => {
  it('deletes the department that was clicked', async () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(h.deleteDepartment).toHaveBeenCalledWith('d1'));
    expect(h.deleteDepartment).toHaveBeenCalledTimes(1);
  });

  it('reports success in a status banner naming the department', async () => {
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/human resources/i);
    expect(banner).toHaveTextContent(/deleted successfully/i);
  });

  it('closes the dialog and reloads both live lists so the card disappears', async () => {
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(h.reloadDepartments).toHaveBeenCalled());
    expect(h.reloadHods).toHaveBeenCalled();
  });

  it('shows no success banner when the delete throws', async () => {
    h.deleteDepartment.mockRejectedValue(new Error('Nothing was deleted.'));
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was deleted/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('surfaces a blocked delete instead of pretending it worked', async () => {
    h.deleteDepartment.mockRejectedValue(
      new Error('Cannot delete: visits, gate passes or users are still linked to this department.'),
    );
    renderPanel();
    const modal = await openConfirm();
    fireEvent.click(within(modal).getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/still linked/i);
  });
});

/* â”€â”€â”€ Load failures must never look like empty data â”€â”€â”€â”€â”€â”€â”€ */

describe('admin panel â€” load errors', () => {
  it('shows a department read failure rather than an empty list', async () => {
    h.departments = [];
    h.deptError = 'infinite recursion detected in policy for relation "departments"';
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/infinite recursion/i);
  });

  it('shows an HOD read failure rather than "no head of department assigned"', async () => {
    h.hodError = 'infinite recursion detected in policy for relation "profiles"';
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/infinite recursion/i);
  });
});

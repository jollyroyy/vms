// TDD: Admin Panel â€” head-of-department management (add / modify / remove).
// Split from AdminPanel.test.tsx to keep every file under the 300-line hard rule.
// Department CRUD is covered there; this file owns the HOD behaviour.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// AdminPanel.tsx is DELETED (2026-08-17). Its content is now the Roles & Users
// section of the admin Settings screen — moved, not rebuilt, so everything these
// tests cover still ships and still behaves identically.
import SettingsRolesUsers from '../../../src/pages/Admin/SettingsRolesUsers';
import type { Department, Profile } from '../../../src/types/index';

/* â”€â”€â”€ Mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
  h.departments = [dept()];
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

const renderPanel = () => render(<MemoryRouter><SettingsRolesUsers /></MemoryRouter>);
const setValue = (el: Element, value: string) => fireEvent.change(el, { target: { value } });

/** Opens the add-HOD form on the first department card, fills it, and confirms the dialog. */
async function submitNewHod(name: string, email: string) {
  // The admin overview starts collapsed; open the Departments view so the
  // roster under test is on screen.
  fireEvent.click(screen.getByRole('button', { name: /departments/i }));
  fireEvent.click(screen.getByRole('button', { name: /add head of department/i }));
  setValue(screen.getByLabelText(/hod name/i), name);
  setValue(screen.getByLabelText(/email/i), email);
  fireEvent.click(screen.getByRole('button', { name: /save hod/i }));
  const modal = await screen.findByRole('dialog');
  fireEvent.click(within(modal).getByRole('button', { name: /^add hod$/i }));
}

/* â”€â”€â”€ Add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe('AdminPanel â€” add HOD', () => {
  it('adds an HOD by name and email to the right department', async () => {
    renderPanel();
    submitNewHod('Asha Rao', 'asha@corp.com');

    await waitFor(() => {
      expect(h.addHod).toHaveBeenCalledWith('d1', { fullName: 'Asha Rao', email: 'asha@corp.com' });
    });
    await waitFor(() => expect(h.reloadHods).toHaveBeenCalled());
  });

  it('blocks submission, shows the validation message, and never opens a dialog when invalid', async () => {
    h.validateHod.mockReturnValue('Enter a valid email address.');
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));
    fireEvent.click(screen.getByRole('button', { name: /add head of department/i }));
    setValue(screen.getByLabelText(/hod name/i), 'Asha');
    setValue(screen.getByLabelText(/email/i), 'nope');
    fireEvent.click(screen.getByRole('button', { name: /save hod/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.addHod).not.toHaveBeenCalled();
  });

  it('does nothing when the confirmation dialog is cancelled', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));
    fireEvent.click(screen.getByRole('button', { name: /add head of department/i }));
    setValue(screen.getByLabelText(/hod name/i), 'Asha Rao');
    setValue(screen.getByLabelText(/email/i), 'asha@corp.com');
    fireEvent.click(screen.getByRole('button', { name: /save hod/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(h.addHod).not.toHaveBeenCalled();
  });

  it('tells the admin when a brand-new account was invited', async () => {
    h.addHod.mockResolvedValue({ created: true });
    renderPanel();
    await submitNewHod('Asha Rao', 'asha@corp.com');

    await waitFor(() => expect(h.addHod).toHaveBeenCalled());
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/invitation sent/i);
  });

  it('surfaces an error from addHod', async () => {
    h.addHod.mockRejectedValue(new Error('User already registered'));
    renderPanel();
    await submitNewHod('Asha Rao', 'asha@corp.com');

    await waitFor(() => expect(h.addHod).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i);
  });

  it('adds to the department whose card the form was opened on', async () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    const buttons = screen.getAllByRole('button', { name: /add head of department/i });
    fireEvent.click(buttons[1]);
    setValue(screen.getByLabelText(/hod name/i), 'Ravi Kumar');
    setValue(screen.getByLabelText(/email/i), 'ravi@corp.com');
    fireEvent.click(screen.getByRole('button', { name: /save hod/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^add hod$/i }));

    await waitFor(() => {
      expect(h.addHod).toHaveBeenCalledWith('d2', { fullName: 'Ravi Kumar', email: 'ravi@corp.com' });
    });
  });
});

/* â”€â”€â”€ Modify + remove â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

describe('AdminPanel â€” modify and remove HOD', () => {
  it('edits an HOD name and email', async () => {
    h.hods = [hod()];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    fireEvent.click(screen.getByRole('button', { name: /edit asha rao/i }));
    setValue(screen.getByDisplayValue('Asha Rao'), 'Asha R Rao');
    fireEvent.click(screen.getByRole('button', { name: /save hod/i }));

    await waitFor(() => {
      expect(h.updateHod).toHaveBeenCalledWith('p1', { fullName: 'Asha R Rao', email: 'asha@corp.com' });
    });
    await waitFor(() => expect(h.reloadHods).toHaveBeenCalled());
  });

  it('cancel closes the HOD edit form without saving', () => {
    h.hods = [hod()];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    fireEvent.click(screen.getByRole('button', { name: /edit asha rao/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByDisplayValue('Asha Rao')).not.toBeInTheDocument();
    expect(h.updateHod).not.toHaveBeenCalled();
  });

  it('removes an HOD after confirmation', async () => {
    h.hods = [hod()];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    fireEvent.click(screen.getByRole('button', { name: /remove asha rao/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(h.removeHod).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(h.reloadHods).toHaveBeenCalled());
  });

  it('does not remove an HOD when the confirmation is dismissed', async () => {
    h.hods = [hod()];
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    fireEvent.click(screen.getByRole('button', { name: /remove asha rao/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(h.removeHod).not.toHaveBeenCalled();
  });

  it('surfaces an error from removeHod', async () => {
    h.hods = [hod()];
    h.removeHod.mockRejectedValue(new Error('permission denied'));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /departments/i }));

    fireEvent.click(screen.getByRole('button', { name: /remove asha rao/i }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^remove$/i }));

    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
  });
});

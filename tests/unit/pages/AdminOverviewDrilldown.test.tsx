// TDD: Admin Panel — stat tile drilldown and overview views.
// Tests the three stat tiles (Departments, Heads of Department, Awaiting an HOD),
// their collapse/expand behaviour, and each view's rendering logic.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// AdminPanel.tsx is DELETED (2026-08-17). Its content is now the Roles & Users
// section of the admin Settings screen — moved, not rebuilt, so everything these
// tests cover still ships and still behaves identically.
import SettingsRolesUsers from '../../../src/pages/Admin/SettingsRolesUsers';
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
  id: 'd1', name: 'Engineering', code: 'ENG', created_at: 'now', ...over,
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

const renderPanel = () => render(<MemoryRouter><SettingsRolesUsers /></MemoryRouter>);

/* ─── Stat tiles and overview prompt ────────────────────── */

describe('AdminOverviewDrilldown — stat tiles and overview', () => {
  it('renders all three stat tiles as buttons with their counts', () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    h.hods = [hod()];
    renderPanel();

    const deptTile = screen.getByRole('button', { name: /departments/i });
    const hodTile = screen.getByRole('button', { name: /heads of department/i });
    const unassignedTile = screen.getByRole('button', { name: /awaiting an hod/i });

    expect(deptTile).toBeInTheDocument();
    expect(deptTile).toHaveTextContent('2');
    expect(hodTile).toBeInTheDocument();
    expect(hodTile).toHaveTextContent('1');
    expect(unassignedTile).toBeInTheDocument();
    expect(unassignedTile).toHaveTextContent('1');
  });

  it('renders the collapsed prompt and no records on first render', () => {
    h.departments = [dept()];
    renderPanel();

    expect(screen.getByText(/pick a count to begin/i)).toBeInTheDocument();
    expect(screen.queryByText(/no head of department assigned/i)).not.toBeInTheDocument();
  });

  it('does not show the Hide button when no view is active', () => {
    h.departments = [dept()];
    renderPanel();

    expect(screen.queryByRole('button', { name: /^hide$/i })).not.toBeInTheDocument();
  });
});

/* ─── Departments view ─────────────────────────────────── */

describe('AdminOverviewDrilldown — Departments view', () => {
  it('clicking "Departments" reveals department cards and the New Department form', async () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    renderPanel();

    const deptBtn = screen.getByRole('button', { name: /departments/i });
    deptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/new department/i)).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
  });

  it('shows "No departments yet" when departments list is empty', async () => {
    renderPanel();

    const deptBtn = screen.getByRole('button', { name: /departments/i });
    deptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/no departments yet/i)).toBeInTheDocument();
    });
  });
});

/* ─── Heads of Department view ──────────────────────────── */

describe('AdminOverviewDrilldown — Heads of Department view', () => {
  it('clicking "Heads of Department" reveals HOD names and emails grouped by department', async () => {
    h.departments = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    h.hods = [
      hod(),
      hod({ id: 'p2', full_name: 'Ravi Kumar', email: 'ravi@corp.com', department_id: 'd2' }),
    ];
    renderPanel();

    const hodBtn = screen.getByRole('button', { name: /heads of department/i });
    hodBtn.click();

    await waitFor(() => {
      expect(screen.getByText('Asha Rao')).toBeInTheDocument();
      expect(screen.getByText('asha@corp.com')).toBeInTheDocument();
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
      expect(screen.getByText('ravi@corp.com')).toBeInTheDocument();
    });
  });
});

/* ─── Awaiting an HOD view ──────────────────────────────── */

describe('AdminOverviewDrilldown — Awaiting an HOD view', () => {
  it('lists only departments with no HOD, not those that have one', async () => {
    h.departments = [
      dept({ id: 'd1', name: 'Engineering' }),
      dept({ id: 'd2', name: 'Finance' }),
    ];
    h.hods = [hod({ department_id: 'd1' })];
    renderPanel();

    const unassignedBtn = screen.getByRole('button', { name: /awaiting an hod/i });
    unassignedBtn.click();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    });
  });

  it('shows "Every department has an HOD" when all departments are assigned', async () => {
    h.departments = [dept()];
    h.hods = [hod()];
    renderPanel();

    const unassignedBtn = screen.getByRole('button', { name: /awaiting an hod/i });
    unassignedBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/every department has an hod/i)).toBeInTheDocument();
    });
  });
});

/* ─── Collapse and aria-pressed ────────────────────────── */

describe('AdminOverviewDrilldown — collapse and accessibility', () => {
  it('clicking the active tile again collapses back to the prompt', async () => {
    h.departments = [dept()];
    renderPanel();

    const deptBtn = screen.getByRole('button', { name: /departments/i });
    deptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/new department/i)).toBeInTheDocument();
    });

    deptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/pick a count to begin/i)).toBeInTheDocument();
      expect(screen.queryByText(/new department/i)).not.toBeInTheDocument();
    });
  });

  it('aria-pressed is true for the active tile and false for the others', async () => {
    h.departments = [dept()];
    renderPanel();

    const deptBtn = screen.getByRole('button', { name: /departments/i });
    const hodBtn = screen.getByRole('button', { name: /heads of department/i });
    const unassignedBtn = screen.getByRole('button', { name: /awaiting an hod/i });

    deptBtn.click();

    await waitFor(() => {
      expect(deptBtn).toHaveAttribute('aria-pressed', 'true');
      expect(hodBtn).toHaveAttribute('aria-pressed', 'false');
      expect(unassignedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('the Hide button collapses the panel', async () => {
    h.departments = [dept()];
    renderPanel();

    const deptBtn = screen.getByRole('button', { name: /departments/i });
    deptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/new department/i)).toBeInTheDocument();
    });

    const hideBtn = screen.getByRole('button', { name: /^hide$/i });
    hideBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/pick a count to begin/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^hide$/i })).not.toBeInTheDocument();
    });
  });

  it('aria-controls points to admin-overview-panel for all tiles', () => {
    h.departments = [dept()];
    renderPanel();

    const tiles = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-controls') === 'admin-overview-panel',
    );
    expect(tiles.length).toBe(3);
  });
});

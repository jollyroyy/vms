// Admin Panel â€” the "Awaiting an HOD" drill-down.
//
// This view exists to answer one question: which departments still have no head
// of department? Two things it must never do: list departments that already
// have one, and throw the admin back to the full department list the moment
// they act. Split into its own file per the 300-line hard rule; department CRUD
// lives in AdminPanel.test.tsx and HOD CRUD in AdminPanelHods.test.tsx.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// AdminPanel.tsx is DELETED (2026-08-17). Its content is now the Roles & Users
// section of the admin Settings screen — moved, not rebuilt, so everything these
// tests cover still ships and still behaves identically.
import SettingsRolesUsers from '../../../src/pages/Admin/SettingsRolesUsers';
import type { Department, Profile } from '../../../src/types/index';

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

// Two departments covered, two bare â€” so "shows only the gaps" is a real
// assertion rather than a tautology over a list that happens to be all gaps.
beforeEach(() => {
  h.departments = [
    dept({ id: 'd1', name: 'Human Resources', code: 'HR' }),
    dept({ id: 'd2', name: 'Information Technology', code: 'IT' }),
    dept({ id: 'd3', name: 'Quality Assurance', code: 'QA' }),
    dept({ id: 'd4', name: 'Research & Development', code: 'RND' }),
  ];
  h.hods = [
    hod({ id: 'p1', full_name: 'Asha Rao', department_id: 'd1' }),
    hod({ id: 'p2', full_name: 'Vikram Shah', department_id: 'd2' }),
  ];
  h.validateHod.mockReset().mockReturnValue(null);
  h.addHod.mockReset().mockResolvedValue({ created: false });
  h.reloadHods.mockClear();
});

afterEach(cleanup);

const renderPanel = () => render(<MemoryRouter><SettingsRolesUsers /></MemoryRouter>);
const openGaps = () => fireEvent.click(screen.getByRole('button', { name: /awaiting an hod/i }));

describe('AdminPanel â€” Awaiting an HOD', () => {
  it('lists only the departments with no HOD', () => {
    renderPanel();
    openGaps();

    expect(screen.getByText('Quality Assurance')).toBeInTheDocument();
    expect(screen.getByText('Research & Development')).toBeInTheDocument();
  });

  // The bug this replaced: the drill-down showed every department in the org.
  it('does not list departments that already have an HOD', () => {
    renderPanel();
    openGaps();

    expect(screen.queryByText('Human Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Information Technology')).not.toBeInTheDocument();
  });

  it('counts the gaps on the tile, not the whole department list', () => {
    renderPanel();
    const tile = screen.getByRole('button', { name: /awaiting an hod/i });
    expect(tile.textContent).toContain('2');
  });

  it('gives every listed department its own Assign HOD button', () => {
    renderPanel();
    openGaps();

    expect(screen.getByRole('button', { name: /assign a head of department to Quality Assurance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign a head of department to Research & Development/i })).toBeInTheDocument();
  });

  // The second half of the bug: assigning used to switch to the Departments
  // view, replacing the filtered gap list with all four departments.
  it('opens the assign form in place and keeps the filtered list on screen', () => {
    renderPanel();
    openGaps();
    fireEvent.click(screen.getByRole('button', { name: /assign a head of department to Quality Assurance/i }));

    expect(screen.getByLabelText(/hod name/i)).toBeInTheDocument();
    expect(screen.getByText('Research & Development')).toBeInTheDocument();
    expect(screen.queryByText('Human Resources')).not.toBeInTheDocument();
  });

  it('opens the form on the card that was clicked, and only that card', () => {
    renderPanel();
    openGaps();
    fireEvent.click(screen.getByRole('button', { name: /assign a head of department to Quality Assurance/i }));

    expect(screen.getAllByLabelText(/hod name/i)).toHaveLength(1);
  });

  it('closes the form again when the same button is clicked', () => {
    renderPanel();
    openGaps();
    const btn = screen.getByRole('button', { name: /assign a head of department to Quality Assurance/i });
    fireEvent.click(btn);
    expect(screen.getByLabelText(/hod name/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /assign a head of department to Quality Assurance/i }));
    expect(screen.queryByLabelText(/hod name/i)).not.toBeInTheDocument();
  });

  it('assigns the HOD to the department whose card was used', async () => {
    renderPanel();
    openGaps();
    fireEvent.click(screen.getByRole('button', { name: /assign a head of department to Research & Development/i }));

    fireEvent.change(screen.getByLabelText(/hod name/i), { target: { value: 'Meera Iyer' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'meera@corp.com' } });
    fireEvent.click(screen.getByRole('button', { name: /save hod/i }));

    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^add hod$/i }));

    await vi.waitFor(() => {
      expect(h.addHod).toHaveBeenCalledWith('d4', { fullName: 'Meera Iyer', email: 'meera@corp.com' });
    });
  });

  it('shows a reassuring empty state when every department has an HOD', () => {
    h.hods = h.departments.map((d, i) => hod({ id: `p${i}`, department_id: d.id }));
    renderPanel();
    openGaps();

    expect(screen.getByText('Every department has an HOD')).toBeInTheDocument();
    expect(screen.queryByText('Quality Assurance')).not.toBeInTheDocument();
  });
});

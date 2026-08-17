import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSettings from '../../../src/pages/Admin/AdminSettings';
import { SETTINGS_SECTIONS, sectionFromSlug } from '../../../src/lib/settingsSections';

// Settings is TWO sections — Departments and Users (client instruction,
// 2026-08-17: keep those two, remove everything else, Integrations included).
//
// This suite used to be about draft/dirty behaviour across six sections of
// stored key/value switches under one Save button. All of that is gone with the
// sections: there is no page-level save any more, because both remaining
// panels write at the moment the admin confirms and a button governing nothing
// is the same lie the "Recorded — not yet enforced" fields were.
//
// Both panels pull in large CRUD trees (useDepartments/useHods, the user
// directory RPCs) that are irrelevant to what this page's own contract is —
// which rail item is lit, which panel is mounted, and what `?section=` says.

vi.mock('../../../src/pages/Admin/DepartmentsManager', () => ({
  default: () => <div data-testid="departments-manager-stub">Departments Manager</div>,
}));

vi.mock('../../../src/pages/Admin/SettingsUsers', () => ({
  default: () => <div data-testid="settings-users-stub">Users</div>,
}));

function renderAt(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/settings${search}`]}>
      <AdminSettings />
    </MemoryRouter>,
  );
}

function rail() {
  return screen.getByRole('navigation', { name: 'Settings sections' });
}

afterEach(cleanup);

describe('AdminSettings', () => {
  it('renders exactly two sections in the rail, and none of the five that were removed', () => {
    renderAt();
    const items = within(rail()).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual(['Departments', 'Users']);

    for (const gone of ['General', 'Check-In Rules', 'Badges', 'Notifications', 'Integrations']) {
      expect(within(rail()).queryByRole('button', { name: gone })).toBeNull();
    }
  });

  // The Integrations section named a webhook URL, an email switch and a
  // WhatsApp switch. Two of the three were "Recorded — not yet enforced": there
  // is no dispatcher, and pg_net is not installed on this project, so a
  // scheduled job cannot make an HTTP call at all.
  it('offers no integrations controls anywhere on the page', () => {
    renderAt();
    expect(screen.queryByText(/webhook/i)).toBeNull();
    expect(screen.queryByText(/integrations/i)).toBeNull();
  });

  // There is no page-level save because nothing on this page is drafted.
  it('has no Save Changes control', () => {
    renderAt();
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
  });

  it('lands on Departments and mounts the departments manager', () => {
    renderAt();
    expect(screen.getByTestId('departments-manager-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-users-stub')).toBeNull();
  });

  it('swaps the panel when Users is clicked', () => {
    renderAt();
    fireEvent.click(within(rail()).getByRole('button', { name: 'Users' }));
    expect(screen.getByTestId('settings-users-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('departments-manager-stub')).toBeNull();
  });

  // The Hosts tab links straight to `?section=users`, so a deep link has to
  // open that panel rather than the default one.
  it('opens the section named by ?section=', () => {
    renderAt('?section=users');
    expect(screen.getByTestId('settings-users-stub')).toBeInTheDocument();
  });

  // Every slug from the five deleted sections is in somebody's bookmarks, and
  // the old Roles & Users slug was linked from the Hosts tab for a day. All of
  // them must open a real screen rather than an empty panel.
  it('degrades a stale or unknown ?section= onto Departments', () => {
    for (const stale of ['roles', 'general', 'checkin', 'badges', 'notifications', 'integrations', 'nonsense']) {
      expect(sectionFromSlug(stale)).toBe('departments');
    }
    renderAt('?section=integrations');
    expect(screen.getByTestId('departments-manager-stub')).toBeInTheDocument();
  });

  // The rail and the panel derive from ONE declaration, so they cannot describe
  // different screens — the rule visitorSegments.ts follows for the guard.
  it('prints the open section’s blurb, from settingsSections', () => {
    renderAt('?section=users');
    const users = SETTINGS_SECTIONS.find((s) => s.key === 'users');
    expect(screen.getByText(users!.blurb)).toBeInTheDocument();
  });
});
